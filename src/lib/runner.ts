// A round as this page plays it: the round's timeline (shared/timeline.mjs) on a clock. Online the
// clock is the server's (src/lib/clock.ts): frame 0 is at the server time the round's start named,
// and the current frame comes from the clock, never from counting. On the shared keyboard the clock
// is the page's own. Every animation frame simulates up to the clock (rewinding first when a late
// action came in), and the events since are handed out once each, even when a rewind simulated
// them again: a crash's sound and burst, a powerup's, the scoreboard's turn to look again.

import { Timeline } from '../../shared/timeline.mjs';
import { SUBS, NET } from '../../shared/protocol.mjs';

export type Action = { player: number; num: number; frame: number; sub: number; dir: number; press: number };
export type RoundEvent = { e: string; k: number; [key: string]: any };
export type Board = {
  type: 'ffa' | 'teams';
  target: number;
  teamTarget: number;
  phase: string;
  points: Record<string, number>;
  teamWins: Record<string, number>;
  alive: Set<string>;
};

/** Events that happen once per thing, keyed so a rewind that simulates them again doesn't repeat them. */
function keyOf(e: RoundEvent) {
  switch (e.e) {
    case 'die':
    case 'spawn':
      return `${e.e}:${e.cid}`;
    case 'pu+':
    case 'pu-':
      return `${e.e}:${e.id}`;
    case 'phase':
      return `phase:${e.p}`;
    case 'done':
      return 'done';
    default:
      return `${e.e}:${e.k}`;
  }
}

export class RoundRunner {
  tl: any;
  start: any;
  /** The players this page steers (the shared keyboard steers several). */
  own: Set<number>;
  /** ms added to the clock when showing: watchers see the game NET.watch behind, so it never jumps. */
  shift: number;
  private zero: () => number;
  private presented = new Set<string>();
  private listeners = new Set<(e: RoundEvent) => void>();
  private stamps = new Map<number, [number, number]>();

  /** zero: the page's clock time (performance.now()) of frame 0; a function, as the clock is refined. */
  constructor(start: any, zero: () => number, opts: { own?: number[]; shift?: number } = {}) {
    this.start = start;
    this.tl = new Timeline(start);
    this.zero = zero;
    this.own = new Set(opts.own ?? []);
    this.shift = opts.shift ?? 0;
  }

  get round() {
    return this.tl.round;
  }
  get frameMs(): number {
    return this.tl.round.frameMs;
  }
  get no(): number {
    return this.start.no;
  }

  /** The frame being shown, fractional. */
  frameAt(now: number) {
    return (now - this.zero() + this.shift) / this.frameMs;
  }

  /** Simulates up to the clock and hands out the new events. */
  tick(now: number) {
    const T = this.frameAt(now);
    if (T > 0) this.tl.advanceTo(Math.floor(T));
    for (const e of this.tl.takeEvents() as RoundEvent[]) {
      const key = keyOf(e);
      if (this.presented.has(key)) continue;
      this.presented.add(key);
      for (const fn of this.listeners) fn(e);
    }
    return T;
  }

  on(fn: (e: RoundEvent) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * A steering change on this page, now: stamped with the frame and the moment within it (never
   * before this player's last one, should the clock have been corrected backwards), into the
   * timeline at once (it shows on the next frame), and returned to be sent.
   */
  local(player: number, dir: number, press: number, num: number, now = performance.now()): Action {
    const T = Math.max(0, (now - this.zero() + NET.inputShift) / this.frameMs);
    let frame = Math.floor(T);
    let sub = Math.min(SUBS - 1, Math.floor((T - frame) * SUBS));
    const last = this.stamps.get(player);
    if (last && (frame < last[0] || (frame === last[0] && sub < last[1]))) [frame, sub] = last;
    this.stamps.set(player, [frame, sub]);
    const a: Action = { player, num, frame, sub, dir, press };
    this.tl.add(a);
    return a;
  }

  /** Another player's action (the server relayed it). */
  insert(a: Action) {
    this.tl.add(a);
  }

  remove(player: number, num: number) {
    return this.tl.remove(player, num);
  }

  /** The server's word: this player is out at this frame. */
  kill(frame: number, player: number) {
    this.tl.kill(frame, player);
  }

  /** The direction this player's actions end on so far. */
  lastDir(player: number): number {
    return this.tl.lastDir(player);
  }

  /** The actions of a frame (the one being lived: drawing the heads between frames). */
  actionsAt(frame: number): Action[] {
    return this.tl.actionsAt(frame);
  }

  /** Takes the earliest frame rewound to since the last call (Infinity: none). */
  takeRewound(): number {
    return this.tl.takeRewound();
  }

  playerOf(id: string) {
    return this.start.players.findIndex((p: any) => p.id === id);
  }

  /** What the board beside the field shows: the points so far (this round's included). */
  board(): Board {
    const r = this.round;
    const s = r.s;
    const points: Record<string, number> = {};
    const alive = new Set<string>();
    this.start.players.forEach((p: any, i: number) => {
      points[p.id] = (this.start.points[p.id] ?? 0) + s.gains[i];
      if (r.playerAlive(i)) alive.add(p.id);
    });
    const teamWins: Record<string, number> = { ...this.start.teamWins };
    if (this.start.type === 'teams' && s.winner !== null && (s.phase === 'linger' || s.phase === 'done')) {
      teamWins[s.winner] = (teamWins[s.winner] ?? 0) + 1;
    }
    return { type: this.start.type, target: this.start.target, teamTarget: this.start.teamTarget, phase: s.phase, points, teamWins, alive };
  }

  /** A player's running effects with the seconds left, at frame T. */
  effectsOf(player: number, T: number): { kind: string; left: number }[] {
    const c = this.round.s.curves.find((x: any) => x.alive && x.p === player);
    if (!c) return [];
    return c.effects.map((e: any) => ({ kind: e.kind as string, left: Math.max(0, (e.until - T) / this.round.rate) }));
  }
}
