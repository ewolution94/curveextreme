// The game: one deterministic simulation in fixed ticks, run by the server for rooms and by the
// page for the shared keyboard. Every number comes from the feel profile (feel.mjs), the powerup
// table (powerups.mjs) and the mode (modes.mjs); nothing here is a constant of the game.
//
// A Match runs rounds. Each tick takes every player's input ({ dir: -1|0|1, presses: [±1] }) and
// returns one message for the pages: the curves' positions and the tick's events.
//
//   curve tuple   [cid, x, y, a, bits, w]   bits: 1 drew a line this tick, 2 jumped (no line to
//                 here), 4 died this tick; w the line's width this tick
//   events        phase, die, score, pu+, pu-, fx, erase, switch, spawn, zone, walls, moving,
//                 dark, roundEnd

import { POWERUPS, ACTIONS } from './powerups.mjs';
import { fieldFor } from './feel.mjs';

/** A small seeded random source (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The classic target: 10 points per opponent. */
export const targetFor = (players) => 10 * Math.max(1, players - 1);

/** A curve's numbers for a tick, from its running effects. */
export function motionOf(effects, feel) {
  const m = { v: feel.speed, r: feel.radius, w: feel.width, hit: feel.hit, gapLen: feel.gapLength, gapRate: 1, corner: false, reverse: false, finger: 0, fly: false, wrap: false };
  let size = 1, gapMul = 1, gapAdd = 0;
  for (const e of effects) {
    const p = POWERUPS[e.kind];
    if (!p) continue;
    const mo = p.mods;
    if (mo) {
      if (mo.speed) m.v *= mo.speed;
      if (mo.radius) m.r *= mo.radius;
      if (mo.size) size *= mo.size;
      if (mo.gap) gapMul *= mo.gap;
      if (mo.gapRate) m.gapRate *= mo.gapRate;
      if (mo.gapAdd) gapAdd += mo.gapAdd;
    }
    const f = p.flags;
    if (f) {
      if (f.corner) m.corner = true;
      if (f.reverse) m.reverse = true;
      if (f.finger) m.finger = e.side || 1;
      if (f.fly) m.fly = true;
      if (f.wrap) m.wrap = true;
    }
  }
  m.w = feel.width * size;
  m.hit = feel.hit * size;
  m.gapLen = feel.gapLength * gapMul + gapAdd;
  return m;
}

const TAU = Math.PI * 2;
const norm = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);

/**
 * Turn and move a curve ({ x, y, a }) by one tick. dir: -1 left, 0 straight, 1 right (screen y
 * points down, so a growing angle turns right); presses: the corner turns pressed since the last
 * tick. Returns the distance moved. The server, the page's game and the prediction all use this.
 */
export function steer(c, m, dir, presses, dt) {
  let d = m.reverse ? -dir : dir;
  if (m.finger && d !== m.finger) d = 0;
  if (m.corner) {
    for (const p0 of presses) {
      const p = m.reverse ? -p0 : p0;
      if (m.finger && p !== m.finger) continue;
      c.a += (p * Math.PI) / 2;
    }
  } else if (d) {
    c.a += d * (m.v / m.r) * dt;
  }
  c.a = norm(c.a);
  const len = m.v * dt;
  c.x += Math.cos(c.a) * len;
  c.y += Math.sin(c.a) * len;
  return len;
}

/** Through an open wall to the other side. Returns true if the curve went through. */
export function wrapInto(c, rect) {
  const w = rect.x1 - rect.x0, h = rect.y1 - rect.y0;
  let jumped = false;
  if (c.x < rect.x0) { c.x += w; jumped = true; } else if (c.x > rect.x1) { c.x -= w; jumped = true; }
  if (c.y < rect.y0) { c.y += h; jumped = true; } else if (c.y > rect.y1) { c.y -= h; jumped = true; }
  return jumped;
}

/** The walls at tick k while they close. */
export function wallsAt(walls, k) {
  if (!walls.closing) return walls.rect;
  const { from, to, k0, k1 } = walls.closing;
  const t = Math.min(1, Math.max(0, (k - k0) / Math.max(1, k1 - k0)));
  return {
    x0: from.x0 + (to.x0 - from.x0) * t,
    y0: from.y0 + (to.y0 - from.y0) * t,
    x1: from.x1 + (to.x1 - from.x1) * t,
    y1: from.y1 + (to.y1 - from.y1) * t,
  };
}

const r2 = (n) => Math.round(n * 100) / 100;
const r4 = (n) => Math.round(n * 10000) / 10000;
const CELL = 12;
const cellKey = (gx, gy) => gx * 8192 + gy;

export class Match {
  /**
   * @param {{ players: {id:string,name:string,colour:string,team?:number}[], rules?: object,
   *   feel: object, mode: { rate:number, powerups:string[] }, seed?: number }} o
   */
  constructor({ players, rules = {}, feel, mode, seed = Date.now() }) {
    this.players = players.map((p) => ({ id: p.id, name: p.name, colour: p.colour, team: p.team ?? 0 }));
    const teams = rules.type === 'teams' && new Set(this.players.map((p) => p.team)).size > 1;
    this.rules = {
      type: teams ? 'teams' : 'ffa',
      target: rules.target > 0 ? Math.round(rules.target) : targetFor(this.players.length),
      teamTarget: rules.teamTarget > 0 ? Math.round(rules.teamTarget) : 10,
      winBy: rules.winBy ?? 2,
    };
    this.feel = feel;
    this.mode = mode;
    this.random = rng(seed);
    this.points = Object.fromEntries(this.players.map((p) => [p.id, 0]));
    this.teamWins = {};
    if (this.rules.type === 'teams') for (const p of this.players) this.teamWins[p.team] = 0;
    this.roundNo = 0;
    this.over = false;
    this.winner = null;
    this.ids = 1;
    this.r = null;
  }

  /** For the next round: a new feel or mode (the Tune panel, the host's settings). */
  retune({ feel, mode } = {}) {
    if (feel) this.feel = feel;
    if (mode) this.mode = mode;
  }

  teamOf(pid) {
    return this.players.find((p) => p.id === pid)?.team ?? 0;
  }

  /** Starts a round; returns the message the pages start it from. */
  startRound() {
    const feel = this.feel;
    const rand = this.random;
    this.roundNo++;
    const [W, H] = fieldFor(feel, this.players.length);
    const rect = { x0: 0, y0: 0, x1: W, y1: H };
    const rate = feel.tickRate;
    const r = (this.r = {
      feel, W, H, rate, k: 0,
      phase: 'still',
      stillK: Math.round(feel.stillTime * rate),
      freeK: Math.round((feel.stillTime + feel.freeTime) * rate),
      walls: { rect, closing: null },
      curves: [],
      powerups: [],
      zones: [],
      movingUntil: 0,
      darkUntil: 0,
      nextSpawnK: Infinity,
      lingerUntil: 0,
      winner: null,
      points: { x: [], y: [], r: [], s: [], cid: [], pid: [] },
      grid: new Map(),
      runs: new Map(),
      deadAt: {},
    });
    // spawns: a margin from the walls, apart from each other, random headings
    const m = feel.spawnMargin;
    for (const p of this.players) {
      let x = 0, y = 0;
      for (let tries = 0; tries < 40; tries++) {
        x = W * m + rand() * W * (1 - 2 * m);
        y = H * m + rand() * H * (1 - 2 * m);
        if (r.curves.every((c) => Math.hypot(c.x - x, c.y - y) >= feel.spawnApart)) break;
      }
      r.curves.push(this.newCurve(p.id, x, y, rand() * TAU - Math.PI));
    }
    return {
      t: 'round',
      no: this.roundNo,
      W, H, rate,
      still: r.stillK,
      free: r.freeK,
      feel,
      curves: r.curves.map((c) => ({ cid: c.id, pid: c.pid, x: r2(c.x), y: r2(c.y), a: r4(c.a), m: this.motionView(c) })),
      points: { ...this.points },
      teamWins: { ...this.teamWins },
      target: this.rules.target,
      teamTarget: this.rules.teamTarget,
      type: this.rules.type,
    };
  }

  newCurve(pid, x, y, a) {
    return {
      id: this.ids++, pid, x, y, a, alive: true,
      s: 0, lineFrom: 0, gapLeft: 0,
      effects: [], m: null, dirty: true,
      jump: false, immuneUntil: 0, lastRunK: -1,
    };
  }

  motion(c) {
    if (c.dirty || !c.m) {
      c.m = motionOf(c.effects, this.r.feel);
      c.dirty = false;
    }
    return c.m;
  }

  motionView(c) {
    const m = this.motion(c);
    return {
      v: r2(m.v), r: r2(m.r), w: r2(m.w), hit: r2(m.hit),
      corner: m.corner, reverse: m.reverse, finger: m.finger, fly: m.fly, wrap: m.wrap,
      fx: c.effects.map((e) => [e.kind, e.until]),
    };
  }

  alivePlayers() {
    const r = this.r;
    return this.players.filter((p) => r.curves.some((c) => c.alive && c.pid === p.id));
  }

  /** One tick. inputs: Map pid → { dir, presses }. Returns the tick's message. */
  tick(inputs) {
    const r = this.r;
    const feel = r.feel;
    const rand = this.random;
    const dt = 1 / r.rate;
    if (r.phase === 'done') return { t: 's', k: r.k, c: [] };
    const k = ++r.k;
    const ev = [];
    const fxDirty = new Set();

    if (r.phase === 'still' && k > r.stillK) {
      r.phase = 'free';
      ev.push({ e: 'phase', p: 'free' });
    }
    if (r.phase === 'free' && k > r.freeK) {
      r.phase = 'draw';
      ev.push({ e: 'phase', p: 'draw' });
      r.nextSpawnK = k + this.spawnGap();
    }

    // effects and zones run out
    for (const c of r.curves) {
      const before = c.effects.length;
      if (before) c.effects = c.effects.filter((e) => e.until > k);
      if (c.effects.length !== before) {
        c.dirty = true;
        fxDirty.add(c);
      }
    }
    if (r.zones.length) r.zones = r.zones.filter((z) => z.until > k);
    const rect = wallsAt(r.walls, k);

    // move, draw, collide
    const deathsBefore = new Set(this.alivePlayers().map((p) => p.id));
    const tuples = [];
    if (r.phase !== 'still') {
      for (const c of r.curves) {
        if (!c.alive) continue;
        const m = this.motion(c);
        const inp = inputs?.get(c.pid);
        const px = c.x, py = c.y;
        const len = steer(c, m, inp?.dir ?? 0, inp?.presses ?? [], dt);
        c.s += len;
        let jump = c.jump;
        c.jump = false;
        if (r.phase === 'free') {
          tuples.push([c.id, r2(c.x), r2(c.y), r4(c.a), jump ? 2 : 0, r2(m.w)]);
          continue;
        }
        if (m.wrap && wrapInto(c, rect)) jump = true;

        // gaps: a memoryless chance per unit of line, after the shortest line
        let draw = true;
        if (c.gapLeft > 0) {
          c.gapLeft -= len;
          draw = false;
          if (c.gapLeft <= 0) c.lineFrom = c.s;
        } else if (c.s - c.lineFrom >= feel.gapMin && rand() < (len * m.gapRate) / Math.max(1, feel.gapMean - feel.gapMin)) {
          c.gapLeft = m.gapLen;
          draw = false;
        }
        const safe = r.zones.some((z) => Math.hypot(c.x - z.x, c.y - z.y) < z.r);
        if (m.fly || safe) draw = false;

        const hr = m.hit / 2;
        let dead = false, by = null;
        if (!safe) {
          if (!m.wrap && (c.x - hr < rect.x0 || c.y - hr < rect.y0 || c.x + hr > rect.x1 || c.y + hr > rect.y1)) dead = true;
          else if (!m.fly) {
            const hit = this.hitLine(c, hr, len, k);
            if (hit >= 0) {
              dead = true;
              by = r.points.pid[hit];
            }
          }
        }
        if (dead) {
          c.alive = false;
          tuples.push([c.id, r2(c.x), r2(c.y), r4(c.a), 4, r2(m.w)]);
          ev.push({ e: 'die', cid: c.id, pid: c.pid, x: r2(c.x), y: r2(c.y), by: by && by !== c.pid ? by : null });
          continue;
        }
        const drew = draw && !jump;
        if (drew) this.addPoint(c, m, px, py);
        tuples.push([c.id, r2(c.x), r2(c.y), r4(c.a), (drew ? 1 : 0) | (jump ? 2 : 0), r2(m.w)]);
        this.pickups(c, m, k, ev, fxDirty);
      }
    }

    // points: everyone still alive scores for each player who died this tick
    if (r.phase === 'draw') {
      const alive = new Set(this.alivePlayers().map((p) => p.id));
      const died = [...deathsBefore].filter((id) => !alive.has(id));
      if (died.length) {
        for (const d of died) {
          r.deadAt[d] = k;
          for (const q of alive) {
            if (this.rules.type === 'teams' && this.teamOf(q) === this.teamOf(d)) continue;
            this.points[q] += 1;
          }
        }
        ev.push({ e: 'score', pts: { ...this.points }, died });
      }
      this.decide(alive, k, ev);
    } else if (r.phase === 'linger' && k >= r.lingerUntil) {
      r.phase = 'done';
      this.endRound(ev);
    }

    // powerups: spawn, drift
    if (r.phase === 'draw') this.spawn(k, rect, ev);
    let pu;
    if (k < r.movingUntil && r.powerups.length) {
      const speed = ACTIONS.moving.speed * dt;
      for (const p of r.powerups) {
        p.x += p.vx * speed;
        p.y += p.vy * speed;
        const pr = feel.powerupRadius;
        if (p.x < rect.x0 + pr || p.x > rect.x1 - pr) p.vx *= -1;
        if (p.y < rect.y0 + pr || p.y > rect.y1 - pr) p.vy *= -1;
        p.x = Math.min(rect.x1 - pr, Math.max(rect.x0 + pr, p.x));
        p.y = Math.min(rect.y1 - pr, Math.max(rect.y0 + pr, p.y));
      }
      pu = r.powerups.map((p) => [p.id, r2(p.x), r2(p.y)]);
    }

    for (const c of fxDirty) if (c.alive) ev.push({ e: 'fx', cid: c.id, m: this.motionView(c) });

    const msg = { t: 's', k, c: tuples };
    if (ev.length) msg.e = ev;
    if (pu) msg.p = pu;
    return msg;
  }

  /** Is the round decided? FFA: one player (or none) left; teams: one team left. */
  decide(alive, k, ev) {
    const r = this.r;
    const n = this.players.length;
    let decided = false, winner = null;
    if (this.rules.type === 'teams') {
      const teams = new Set([...alive].map((id) => this.teamOf(id)));
      if (teams.size <= 1) {
        decided = true;
        winner = teams.size ? [...teams][0] : null;
      }
    } else if (n >= 2 ? alive.size <= 1 : alive.size === 0) {
      decided = true;
      winner = n >= 2 && alive.size ? [...alive][0] : null;
    }
    if (!decided) return;
    r.phase = 'linger';
    r.winner = winner;
    r.lingerUntil = k + Math.round(r.feel.lingerTime * r.rate);
    if (this.rules.type === 'teams' && winner !== null) this.teamWins[winner] = (this.teamWins[winner] ?? 0) + 1;
    ev.push({ e: 'phase', p: 'linger', winner });
  }

  endRound(ev) {
    const r = this.r;
    const n = this.players.length;
    if (this.rules.type === 'teams') {
      const best = Object.entries(this.teamWins).sort((a, b) => b[1] - a[1])[0];
      if (best && best[1] >= this.rules.teamTarget) {
        this.over = true;
        this.winner = Number(best[0]);
      }
    } else if (n >= 2) {
      const sorted = Object.entries(this.points).sort((a, b) => b[1] - a[1]);
      const [top, second] = sorted;
      if (top[1] >= this.rules.target && top[1] - (second?.[1] ?? 0) >= this.rules.winBy) {
        this.over = true;
        this.winner = top[0];
      }
    }
    ev.push({ e: 'roundEnd', winner: r.winner, points: { ...this.points }, teamWins: { ...this.teamWins }, over: this.over, matchWinner: this.winner });
  }

  addPoint(c, m, px, py) {
    const r = this.r;
    const P = r.points;
    const i = P.x.length;
    P.x.push(c.x); P.y.push(c.y); P.r.push(m.w / 2); P.s.push(c.s); P.cid.push(c.id); P.pid.push(c.pid);
    const key = cellKey(Math.floor(c.x / CELL), Math.floor(c.y / CELL));
    let bucket = r.grid.get(key);
    if (!bucket) r.grid.set(key, (bucket = []));
    bucket.push(i);
    // the runs a late joiner gets as the field so far
    const w = r2(m.w);
    let runs = r.runs.get(c.id);
    if (!runs) r.runs.set(c.id, (runs = []));
    const last = runs[runs.length - 1];
    if (last && c.lastRunK === r.k - 1 && last.w === w) last.pts.push(r2(c.x), r2(c.y));
    else runs.push({ w, pts: [r2(px), r2(py), r2(c.x), r2(c.y)] });
    c.lastRunK = r.k;
  }

  /** The index of the line point the head hits, or -1. */
  hitLine(c, hr, len, k) {
    const r = this.r;
    const P = r.points;
    const reach = hr + 12;
    const x0 = Math.floor((c.x - reach) / CELL), x1 = Math.floor((c.x + reach) / CELL);
    const y0 = Math.floor((c.y - reach) / CELL), y1 = Math.floor((c.y + reach) / CELL);
    for (let gx = x0; gx <= x1; gx++) {
      for (let gy = y0; gy <= y1; gy++) {
        const bucket = r.grid.get(cellKey(gx, gy));
        if (!bucket) continue;
        for (const i of bucket) {
          const pr = P.r[i];
          if (P.cid[i] === c.id && c.s - P.s[i] < (hr + pr) * 1.5 + len) continue; // our own neck
          if (P.pid[i] === c.pid && k < c.immuneUntil) continue; // just split
          const dx = P.x[i] - c.x, dy = P.y[i] - c.y, rr = hr + pr;
          if (dx * dx + dy * dy < rr * rr) return i;
        }
      }
    }
    return -1;
  }

  spawnGap() {
    const r = this.r;
    const mean = (r.feel.powerupEvery / Math.max(0.05, this.mode.rate)) * r.rate;
    return Math.max(1, Math.round(-Math.log(1 - this.random()) * mean));
  }

  spawn(k, rect, ev) {
    const r = this.r;
    if (k < r.nextSpawnK) return;
    r.nextSpawnK = k + this.spawnGap();
    const kinds = this.mode.powerups.filter((kind) => POWERUPS[kind]);
    if (!kinds.length || r.powerups.length >= r.feel.powerupMax) return;
    const total = kinds.reduce((sum, kind) => sum + POWERUPS[kind].weight, 0);
    let pick = this.random() * total, kind = kinds[0];
    for (const kd of kinds) {
      pick -= POWERUPS[kd].weight;
      if (pick < 0) { kind = kd; break; }
    }
    const pr = r.feel.powerupRadius + 4;
    let x = 0, y = 0;
    for (let tries = 0; tries < 12; tries++) {
      x = rect.x0 + pr + this.random() * Math.max(1, rect.x1 - rect.x0 - 2 * pr);
      y = rect.y0 + pr + this.random() * Math.max(1, rect.y1 - rect.y0 - 2 * pr);
      if (r.curves.every((c) => !c.alive || Math.hypot(c.x - x, c.y - y) > 40)) break;
    }
    const p = { id: this.ids++, kind, x, y, vx: 0, vy: 0 };
    if (k < r.movingUntil) this.drift(p);
    r.powerups.push(p);
    ev.push({ e: 'pu+', id: p.id, kind, x: r2(x), y: r2(y) });
  }

  drift(p) {
    const a = this.random() * TAU;
    p.vx = Math.cos(a);
    p.vy = Math.sin(a);
  }

  pickups(c, m, k, ev, fxDirty) {
    const r = this.r;
    if (!r.powerups.length) return;
    const reach = r.feel.powerupRadius + m.hit / 2;
    for (let i = r.powerups.length - 1; i >= 0; i--) {
      const p = r.powerups[i];
      if (Math.hypot(p.x - c.x, p.y - c.y) > reach) continue;
      r.powerups.splice(i, 1);
      ev.push({ e: 'pu-', id: p.id, cid: c.id, pid: c.pid, kind: p.kind });
      this.apply(p, c, k, ev, fxDirty);
    }
  }

  /** A powerup's effect: on you (green), your opponents (red) or everyone (blue). */
  apply(p, c, k, ev, fxDirty) {
    const r = this.r;
    const P = POWERUPS[p.kind];
    const until = k + Math.round(P.dur * r.rate);
    if (P.action) return this.act(P.action, p, c, until, k, ev, fxDirty);
    const teams = this.rules.type === 'teams';
    const targets = r.curves.filter((t) => {
      if (!t.alive) return false;
      if (P.colour === 'green') return t.pid === c.pid;
      if (P.colour === 'red') return teams ? this.teamOf(t.pid) !== this.teamOf(c.pid) : t.pid !== c.pid;
      return true;
    });
    for (const t of targets) {
      t.effects.push({ kind: p.kind, until, side: P.flags?.finger ? (this.random() < 0.5 ? -1 : 1) : 0 });
      t.dirty = true;
      fxDirty.add(t);
    }
  }

  act(action, p, c, until, k, ev, fxDirty) {
    const r = this.r;
    switch (action) {
      case 'eraseAll':
        this.erase(null);
        ev.push({ e: 'erase', pid: null });
        break;
      case 'eraseOwn':
        this.erase(c.pid);
        ev.push({ e: 'erase', pid: c.pid });
        break;
      case 'switch': {
        const alive = r.curves.filter((t) => t.alive);
        if (alive.length < 2) break;
        const spots = alive.map((t) => ({ x: t.x, y: t.y, a: t.a }));
        let order = alive.map((_, i) => i);
        for (let tries = 0; tries < 20; tries++) {
          order = order.map((v) => [v, this.random()]).sort((a, b) => a[1] - b[1]).map((v) => v[0]);
          if (order.every((v, i) => v !== i)) break;
        }
        alive.forEach((t, i) => {
          Object.assign(t, spots[order[i]]);
          t.jump = true;
        });
        ev.push({ e: 'switch' });
        break;
      }
      case 'split': {
        const spread = ACTIONS.split.spread;
        const immune = k + Math.round(ACTIONS.splitImmune * r.rate);
        c.immuneUntil = immune;
        for (const side of [-1, 1]) {
          const n = this.newCurve(c.pid, c.x, c.y, norm(c.a + side * spread));
          Object.assign(n, { s: c.s, lineFrom: c.s, effects: c.effects.map((e) => ({ ...e })), immuneUntil: immune, dirty: true });
          r.curves.push(n);
          ev.push({ e: 'spawn', cid: n.id, pid: n.pid, x: r2(n.x), y: r2(n.y), a: r4(n.a), m: this.motionView(n) });
        }
        break;
      }
      case 'noDraw': {
        const z = { id: this.ids++, x: p.x, y: p.y, r: ACTIONS.noDraw.radius, until };
        r.zones.push(z);
        ev.push({ e: 'zone', id: z.id, x: r2(z.x), y: r2(z.y), r: z.r, until });
        break;
      }
      case 'closeWalls': {
        const from = wallsAt(r.walls, k);
        const f = ACTIONS.closeWalls.to;
        const cx = (from.x0 + from.x1) / 2, cy = (from.y0 + from.y1) / 2;
        const hw = ((from.x1 - from.x0) / 2) * f, hh = ((from.y1 - from.y0) / 2) * f;
        const to = { x0: cx - hw, y0: cy - hh, x1: cx + hw, y1: cy + hh };
        r.walls.closing = { from, to, k0: k, k1: k + Math.round(ACTIONS.closeWalls.seconds * r.rate) };
        ev.push({ e: 'walls', ...r.walls.closing });
        break;
      }
      case 'moving':
        r.movingUntil = until;
        for (const q of r.powerups) this.drift(q);
        ev.push({ e: 'moving', until });
        break;
      case 'darkness':
        r.darkUntil = until;
        ev.push({ e: 'dark', until });
        break;
    }
    void fxDirty;
  }

  erase(pid) {
    const r = this.r;
    const P = r.points;
    if (pid === null) {
      r.points = { x: [], y: [], r: [], s: [], cid: [], pid: [] };
      r.grid = new Map();
      r.runs = new Map();
      return;
    }
    const keep = { x: [], y: [], r: [], s: [], cid: [], pid: [] };
    const grid = new Map();
    for (let i = 0; i < P.x.length; i++) {
      if (P.pid[i] === pid) continue;
      const j = keep.x.length;
      for (const f of ['x', 'y', 'r', 's', 'cid', 'pid']) keep[f].push(P[f][i]);
      const key = cellKey(Math.floor(P.x[i] / CELL), Math.floor(P.y[i] / CELL));
      let b = grid.get(key);
      if (!b) grid.set(key, (b = []));
      b.push(j);
    }
    r.points = keep;
    r.grid = grid;
    for (const c of r.curves) if (c.pid === pid) r.runs.delete(c.id);
  }

  /** Everything a page needs to join a round in the middle: the lines so far and the field. */
  snapshot() {
    const r = this.r;
    if (!r) return null;
    return {
      t: 'snap',
      k: r.k,
      phase: r.phase,
      runs: [...r.runs.entries()].flatMap(([cid, runs]) => runs.map((run) => [cid, run.w, run.pts])),
      curves: r.curves.map((c) => ({ cid: c.id, pid: c.pid, x: r2(c.x), y: r2(c.y), a: r4(c.a), alive: c.alive, m: this.motionView(c) })),
      powerups: r.powerups.map((p) => ({ id: p.id, kind: p.kind, x: r2(p.x), y: r2(p.y) })),
      zones: r.zones.map((z) => ({ id: z.id, x: r2(z.x), y: r2(z.y), r: z.r, until: z.until })),
      walls: r.walls.closing,
      movingUntil: r.movingUntil,
      darkUntil: r.darkUntil,
    };
  }

  standings() {
    return this.players
      .map((p) => ({ id: p.id, name: p.name, colour: p.colour, team: p.team, points: this.points[p.id] ?? 0 }))
      .sort((a, b) => b.points - a.points);
  }
}
