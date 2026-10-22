// Your own curve, drawn ahead of the server: from the last tick the server sent, step by step with
// the same steer() the server runs, through the key presses it hasn't confirmed yet, to the tick it
// will be at when a press made now reaches it (half a round trip ahead, plus the time since the
// last tick). The rest of a tick is an exact arc, so a press shows on the very next frame.

import { steer, wrapInto } from '../../shared/engine.mjs';
import type { Curve, Motion, World } from './world';

/** An input not yet confirmed: the tick the server is expected to apply it at. */
export type Pending = { tick: number; dir: number; press: number };

/** Moves a curve along its arc for t seconds (the part of a tick between two ticks). */
export function arc(s: { x: number; y: number; a: number }, m: Motion, dir: number, t: number) {
  let d = m.reverse ? -dir : dir;
  if (m.finger && d !== m.finger) d = 0;
  if (m.corner) d = 0;
  if (!d) {
    s.x += Math.cos(s.a) * m.v * t;
    s.y += Math.sin(s.a) * m.v * t;
    return;
  }
  const om = (d * m.v) / m.r;
  s.x += ((Math.sin(s.a + om * t) - Math.sin(s.a)) * m.v) / om;
  s.y -= ((Math.cos(s.a + om * t) - Math.cos(s.a)) * m.v) / om;
  s.a += om * t;
}

/**
 * The path from the curve's last known tick to where it is shown now: a polyline (x, y pairs, NaN
 * pairs where it jumps) ending at the head.
 * ahead: ticks to run ahead of the last known one (fractional); dir0: the direction the server is
 * applying; pending: inputs it will apply later.
 */
export function predictPath(world: World, c: Curve, ahead: number, dir0: number, pending: Pending[]) {
  const last = c.hist[c.hist.length - 1];
  const s = { x: last.x, y: last.y, a: last.a };
  const pts = [s.x, s.y];
  if (!c.alive) return { pts, head: s };
  const F = Math.max(0, Math.min(12, ahead));
  const n = Math.floor(F);
  const dt = 1 / world.rate;
  const m = c.m;
  let dir = dir0;
  let i = 0;
  for (let j = 1; j <= n; j++) {
    const tk = world.k + j;
    const presses: number[] = [];
    while (i < pending.length && pending[i].tick <= tk) {
      dir = pending[i].dir;
      if (pending[i].press) presses.push(pending[i].press);
      i++;
    }
    if (tk <= world.still) continue;
    steer(s, m, dir, presses, dt);
    if (m.wrap && tk > world.free && wrapInto(s, world.rectAt(tk))) pts.push(NaN, NaN);
    pts.push(s.x, s.y);
  }
  while (i < pending.length && pending[i].tick <= world.k + n + 1) dir = pending[i++].dir;
  if (world.k + n + 1 > world.still) arc(s, m, dir, (F - n) * dt);
  pts.push(s.x, s.y);
  return { pts, head: s };
}
