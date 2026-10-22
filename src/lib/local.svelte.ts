// The shared keyboard: two to four players on one computer, the whole game in the page (the same
// Match as the server's), each seat with its own two keys. Nothing goes over the network, so every
// curve is "your own": drawn ahead with the keys held right now.

import { Match } from '../../shared/engine.mjs';
import { BUILT_IN } from '../../shared/feel.mjs';
import { MODES } from '../../shared/modes.mjs';
import { World } from './world';
import { Steering, bindKeys } from './input';
import { prefs } from './prefs.svelte';
import { sfx } from './sound';
import type { Pending } from './predict';

export type Seat = { id: string; name: string; colour: string; keys: [string, string] };

export class LocalGame {
  world = new World();
  state = $state({ version: 0, over: false, standings: [] as any[], winner: null as string | null });
  match: Match;
  seats: (Seat & { steering: Steering; presses: number[] })[];
  private raf = 0;
  private unbind: () => void = () => {};
  private acc = 0;
  private last = 0;
  private paused = false;

  constructor(seats: Seat[], opts: { mode: string; feel?: any; target?: number }) {
    const mode = MODES[opts.mode as keyof typeof MODES] ?? MODES.basic;
    const feel = opts.feel ?? BUILT_IN[mode.feel as keyof typeof BUILT_IN];
    this.seats = seats.map((s) => {
      const seat = { ...s, presses: [] as number[], steering: null as unknown as Steering };
      seat.steering = new Steering((_dir, press) => {
        if (press) seat.presses.push(press);
      }, prefs.both);
      return seat;
    });
    this.match = new Match({
      players: seats.map((s) => ({ id: s.id, name: s.name, colour: s.colour, team: 0 })),
      rules: { type: 'ffa', target: opts.target ?? 0 },
      feel,
      mode: { rate: mode.rate, powerups: mode.powerups },
      seed: (Math.random() * 2 ** 32) >>> 0,
    });
    this.world.onEvent((ev) => {
      if (ev.e === 'phase' && ev.p === 'draw') sfx.go();
      if (ev.e === 'phase' && ev.p === 'linger') sfx.round(true);
      if (ev.e === 'die') sfx.crash(true);
      if (ev.e === 'pu+') sfx.spawn();
      if (ev.e === 'pu-') sfx.pick(true);
      if (['phase', 'score', 'roundEnd', 'round'].includes(ev.e)) this.state.version++;
    });
  }

  start() {
    const keys = new Map<string, [Steering, number]>();
    for (const s of this.seats) {
      keys.set(s.keys[0], [s.steering, -1]);
      keys.set(s.keys[1], [s.steering, 1]);
    }
    this.unbind = bindKeys(keys);
    this.world.round(this.match.startRound());
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      if (this.paused) {
        this.last = now;
        return;
      }
      const dtMs = 1000 / this.world.rate;
      this.acc += Math.min(250, now - this.last);
      this.last = now;
      while (this.acc >= dtMs && !this.paused) {
        this.acc -= dtMs;
        this.step(now - this.acc);
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  private step(now: number) {
    const inputs = new Map();
    for (const s of this.seats) inputs.set(s.id, { dir: s.steering.dir(), presses: s.presses.splice(0) });
    const msg: any = this.match.tick(inputs);
    this.world.tick(msg, now);
    if (!msg.e?.some((e: any) => e.e === 'roundEnd')) return;
    this.paused = true;
    if (this.match.over) {
      this.state.over = true;
      this.state.standings = this.match.standings();
      this.state.winner = this.match.winner as string | null;
      sfx.match(true);
      return;
    }
    setTimeout(() => {
      this.world.round(this.match.startRound());
      this.acc = 0;
      this.paused = false;
    }, 400);
  }

  /** Every seat is steered here: drawn ahead with the keys held now. */
  inputFor(pid: string): { dir0: number; pending: Pending[] } {
    const seat = this.seats.find((s) => s.id === pid);
    return { dir0: seat?.steering.dir() ?? 0, pending: [] };
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.unbind();
  }
}
