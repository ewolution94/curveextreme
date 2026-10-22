// What a page knows about the round: fed by the server's messages (round, snap, s) in a room, or by
// the page's own Match on the shared keyboard. Each curve keeps its last ticks (to draw others a
// little in the past, smoothly) and its line pieces: drawn on the trail canvas once the shown time
// has passed them, the rest drawn live each frame.

import { wallsAt } from '../../shared/engine.mjs';

export type Motion = { v: number; r: number; w: number; hit: number; corner: boolean; reverse: boolean; finger: number; fly: boolean; wrap: boolean; fx: [string, number][] };
export type Tick = { k: number; x: number; y: number; a: number; bits: number; w: number };
export type Seg = { k: number; x1: number; y1: number; x2: number; y2: number; w: number };
export type Curve = {
  cid: number;
  pid: string;
  alive: boolean;
  hist: Tick[];
  m: Motion;
  segs: Seg[]; // on the trail canvas
  pending: Seg[]; // not yet
  diedAt: number;
};
export type Rect = { x0: number; y0: number; x1: number; y1: number };

export type WorldEvent = { e: string; [key: string]: any };

const KEEP = 24; // ticks of history per curve

export class World {
  W = 360;
  H = 360;
  rate = 50;
  dtMs = 20;
  no = 0;
  k = 0;
  arrival = 0; // when tick k arrived (performance.now())
  still = 125;
  free = 250;
  phase = 'still';
  feel: any = null;
  curves = new Map<number, Curve>();
  powerups = new Map<number, { id: number; kind: string; x: number; y: number }>();
  zones: { id: number; x: number; y: number; r: number; until: number }[] = [];
  walls: { rect: Rect; closing: null | { from: Rect; to: Rect; k0: number; k1: number } } = { rect: { x0: 0, y0: 0, x1: 360, y1: 360 }, closing: null };
  darkUntil = 0;
  movingUntil = 0;
  points: Record<string, number> = {};
  teamWins: Record<string, number> = {};
  target = 10;
  teamTarget = 10;
  type = 'ffa';
  winner: any = null;
  acks: Record<string, number> = {};
  /** Set when the trail canvas must be drawn again from scratch (a new round, an eraser). */
  redraw = true;
  listeners = new Set<(ev: WorldEvent, w: World) => void>();

  onEvent(fn: (ev: WorldEvent, w: World) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(ev: WorldEvent) {
    for (const fn of this.listeners) fn(ev, this);
  }

  /** A round starts: the field, the curves where they stand. */
  round(msg: any, now = performance.now()) {
    this.W = msg.W;
    this.H = msg.H;
    this.rate = msg.rate;
    this.dtMs = 1000 / msg.rate;
    this.no = msg.no;
    this.k = 0;
    this.arrival = now;
    this.still = msg.still;
    this.free = msg.free;
    this.phase = 'still';
    this.feel = msg.feel;
    this.points = { ...msg.points };
    this.teamWins = { ...msg.teamWins };
    this.target = msg.target;
    this.teamTarget = msg.teamTarget;
    this.type = msg.type;
    this.winner = null;
    this.curves.clear();
    this.powerups.clear();
    this.zones = [];
    this.walls = { rect: { x0: 0, y0: 0, x1: msg.W, y1: msg.H }, closing: null };
    this.darkUntil = 0;
    this.movingUntil = 0;
    for (const c of msg.curves) this.addCurve(c.cid, c.pid, c.x, c.y, c.a, c.m, 0, true);
    this.redraw = true;
    this.emit({ e: 'round', no: msg.no });
  }

  private addCurve(cid: number, pid: string, x: number, y: number, a: number, m: Motion, k: number, alive: boolean) {
    this.curves.set(cid, { cid, pid, alive, hist: [{ k, x, y, a, bits: 0, w: m.w }], m, segs: [], pending: [], diedAt: alive ? 0 : k });
  }

  /** Joining in the middle of a round: the lines so far. */
  snap(msg: any, now = performance.now()) {
    this.k = msg.k;
    this.arrival = now;
    this.phase = msg.phase;
    this.curves.clear();
    for (const c of msg.curves) {
      this.addCurve(c.cid, c.pid, c.x, c.y, c.a, c.m, msg.k, c.alive);
    }
    for (const [cid, w, pts] of msg.runs) {
      const c = this.curves.get(cid);
      if (!c) continue;
      for (let i = 2; i + 1 < pts.length; i += 2) c.segs.push({ k: msg.k, x1: pts[i - 2], y1: pts[i - 1], x2: pts[i], y2: pts[i + 1], w });
    }
    this.powerups.clear();
    for (const p of msg.powerups) this.powerups.set(p.id, p);
    this.zones = msg.zones;
    if (msg.walls) this.walls.closing = msg.walls;
    this.movingUntil = msg.movingUntil;
    this.darkUntil = msg.darkUntil;
    this.redraw = true;
  }

  /** One tick from the server (or the page's own match). */
  tick(msg: any, now = performance.now()) {
    if (msg.k <= this.k && this.k !== 0) return;
    this.k = msg.k;
    this.arrival = now;
    if (msg.a) this.acks = msg.a;
    const later: any[] = [];
    for (const ev of msg.e ?? []) {
      if (ev.e === 'fx') later.push(ev);
      else this.event(ev);
    }
    for (const [cid, x, y, a, bits, w] of msg.c) {
      const c = this.curves.get(cid);
      if (!c) continue;
      const prev = c.hist[c.hist.length - 1];
      c.hist.push({ k: msg.k, x, y, a, bits, w });
      if (c.hist.length > KEEP) c.hist.shift();
      if (bits & 1 && prev && !(bits & 2)) c.pending.push({ k: msg.k, x1: prev.x, y1: prev.y, x2: x, y2: y, w });
      if (bits & 4) {
        c.alive = false;
        c.diedAt = msg.k;
      }
    }
    if (msg.p) for (const [id, x, y] of msg.p) {
      const p = this.powerups.get(id);
      if (p) Object.assign(p, { x, y });
    }
    for (const ev of later) this.event(ev);
  }

  private event(ev: WorldEvent) {
    switch (ev.e) {
      case 'phase':
        this.phase = ev.p;
        if (ev.p === 'linger') this.winner = ev.winner;
        break;
      case 'score':
        this.points = ev.pts;
        break;
      case 'roundEnd':
        this.points = ev.points;
        this.teamWins = ev.teamWins;
        break;
      case 'pu+':
        this.powerups.set(ev.id, { id: ev.id, kind: ev.kind, x: ev.x, y: ev.y });
        break;
      case 'pu-':
        this.powerups.delete(ev.id);
        break;
      case 'fx': {
        const c = this.curves.get(ev.cid);
        if (c) c.m = ev.m;
        break;
      }
      case 'spawn':
        this.addCurve(ev.cid, ev.pid, ev.x, ev.y, ev.a, ev.m, this.k, true);
        break;
      case 'erase':
        for (const c of this.curves.values()) {
          if (ev.pid !== null && c.pid !== ev.pid) continue;
          c.segs = [];
          c.pending = [];
        }
        this.redraw = true;
        break;
      case 'zone':
        this.zones.push({ id: ev.id, x: ev.x, y: ev.y, r: ev.r, until: ev.until });
        break;
      case 'walls':
        this.walls.closing = { from: ev.from, to: ev.to, k0: ev.k0, k1: ev.k1 };
        break;
      case 'moving':
        this.movingUntil = ev.until;
        break;
      case 'dark':
        this.darkUntil = ev.until;
        break;
    }
    this.emit(ev);
  }

  /** The tick the server is at now, as a fraction (arrival time plus the time since). */
  liveTick(now: number) {
    return this.k + Math.min(4, (now - this.arrival) / this.dtMs);
  }

  rectAt(k: number): Rect {
    return wallsAt(this.walls, k);
  }

  /** A curve's position at a (fractional) tick from its history; the last one if past it. */
  at(c: Curve, t: number): { x: number; y: number; a: number; jumpAfter: boolean } {
    const h = c.hist;
    const last = h[h.length - 1];
    if (t >= last.k) return { x: last.x, y: last.y, a: last.a, jumpAfter: false };
    for (let i = h.length - 1; i > 0; i--) {
      const b = h[i], a = h[i - 1];
      if (a.k <= t) {
        if (b.bits & 2) return { x: a.x, y: a.y, a: a.a, jumpAfter: true };
        const f = (t - a.k) / Math.max(1, b.k - a.k);
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, a: b.a, jumpAfter: false };
      }
    }
    return { x: h[0].x, y: h[0].y, a: h[0].a, jumpAfter: false };
  }
}
