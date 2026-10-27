// The game: one deterministic simulation in fixed frames, run the same way by every page and by the
// server (development/plans/curveextreme.md, "Netcode"). Given the same round start and the same
// steering actions at the same moments, every copy ends in the same state to the last bit: the
// random numbers come from the round's seed, the maths from dmath.mjs, nothing reads a clock.
//
// A Round is one round of curves: Round.step(actions) simulates one frame, applying each player's
// steering changes at the moment within the frame they happened (`sub`, thousandths of a frame), so
// a quick tap is as precise as the clock. save() and restore() let a page rewind and simulate again
// when another player's action arrives late (timeline.mjs). A Match strings rounds together: the
// points, the team wins, the target, the winner. Every number comes from the feel profile
// (feel.mjs), the powerup table (powerups.mjs) and the mode (modes.mjs).

import { POWERUPS, ACTIONS } from './powerups.mjs';
import { SUBS } from './protocol.mjs';
import { sin, cos, norm, dist2, TAU, PI, HALF_PI } from './dmath.mjs';
import { ARENA_NUMBERS, DEFAULT_ARENA, Floor, arenaField, bounceOffPillars, cleanArena, furnish, hitsPillar, patchAt } from './arenas.mjs';

/** The classic target: 10 points per opponent. */
export const targetFor = (players) => 10 * Math.max(1, players - 1);

/** A curve's numbers for a frame, from its running effects. */
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

/**
 * Moves a curve ({ x, y, a }) along its exact arc for t seconds: dir −1 left, 0 straight, 1 right
 * (screen y points down, so a growing angle turns right). Corner turns only on presses, so it goes
 * straight here. Returns the distance. Splitting t anywhere lands on the same point.
 */
export function arc(c, m, dir, t) {
  let d = m.reverse ? -dir : dir;
  if (m.finger && d !== m.finger) d = 0;
  if (m.corner) d = 0;
  const len = m.v * t;
  if (!d) {
    c.x += cos(c.a) * len;
    c.y += sin(c.a) * len;
    return len;
  }
  const om = (d * m.v) / m.r;
  const a1 = c.a + om * t;
  c.x += ((sin(a1) - sin(c.a)) * m.v) / om;
  c.y -= ((cos(a1) - cos(c.a)) * m.v) / om;
  c.a = a1;
  return len;
}

/** A Corner press: a right angle at once. */
export function cornerTurn(c, m, press) {
  const p = m.reverse ? -press : press;
  if (m.finger && p !== m.finger) return;
  c.a += p * HALF_PI;
}

/** Through an open wall to the other side. Returns true if the curve went through. */
export function wrapInto(c, rect) {
  const w = rect.x1 - rect.x0, h = rect.y1 - rect.y0;
  let jumped = false;
  if (c.x < rect.x0) { c.x += w; jumped = true; } else if (c.x > rect.x1) { c.x -= w; jumped = true; }
  if (c.y < rect.y0) { c.y += h; jumped = true; } else if (c.y > rect.y1) { c.y -= h; jumped = true; }
  return jumped;
}

/** The walls' scale at frame k (fractional too): 1, or less while Closing Walls shrinks the floor. */
export function wallScale(walls, k) {
  if (!walls.closing) return walls.scale;
  const { s0, s1, k0, k1 } = walls.closing;
  const t = Math.min(1, Math.max(0, (k - k0) / Math.max(1, k1 - k0)));
  return s0 + (s1 - s0) * t;
}

const CELL = 12;
const cellKey = (gx, gy) => gx * 8192 + gy;
const TRAIL_FIELDS = ['x', 'y', 'px', 'py', 'r', 's', 'l', 'cid', 'p', 'f', 'key'];

/**
 * Does a head (centre hx, hy, hit radius hr) touch a drawn piece of line from (ax, ay) to (bx, by),
 * half its width pr? The piece is what the page draws: a band with square ends, so a gap is exactly
 * as wide for the engine as it looks (the head's hit size is the only allowance). Plain arithmetic,
 * no square root: the same bits in every engine.
 */
export function touchesPiece(hx, hy, hr, ax, ay, bx, by, pr) {
  const sx = bx - ax, sy = by - ay;
  const L2 = sx * sx + sy * sy;
  if (L2 === 0) return false;
  const vx = hx - ax, vy = hy - ay;
  const along = vx * sx + vy * sy; // how far along the piece, × its length
  const across = vx * sy - vy * sx; // how far beside its middle, × its length
  let du2 = 0; // past an end, squared
  if (along < 0) du2 = (along * along) / L2;
  else if (along > L2) du2 = ((along - L2) * (along - L2)) / L2;
  const hr2 = hr * hr;
  if (du2 >= hr2) return false;
  const v2 = (across * across) / L2;
  const pr2 = pr * pr;
  if (v2 <= pr2) return true;
  // beside the band: (|v| − pr)² + du² < hr², squared once more instead of a root
  const q = hr2 - du2;
  const a = v2 + pr2 - q;
  return a < 0 || a * a < 4 * pr2 * v2;
}

/**
 * The lines so far: one point per drawn frame (the piece from px, py to x, y, half-width r, length
 * l), with the curve, the player, the frame and the grid cell it's filed in. Points only ever get added at the end, so
 * rewinding cuts the arrays back; an eraser starts a new trail object and leaves the old one as it
 * was for the snapshots that still point at it.
 */
function newTrail() {
  const t = { grid: new Map() };
  for (const f of TRAIL_FIELDS) t[f] = [];
  return t;
}

function cutTrail(t, len) {
  for (let i = t.x.length - 1; i >= len; i--) {
    const bucket = t.grid.get(t.key[i]);
    bucket.pop(); // the newest point is always its cell's last
    if (!bucket.length) t.grid.delete(t.key[i]);
  }
  for (const f of TRAIL_FIELDS) t[f].length = len;
}

const cloneCurve = (c) => ({ ...c, effects: c.effects.map((e) => ({ ...e })) });

/** A copy of the state that shares nothing that changes (the trail is shared: it's cut back instead). */
function copyState(s) {
  return {
    ...s,
    dir: s.dir.slice(),
    curves: s.curves.map(cloneCurve),
    powerups: s.powerups.map((p) => ({ ...p })),
    zones: s.zones.map((z) => ({ ...z })),
    walls: { ...s.walls },
    gains: s.gains.slice(),
    deadAt: s.deadAt.slice(),
    gaps: s.gaps.slice(),
    dist: s.dist.slice(),
  };
}

/**
 * One round. `start` (Match.nextRound): { no, seed, W, H, feel, mode: { rate, powerups }, arena,
 * type, players: [{ id, team }], points, teamWins, target, teamTarget }. Players are numbered by
 * their place in `players`; actions name them by that number.
 */
export class Round {
  constructor(start) {
    this.start = start;
    const feel = (this.feel = start.feel);
    this.mode = start.mode;
    this.W = start.W;
    this.H = start.H;
    this.rate = feel.tickRate;
    this.dt = 1 / this.rate;
    this.frameMs = 1000 / this.rate;
    this.n = start.players.length;
    this.teams = start.type === 'teams';
    this.team = start.players.map((p) => p.team ?? 0);
    this.stillK = Math.round(feel.stillTime * this.rate);
    this.freeK = Math.round((feel.stillTime + feel.freeTime) * this.rate);
    this.lingerK = Math.round(feel.lingerTime * this.rate);
    this.kinds = start.mode.powerups.filter((kind) => POWERUPS[kind]);
    this.weights = this.kinds.reduce((sum, kind) => sum + POWERUPS[kind].weight, 0);
    const meanFrames = (feel.powerupEvery / Math.max(0.05, start.mode.rate)) * this.rate;
    this.spawnChance = 1 / Math.max(1, meanFrames);
    const n = this.n;
    this.s = {
      k: 0, // frames simulated so far; the next step simulates frame k
      phase: 'still',
      rand: start.seed >>> 0,
      ids: 1,
      dir: new Array(n).fill(0),
      curves: [],
      powerups: [],
      zones: [],
      walls: { scale: 1, closing: null },
      movingUntil: 0,
      darkUntil: 0,
      lingerUntil: 0,
      winner: null, // the round's: a player's number, a team's number, or null
      gains: new Array(n).fill(0), // points this round
      deadAt: new Array(n).fill(-1),
      gaps: new Array(n).fill(0),
      dist: new Array(n).fill(0),
      trail: newTrail(),
    };
    // the arena: its floor, and the pillars and patches on it (from the seed, before the spawns)
    this.arena = cleanArena(start.arena ?? DEFAULT_ARENA);
    this.floor = new Floor(this.arena, this.W, this.H);
    const things = furnish(this.arena, this.floor, n, () => this.rand());
    this.pillars = things.pillars;
    this.patches = things.patches;
    // spawns: a margin from the walls, on the floor and clear of the pillars, apart from each other,
    // random headings
    const m = feel.spawnMargin, W = this.W, H = this.H;
    const edge = (m * Math.min(W, H)) / 2;
    for (let p = 0; p < n; p++) {
      let x = 0, y = 0;
      for (let tries = 0; tries < 40; tries++) {
        x = W * m + this.rand() * W * (1 - 2 * m);
        y = H * m + this.rand() * H * (1 - 2 * m);
        if (!this.floor.inside(x, y, edge)) continue;
        if (hitsPillar(this.pillars, x, y, ARENA_NUMBERS.pillarClear)) continue;
        if (this.s.curves.every((c) => dist2(c.x, c.y, x, y) >= feel.spawnApart * feel.spawnApart)) break;
      }
      this.s.curves.push(this.newCurve(p, x, y, this.rand() * TAU - PI));
    }
  }

  /** mulberry32, its state in the snapshot. */
  rand() {
    const s = this.s;
    s.rand = (s.rand + 0x6d2b79f5) | 0;
    let t = Math.imul(s.rand ^ (s.rand >>> 15), 1 | s.rand);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  newCurve(p, x, y, a) {
    return { id: this.s.ids++, p, x, y, a, alive: true, s: 0, lineFrom: 0, gapLeft: 0, effects: [], jump: false, immuneUntil: 0 };
  }

  get k() {
    return this.s.k;
  }
  get phase() {
    return this.s.phase;
  }
  get trail() {
    return this.s.trail;
  }

  /**
   * A curve's numbers now: its effects, the warm-up (moving without a line, the turn is tighter by
   * feel.freeTurn) and the patch it's on (ice turns wider, mud is slower).
   */
  motion(c) {
    const m = motionOf(c.effects, this.feel);
    // by the frame, not the phase, so the head drawn between frames turns as the next step will
    if (this.s.k >= this.stillK && this.s.k < this.freeK) m.r *= this.feel.freeTurn ?? 1;
    if (this.patches.length) {
      const p = patchAt(this.patches, c.x, c.y);
      if (p?.kind === 'ice') m.r *= ARENA_NUMBERS.ice.radius;
      else if (p?.kind === 'mud') m.v *= ARENA_NUMBERS.mud.speed;
    }
    return m;
  }

  /** The walls' scale at frame k. */
  scaleAt(k) {
    return wallScale(this.s.walls, k);
  }

  /** The floor's bounding box at frame k. */
  rectAt(k) {
    return this.floor.rect(this.scaleAt(k));
  }

  /**
   * Through an open wall: on the square to the other side (the reference's), on the other shapes to
   * the point across the middle from where the curve left (each shape is symmetric about its
   * middle, and the heading that pointed out points in there). Returns true if it went through.
   */
  wrap(c, px, py, scale) {
    const f = this.floor;
    if (f.shape === 'square') return wrapInto(c, f.rect(scale));
    if (f.inside(c.x, c.y, 0, scale)) return false;
    const x = 2 * f.cx - px, y = 2 * f.cy - py;
    if (!f.inside(x, y, 0, scale)) return false;
    c.x = x;
    c.y = y;
    return true;
  }

  /** The warm-up's walls and pillars: the head (its drawn edge, `margin` from its middle) bounces off. */
  bounce(c, px, py, margin, scale) {
    this.floor.bounce(c, px, py, margin, scale);
    if (this.pillars.length) bounceOffPillars(this.pillars, c, px, py, margin);
  }

  /** A player is in the round while one of their curves is. */
  playerAlive(p) {
    return this.s.curves.some((c) => c.alive && c.p === p);
  }

  aliveSet() {
    const out = new Set();
    for (const c of this.s.curves) if (c.alive) out.add(c.p);
    return out;
  }

  save() {
    return { ...copyState(this.s), len: this.s.trail.x.length };
  }

  restore(snap) {
    const { len, ...state } = snap;
    this.s = copyState(state);
    cutTrail(this.s.trail, len);
  }

  /**
   * One frame. actions: this frame's steering changes, [{ player, sub, dir, press }] in the order
   * they happened; kills: players the server says are out at this frame (its word decides).
   * Returns the frame's events.
   */
  step(actions = [], kills = []) {
    const s = this.s;
    const feel = this.feel;
    const k = s.k;
    const ev = [];
    if (s.phase === 'done') {
      s.k++;
      return ev;
    }

    if (s.phase === 'still' && k >= this.stillK) {
      s.phase = 'free';
      ev.push({ e: 'phase', p: 'free' });
    }
    if (s.phase === 'free' && k >= this.freeK) {
      s.phase = 'draw';
      ev.push({ e: 'phase', p: 'draw' });
    }

    // effects and zones run out
    for (const c of s.curves) if (c.effects.length) c.effects = c.effects.filter((e) => e.until > k);
    if (s.zones.length) s.zones = s.zones.filter((z) => z.until > k);
    const scale = this.scaleAt(k);
    const rect = this.floor.rect(scale);

    // each player's actions this frame
    const mine = new Array(this.n);
    for (const a of actions) (mine[a.player] ??= []).push(a);

    const aliveBefore = this.aliveSet();
    if (s.phase !== 'still') {
      // every curve moves and draws its new piece first, then every head is checked against the
      // lines as they are now: two heads reaching one spot in one frame both meet the other's newest
      // piece, whoever comes first in the list of players
      const moved = [];
      for (const c of s.curves) {
        if (!c.alive) continue;
        const mv = this.move(c, mine[c.p] ?? [], scale, k, ev);
        if (mv) moved.push(mv);
      }
      for (const mv of moved) if (mv.draw) this.addPoint(mv.c, mv.m, mv.px, mv.py, k, mv.len);
      for (const mv of moved) this.collide(mv, scale, k, ev);
      for (const mv of moved) if (mv.c.alive) this.pickups(mv.c, mv.m, k, ev);
    }
    for (let p = 0; p < this.n; p++) {
      const list = mine[p];
      if (list?.length) s.dir[p] = list[list.length - 1].dir;
    }
    for (const p of kills) {
      for (const c of s.curves) {
        if (!c.alive || c.p !== p) continue;
        c.alive = false;
        ev.push({ e: 'die', cid: c.id, p, x: c.x, y: c.y, by: null });
      }
    }

    // points: everyone still in scores for each player out this frame
    if (s.phase === 'draw') {
      const alive = this.aliveSet();
      const died = [...aliveBefore].filter((p) => !alive.has(p));
      if (died.length) {
        for (const d of died) {
          s.deadAt[d] = k;
          for (const q of alive) {
            if (this.teams && this.team[q] === this.team[d]) continue;
            s.gains[q] += 1;
          }
        }
        ev.push({ e: 'score', died });
      }
      this.decide(alive, k, ev);
    } else if (s.phase === 'linger' && k >= s.lingerUntil) {
      s.phase = 'done';
      ev.push({ e: 'done', winner: s.winner });
    }

    // powerups: spawn, drift
    if (s.phase === 'draw' && this.kinds.length && this.rand() < this.spawnChance) this.spawn(k, rect, ev);
    if (k < s.movingUntil && s.powerups.length) {
      const speed = ACTIONS.moving.speed * this.dt;
      const pr = feel.powerupRadius;
      const plain = this.floor.shape === 'square' && !this.pillars.length;
      for (const p of s.powerups) {
        p.x += p.vx * speed;
        p.y += p.vy * speed;
        if (plain) {
          if (p.x < rect.x0 + pr || p.x > rect.x1 - pr) p.vx *= -1;
          if (p.y < rect.y0 + pr || p.y > rect.y1 - pr) p.vy *= -1;
          p.x = Math.min(rect.x1 - pr, Math.max(rect.x0 + pr, p.x));
          p.y = Math.min(rect.y1 - pr, Math.max(rect.y0 + pr, p.y));
        } else if (!this.floor.inside(p.x, p.y, pr, scale) || hitsPillar(this.pillars, p.x, p.y, pr)) {
          // off the floor or into a pillar: back, and the other way
          p.x -= p.vx * speed;
          p.y -= p.vy * speed;
          p.vx *= -1;
          p.vy *= -1;
        }
      }
    }

    s.k = k + 1;
    return ev;
  }

  /**
   * One curve through one frame: steer (piece by piece between the actions), wrap, gap. Returns what
   * the frame did for the lines and collisions to use, or null while there are none (the free phase).
   */
  move(c, acts, scale, k, ev) {
    const s = this.s;
    const feel = this.feel;
    const m = this.motion(c);
    const px = c.x, py = c.y;
    let dir = s.dir[c.p], t = 0, len = 0;
    for (const a of acts) {
      const at = (a.sub / SUBS) * this.dt;
      if (at > t) {
        len += arc(c, m, dir, at - t);
        t = at;
      }
      dir = a.dir;
      if (a.press && m.corner) cornerTurn(c, m, a.press);
    }
    len += arc(c, m, dir, this.dt - t);
    c.a = norm(c.a);
    c.s += len;
    let jump = c.jump;
    c.jump = false;

    if (s.phase === 'free') {
      const walls = feel.freeWalls ?? 'bounce';
      if (walls === 'bounce') this.bounce(c, px, py, m.w / 2, scale);
      if (walls === 'wrap' && this.wrap(c, px, py, scale)) jump = true;
      if (walls === 'solid' && (!this.floor.inside(c.x, c.y, 0, scale) || hitsPillar(this.pillars, c.x, c.y, 0))) {
        c.alive = false;
        ev.push({ e: 'die', cid: c.id, p: c.p, x: c.x, y: c.y, by: null });
      }
      return null;
    }
    s.dist[c.p] += len;
    if (m.wrap && this.wrap(c, px, py, scale)) jump = true;

    // gaps: a memoryless chance per unit of line, after the shortest line
    let draw = true;
    if (c.gapLeft > 0) {
      c.gapLeft -= len;
      draw = false;
      if (c.gapLeft <= 0) c.lineFrom = c.s;
    } else if (c.s - c.lineFrom >= feel.gapMin && this.rand() < (len * m.gapRate) / Math.max(1, feel.gapMean - feel.gapMin)) {
      c.gapLeft = m.gapLen;
      s.gaps[c.p] += 1;
      draw = false;
    }
    const safe = s.zones.some((z) => dist2(c.x, c.y, z.x, z.y) < z.r * z.r);
    if (m.fly || safe) draw = false;
    return { c, m, px, py, len, draw: draw && !jump, safe };
  }

  /** A head against the walls, the pillars and every line as drawn (its own neck aside). */
  collide(mv, scale, k, ev) {
    const { c, m, len, safe } = mv;
    if (safe) return;
    const hr = m.hit / 2;
    let dead = false, by = null;
    if (!m.wrap && !this.floor.inside(c.x, c.y, hr, scale)) dead = true;
    else if (this.pillars.length && hitsPillar(this.pillars, c.x, c.y, hr)) dead = true;
    else if (!m.fly) {
      const hit = this.hitLine(c, hr, len, k);
      if (hit >= 0) {
        dead = true;
        by = this.s.trail.p[hit];
      }
    }
    if (!dead) return;
    c.alive = false;
    ev.push({ e: 'die', cid: c.id, p: c.p, x: c.x, y: c.y, by: by !== null && by !== c.p ? by : null });
  }

  /** Is the round decided? FFA: one player (or none) left; teams: one team left. */
  decide(alive, k, ev) {
    const s = this.s;
    let decided = false, winner = null;
    if (this.teams) {
      const teams = new Set([...alive].map((p) => this.team[p]));
      if (teams.size <= 1) {
        decided = true;
        winner = teams.size ? [...teams][0] : null;
      }
    } else if (this.n >= 2 ? alive.size <= 1 : alive.size === 0) {
      decided = true;
      winner = this.n >= 2 && alive.size ? [...alive][0] : null;
    }
    if (!decided) return;
    s.phase = 'linger';
    s.winner = winner;
    s.lingerUntil = k + this.lingerK;
    ev.push({ e: 'phase', p: 'linger', winner });
  }

  addPoint(c, m, px, py, k, len) {
    const t = this.s.trail;
    const i = t.x.length;
    const key = cellKey(Math.floor(c.x / CELL), Math.floor(c.y / CELL));
    t.x.push(c.x); t.y.push(c.y); t.px.push(px); t.py.push(py); t.r.push(m.w / 2); t.s.push(c.s); t.l.push(len);
    t.cid.push(c.id); t.p.push(c.p); t.f.push(k); t.key.push(key);
    let bucket = t.grid.get(key);
    if (!bucket) t.grid.set(key, (bucket = []));
    bucket.push(i);
  }

  /** The index of the piece of line the head touches, or −1. */
  hitLine(c, hr, len, k) {
    const t = this.s.trail;
    const reach = hr + 24; // a piece is filed by its end; its start lies up to a piece's length back
    const x0 = Math.floor((c.x - reach) / CELL), x1 = Math.floor((c.x + reach) / CELL);
    const y0 = Math.floor((c.y - reach) / CELL), y1 = Math.floor((c.y + reach) / CELL);
    for (let gx = x0; gx <= x1; gx++) {
      for (let gy = y0; gy <= y1; gy++) {
        const bucket = t.grid.get(cellKey(gx, gy));
        if (!bucket) continue;
        for (const i of bucket) {
          const pr = t.r[i];
          // our own neck: the pieces drawn just now, measured from where each one starts
          if (t.cid[i] === c.id && c.s - (t.s[i] - t.l[i]) < (hr + pr) * 1.5 + len) continue;
          if (t.p[i] === c.p && k < c.immuneUntil) continue; // just split
          if (touchesPiece(c.x, c.y, hr, t.px[i], t.py[i], t.x[i], t.y[i], pr)) return i;
        }
      }
    }
    return -1;
  }

  spawn(k, rect, ev) {
    const s = this.s;
    if (s.powerups.length >= this.feel.powerupMax) return;
    let pick = this.rand() * this.weights, kind = this.kinds[0];
    for (const kd of this.kinds) {
      pick -= POWERUPS[kd].weight;
      if (pick < 0) {
        kind = kd;
        break;
      }
    }
    // a spot on the floor and clear of the pillars, the whole disc; away from the heads and the other
    // discs if one turns up. Never a spot that failed: none free means no powerup this time.
    const pr = this.feel.powerupRadius + 4;
    const apart = 4 * this.feel.powerupRadius * this.feel.powerupRadius;
    const scale = this.scaleAt(k);
    let spot = null, free = null;
    for (let tries = 0; tries < 20; tries++) {
      const x = rect.x0 + pr + this.rand() * Math.max(1, rect.x1 - rect.x0 - 2 * pr);
      const y = rect.y0 + pr + this.rand() * Math.max(1, rect.y1 - rect.y0 - 2 * pr);
      if (!this.floor.inside(x, y, pr, scale) || hitsPillar(this.pillars, x, y, pr)) continue;
      free ??= { x, y };
      if (s.curves.every((c) => !c.alive || dist2(c.x, c.y, x, y) > 1600) && s.powerups.every((q) => dist2(q.x, q.y, x, y) > apart)) {
        spot = { x, y };
        break;
      }
    }
    spot ??= free;
    if (!spot) return;
    const { x, y } = spot;
    const p = { id: s.ids++, kind, x, y, vx: 0, vy: 0 };
    if (k < s.movingUntil) this.drift(p);
    s.powerups.push(p);
    ev.push({ e: 'pu+', id: p.id, kind, x, y });
  }

  drift(p) {
    const a = this.rand() * TAU;
    p.vx = cos(a);
    p.vy = sin(a);
  }

  pickups(c, m, k, ev) {
    const s = this.s;
    if (!s.powerups.length) return;
    const reach = this.feel.powerupRadius + m.hit / 2;
    for (let i = s.powerups.length - 1; i >= 0; i--) {
      const p = s.powerups[i];
      if (dist2(p.x, p.y, c.x, c.y) > reach * reach) continue;
      s.powerups.splice(i, 1);
      ev.push({ e: 'pu-', id: p.id, cid: c.id, p: c.p, kind: p.kind });
      this.apply(p, c, k, ev);
    }
  }

  /** A powerup's effect: on you (green), your opponents (red) or everyone (blue). */
  apply(pu, c, k, ev) {
    const s = this.s;
    const P = POWERUPS[pu.kind];
    const until = k + Math.round(P.dur * this.rate);
    if (P.action) return this.act(P.action, pu, c, until, k, ev);
    const targets = s.curves.filter((t) => {
      if (!t.alive) return false;
      if (P.colour === 'green') return t.p === c.p;
      if (P.colour === 'red') return this.teams ? this.team[t.p] !== this.team[c.p] : t.p !== c.p;
      return true;
    });
    for (const t of targets) t.effects.push({ kind: pu.kind, until, side: P.flags?.finger ? (this.rand() < 0.5 ? -1 : 1) : 0 });
  }

  act(action, pu, c, until, k, ev) {
    const s = this.s;
    switch (action) {
      case 'eraseAll':
        s.trail = newTrail();
        ev.push({ e: 'erase', p: null });
        break;
      case 'eraseOwn':
        s.trail = this.trailWithout(c.p);
        ev.push({ e: 'erase', p: c.p });
        break;
      case 'switch': {
        const alive = s.curves.filter((t) => t.alive);
        if (alive.length < 2) break;
        const spots = alive.map((t) => ({ x: t.x, y: t.y, a: t.a }));
        const order = alive.map((_, i) => i);
        for (let tries = 0; tries < 20; tries++) {
          for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(this.rand() * (i + 1));
            [order[i], order[j]] = [order[j], order[i]];
          }
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
        const immune = k + Math.round(ACTIONS.splitImmune * this.rate);
        c.immuneUntil = immune;
        for (const side of [-1, 1]) {
          const n = this.newCurve(c.p, c.x, c.y, norm(c.a + side * spread));
          Object.assign(n, { s: c.s, lineFrom: c.s, effects: c.effects.map((e) => ({ ...e })), immuneUntil: immune });
          s.curves.push(n);
          ev.push({ e: 'spawn', cid: n.id, p: n.p });
        }
        break;
      }
      case 'noDraw':
        s.zones.push({ id: s.ids++, x: pu.x, y: pu.y, r: ACTIONS.noDraw.radius, until });
        break;
      case 'closeWalls': {
        const s0 = this.scaleAt(k);
        s.walls = { scale: 1, closing: { s0, s1: s0 * ACTIONS.closeWalls.to, k0: k, k1: k + Math.round(ACTIONS.closeWalls.seconds * this.rate) } };
        break;
      }
      case 'moving':
        s.movingUntil = until;
        for (const q of s.powerups) this.drift(q);
        break;
      case 'darkness':
        s.darkUntil = until;
        break;
    }
  }

  /** A new trail with one player's lines taken out (Green Eraser). */
  trailWithout(p) {
    const old = this.s.trail;
    const t = newTrail();
    for (let i = 0; i < old.x.length; i++) {
      if (old.p[i] === p) continue;
      const j = t.x.length;
      for (const f of TRAIL_FIELDS) t[f].push(old[f][i]);
      let bucket = t.grid.get(old.key[i]);
      if (!bucket) t.grid.set(old.key[i], (bucket = []));
      bucket.push(j);
    }
    return t;
  }

  /**
   * Where a curve's head is a fraction `frac` (0…1) into the frame being lived, with that frame's
   * actions known so far: drawing between frames with the same arcs the next step will take.
   */
  headAt(c, frac, acts = []) {
    const h = { x: c.x, y: c.y, a: c.a };
    const s = this.s;
    if (!c.alive || s.phase === 'done' || s.k < this.stillK) return h;
    const m = this.motion(c);
    const end = frac * this.dt;
    let dir = s.dir[c.p], t = 0;
    for (const a of acts) {
      if (a.player !== c.p) continue;
      const at = (a.sub / SUBS) * this.dt;
      if (at >= end) break;
      if (at > t) {
        arc(h, m, dir, at - t);
        t = at;
      }
      dir = a.dir;
      if (a.press && m.corner) cornerTurn(h, m, a.press);
    }
    if (end > t) arc(h, m, dir, end - t);
    // in the warm-up drawn off the wall as the step will bounce it, not through it for a frame
    if (s.k < this.freeK && (this.feel.freeWalls ?? 'bounce') === 'bounce') this.bounce(h, c.x, c.y, m.w / 2, this.scaleAt(s.k));
    return h;
  }

  /** The round's outcome for the Match: the points won by player id, the winner, who was out when. */
  result() {
    const s = this.s;
    const ids = this.start.players.map((p) => p.id);
    return {
      gains: Object.fromEntries(ids.map((id, i) => [id, s.gains[i]])),
      winner: s.winner === null ? null : this.teams ? s.winner : ids[s.winner],
      deadAt: Object.fromEntries(ids.map((id, i) => [id, s.deadAt[i]])),
    };
  }

  /** A fingerprint of the whole state, exact to the last bit (tests/determinism). */
  hash() {
    const s = this.s;
    const t = s.trail;
    const parts = [
      s.k, s.phase, s.rand, s.ids, s.dir.join(','), s.gains.join(','), s.deadAt.join(','), s.winner,
      s.curves.map((c) => [c.id, c.p, c.x, c.y, c.a, c.alive, c.s, c.gapLeft, c.effects.map((e) => e.kind + e.until).join('+')].join(':')).join('|'),
      s.powerups.map((p) => [p.id, p.kind, p.x, p.y].join(':')).join('|'),
      t.x.length, t.x[t.x.length - 1], t.y[t.y.length - 1],
    ];
    let h = 0x811c9dc5;
    const str = parts.join('#');
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
    return (h >>> 0).toString(16);
  }
}

/** Rounds strung together: the points and team wins, the target, the winner. */
export class Match {
  /**
   * @param {{ players: {id:string,name:string,colour:string,team?:number}[], rules?: object,
   *   feel: object, mode: { rate:number, powerups:string[] }, arena?: object, seed?: number }} o
   */
  constructor({ players, rules = {}, feel, mode, arena = DEFAULT_ARENA, seed = 1 }) {
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
    this.arena = cleanArena(arena);
    this.seed = seed >>> 0;
    this.points = Object.fromEntries(this.players.map((p) => [p.id, 0]));
    this.teamWins = {};
    if (this.rules.type === 'teams') for (const p of this.players) this.teamWins[p.team] = 0;
    this.roundNo = 0;
    this.over = false;
    this.winner = null;
  }

  /** For the next round: a new feel, mode or arena (the Tune panel, the host's settings). */
  retune({ feel, mode, arena } = {}) {
    if (feel) this.feel = feel;
    if (mode) this.mode = mode;
    if (arena) this.arena = cleanArena(arena);
  }

  /** The next round's start: everything a page needs to simulate it, the seed included. */
  nextRound() {
    this.roundNo++;
    const [W, H] = arenaField(this.feel, this.players.length, this.arena);
    // each round its own seed, so a page joining later needs only that round's start
    this.seed = (Math.imul(this.seed ^ (this.seed >>> 16), 0x45d9f3b) + this.roundNo) >>> 0;
    return {
      no: this.roundNo,
      seed: this.seed,
      W, H,
      feel: this.feel,
      mode: { rate: this.mode.rate, powerups: [...this.mode.powerups] },
      arena: { ...this.arena },
      type: this.rules.type,
      players: this.players.map((p) => ({ id: p.id, team: p.team })),
      points: { ...this.points },
      teamWins: { ...this.teamWins },
      target: this.rules.target,
      teamTarget: this.rules.teamTarget,
    };
  }

  /** A round's outcome (Round.result()) into the points; decides the match. */
  applyRound(result) {
    for (const [id, n] of Object.entries(result.gains)) this.points[id] = (this.points[id] ?? 0) + n;
    if (this.rules.type === 'teams') {
      if (result.winner !== null) this.teamWins[result.winner] = (this.teamWins[result.winner] ?? 0) + 1;
      const best = Object.entries(this.teamWins).sort((a, b) => b[1] - a[1])[0];
      if (best && best[1] >= this.rules.teamTarget) {
        this.over = true;
        this.winner = Number(best[0]);
      }
    } else if (this.players.length >= 2) {
      const sorted = Object.entries(this.points).sort((a, b) => b[1] - a[1]);
      const [top, second] = sorted;
      if (top[1] >= this.rules.target && top[1] - (second?.[1] ?? 0) >= this.rules.winBy) {
        this.over = true;
        this.winner = top[0];
      }
    }
  }

  standings() {
    return this.players
      .map((p) => ({ id: p.id, name: p.name, colour: p.colour, team: p.team, points: this.points[p.id] ?? 0 }))
      .sort((a, b) => b.points - a.points);
  }
}
