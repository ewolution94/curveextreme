// A round on a timeline: the Round (engine.mjs), every steering action filed under its frame, and a
// snapshot before each frame for the last few seconds. An action for a frame already simulated (a
// player whose action took a while to arrive) rewinds to the snapshot before it and simulates
// forward again: the simulation is deterministic, so the result is the same as if the action had
// been there all along. The page uses it for the game it shows (its own actions go in at once), the
// server for the game it referees, the shared keyboard for its game in the page.

import { Round } from './engine.mjs';
import { NET } from './protocol.mjs';

const order = (a, b) => a.sub - b.sub || a.player - b.player || a.num - b.num;

export class Timeline {
  /** @param {object} start the round's start (Match.nextRound) */
  constructor(start, { rewind = NET.rewind } = {}) {
    this.round = new Round(start);
    this.rewindFrames = rewind;
    /** frame → that frame's actions, in the order they happened */
    this.byFrame = new Map();
    /** "player:num" → the action, to find one again */
    this.byNum = new Map();
    /** frame → players the server took out */
    this.kills = new Map();
    /** k → the state before frame k */
    this.snaps = new Map();
    this.first = this.round.save();
    /** the earliest frame that has to be simulated again, Infinity if none */
    this.dirty = Infinity;
    /** the earliest frame rewound to since someone last asked (the renderer redraws from there) */
    this.rewound = Infinity;
    /** the events simulated since someone last took them, each with its frame `k` */
    this.events = [];
    this.rewinds = 0;
  }

  get k() {
    return this.round.k;
  }

  /** An action { player, num, frame, sub, dir, press } into the log; false if it was there already. */
  add(a) {
    const key = `${a.player}:${a.num}`;
    if (this.byNum.has(key)) return false;
    const action = { player: a.player, num: a.num, frame: a.frame, sub: a.sub, dir: a.dir, press: a.press || 0 };
    this.byNum.set(key, action);
    let list = this.byFrame.get(a.frame);
    if (!list) this.byFrame.set(a.frame, (list = []));
    list.push(action);
    list.sort(order);
    if (a.frame < this.round.k) this.dirty = Math.min(this.dirty, a.frame);
    return true;
  }

  /** Takes an action out again (the server rejected it, or took it back). */
  remove(player, num) {
    const key = `${player}:${num}`;
    const a = this.byNum.get(key);
    if (!a) return null;
    this.byNum.delete(key);
    const list = this.byFrame.get(a.frame);
    list.splice(list.indexOf(a), 1);
    if (!list.length) this.byFrame.delete(a.frame);
    if (a.frame < this.round.k) this.dirty = Math.min(this.dirty, a.frame);
    return a;
  }

  /** The server's word: this player is out at this frame. */
  kill(frame, player) {
    let list = this.kills.get(frame);
    if (!list) this.kills.set(frame, (list = []));
    if (list.includes(player)) return;
    list.push(player);
    list.sort((a, b) => a - b);
    if (frame < this.round.k) this.dirty = Math.min(this.dirty, frame);
  }

  /** The direction a player's actions end on so far (the last one in the log). */
  lastDir(player) {
    let best = null;
    for (const a of this.byNum.values()) {
      if (a.player !== player) continue;
      if (!best || a.frame > best.frame || (a.frame === best.frame && order(a, best) > 0)) best = a;
    }
    return best ? best.dir : 0;
  }

  /** The actions of the frame being lived now (for drawing the heads between frames). */
  actionsAt(frame) {
    return this.byFrame.get(frame) ?? [];
  }

  /** Simulates up to (not including) frame `target`, rewinding first if a late action needs it. */
  advanceTo(target) {
    if (this.dirty < this.round.k) this.rewindTo(this.dirty);
    this.dirty = Infinity;
    const round = this.round;
    while (round.k < target) {
      const k = round.k;
      this.snaps.set(k, round.save());
      this.snaps.delete(k - this.rewindFrames);
      const ev = round.step(this.byFrame.get(k), this.kills.get(k));
      for (const e of ev) {
        e.k = k;
        this.events.push(e);
      }
    }
  }

  /** Back to the state before frame f (or the round's start, if that's older than the snapshots). */
  rewindTo(f) {
    let snap = this.snaps.get(f);
    let at = f;
    if (!snap) {
      snap = this.first;
      at = 0;
    }
    this.round.restore(snap);
    for (const key of this.snaps.keys()) if (key >= at) this.snaps.delete(key);
    this.rewound = Math.min(this.rewound, at);
    this.rewinds++;
  }

  /** Takes the events simulated since the last call. */
  takeEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }

  /** Takes the earliest frame rewound to since the last call (Infinity: none). */
  takeRewound() {
    const r = this.rewound;
    this.rewound = Infinity;
    return r;
  }
}
