// The shared keyboard: two to four players on one computer, the whole game in the page (the same
// Match and rounds as the server's, on the page's own clock), each seat with its own two keys.
// Nothing goes over the network, so nothing is ever late: each key press goes into the round at the
// moment it happened, like your own steering online.

import { Match } from '../../shared/engine.mjs';
import { BUILT_IN } from '../../shared/feel.mjs';
import { MODES } from '../../shared/modes.mjs';
import { RoundRunner, type RoundEvent } from './runner';
import { Steering, bindKeys } from './input';
import { sfx } from './sound';

export type Seat = { id: string; name: string; colour: string; keys: [string, string] };

const LEAD = 300; // ms from a round's start to its frame 0
const BETWEEN = 400; // ms between rounds

export class LocalGame {
  state = $state({ version: 0, over: false, standings: [] as any[], winner: null as string | null });
  runner: RoundRunner | null = null;
  match: any;
  seats: Seat[];
  private steerings: Steering[] = [];
  private nums: number[];
  private unbind: () => void = () => {};
  private timer = 0;

  constructor(seats: Seat[], opts: { mode: string; feel?: any; target?: number; arena?: any }) {
    const mode = MODES[opts.mode as keyof typeof MODES] ?? MODES.basic;
    const feel = opts.feel ?? BUILT_IN[mode.feel as keyof typeof BUILT_IN];
    this.seats = seats;
    this.nums = seats.map(() => 0);
    this.match = new Match({
      players: seats.map((s) => ({ id: s.id, name: s.name, colour: s.colour, team: 0 })),
      rules: { type: 'ffa', target: opts.target ?? 0 },
      feel,
      mode: { rate: mode.rate, powerups: mode.powerups },
      arena: opts.arena,
      seed: (Math.random() * 2 ** 32) >>> 0,
    });
    this.steerings = seats.map(
      (_, i) =>
        new Steering((dir, press, time) => {
          const r = this.runner;
          if (!r || r.round.phase === 'done') return;
          if (!press && r.lastDir(i) === dir) return;
          r.local(i, dir, press, ++this.nums[i], time);
        }),
    );
  }

  start() {
    const keys = new Map<string, [Steering, number]>();
    this.seats.forEach((s, i) => {
      keys.set(s.keys[0], [this.steerings[i], -1]);
      keys.set(s.keys[1], [this.steerings[i], 1]);
    });
    this.unbind = bindKeys(keys);
    this.nextRound();
  }

  private nextRound() {
    const start = this.match.nextRound();
    const zero = performance.now() + LEAD;
    const r = new RoundRunner(start, () => zero, { own: this.seats.map((_, i) => i) });
    r.on((e) => this.onEvent(e));
    this.runner = r;
    this.nums = this.seats.map(() => 0);
    this.state.version++;
    // keys held across rounds: those directions from the first frame
    this.steerings.forEach((s, i) => {
      if (s.dir()) r.local(i, s.dir(), 0, ++this.nums[i], zero);
    });
  }

  private onEvent(e: RoundEvent) {
    if (e.e === 'phase' && e.p === 'draw') sfx.go();
    if (e.e === 'phase' && e.p === 'linger') sfx.round(true);
    if (e.e === 'die') sfx.crash(true);
    if (e.e === 'pu+') sfx.spawn();
    if (e.e === 'pu-') sfx.pick(true);
    if (['phase', 'score', 'done', 'die'].includes(e.e)) this.state.version++;
    if (e.e !== 'done' || !this.runner) return;
    this.match.applyRound(this.runner.round.result());
    if (this.match.over) {
      this.state.over = true;
      this.state.standings = this.match.standings();
      this.state.winner = this.match.winner as string | null;
      sfx.match(true);
      return;
    }
    this.timer = window.setTimeout(() => this.nextRound(), BETWEEN);
  }

  stop() {
    clearTimeout(this.timer);
    this.unbind();
    this.runner = null;
  }
}
