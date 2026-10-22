// Whole matches played out by random drivers: every powerup, ten players, many seeds. Checks that
// nothing throws and the rules hold (points only go up, a decided match has a two-point lead, every
// round ends). Local only (npm run test:sim), not in CI: the family's rule for games.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Match, rng } from '../shared/engine.mjs';
import { CLASSIC, GSPP } from '../shared/feel.mjs';
import { POWERUP_KINDS } from '../shared/powerups.mjs';

function play(seed, n, feel, opts = {}) {
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, colour: '#fff', team: opts.teams ? i % 2 : 0 }));
  const m = new Match({ players, rules: { type: opts.teams ? 'teams' : 'ffa', target: opts.target ?? 0, teamTarget: 3 }, feel, mode: { rate: 3, powerups: [...POWERUP_KINDS] }, seed });
  const drive = rng(seed * 7 + 1);
  const dirs = Object.fromEntries(players.map((p) => [p.id, 0]));
  let rounds = 0, ticks = 0, last = { ...m.points };
  const kinds = new Set();
  while (!m.over && rounds < 40) {
    m.startRound();
    let ended = false;
    for (let i = 0; i < 60 * 120 && !ended; i++) {
      const inputs = new Map();
      const r = m.r;
      for (const p of players) {
        if (drive() < 0.03) dirs[p.id] = [-1, 0, 1][Math.floor(drive() * 3)];
        // near a wall: turn towards the middle, so rounds last and powerups get picked
        const c = r.curves.find((x) => x.pid === p.id && x.alive);
        let dir = dirs[p.id];
        if (c && r.phase !== 'still') {
          const margin = 45;
          if (c.x < margin || c.y < margin || c.x > r.W - margin || c.y > r.H - margin) {
            const to = Math.atan2(r.H / 2 - c.y, r.W / 2 - c.x);
            const diff = Math.atan2(Math.sin(to - c.a), Math.cos(to - c.a));
            dir = diff > 0 ? 1 : -1;
          }
        }
        inputs.set(p.id, { dir, presses: drive() < 0.02 ? [drive() < 0.5 ? -1 : 1] : [] });
      }
      const msg = m.tick(inputs);
      ticks++;
      for (const e of msg.e ?? []) {
        if (e.e === 'pu-') kinds.add(e.kind);
        if (e.e === 'roundEnd') ended = true;
      }
      for (const [id, v] of Object.entries(m.points)) assert.ok(v >= last[id], 'points only go up');
      last = { ...m.points };
      for (const t of msg.c) assert.ok(t.slice(1, 4).every(Number.isFinite), 'positions stay numbers');
    }
    assert.ok(ended, `round ${rounds} ended (seed ${seed})`);
    rounds++;
  }
  if (m.over && m.rules.type === 'ffa') {
    const sorted = Object.values(m.points).sort((a, b) => b - a);
    assert.ok(sorted[0] >= m.rules.target && sorted[0] - sorted[1] >= 2);
  }
  return { rounds, ticks, kinds };
}

test('ten random drivers, every powerup, 150 seeds', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 150; seed++) {
    const r = play(seed, 10, { ...CLASSIC, freeTime: 0.5 }, { target: 15 });
    for (const k of r.kinds) seen.add(k);
  }
  // with this many rounds every powerup should have been picked at least once
  const missing = POWERUP_KINDS.filter((k) => !seen.has(k));
  assert.deepEqual(missing, []);
});

test('GS++ and teams', () => {
  for (let seed = 30; seed < 36; seed++) {
    play(seed, 6, GSPP, { target: 10 });
    play(seed, 4, { ...CLASSIC, freeWalls: 'wrap' }, { teams: true });
  }
});

test('free-phase walls: solid crashes there, wrap never leaves the field', () => {
  for (const freeWalls of ['solid', 'wrap']) {
    for (let seed = 40; seed < 46; seed++) play(seed, 5, { ...CLASSIC, freeWalls }, { target: 8 });
  }
});

test('every powerup handed to a curve, then the round played on', () => {
  for (const kind of POWERUP_KINDS) {
    const players = Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, colour: '#fff', team: 0 }));
    const m = new Match({ players, rules: {}, feel: { ...CLASSIC, freeTime: 0, fieldBase: 400 }, mode: { rate: 1, powerups: [] }, seed: 99 });
    m.startRound();
    while (m.r.phase !== 'draw') m.tick(new Map());
    for (let i = 0; i < 20; i++) m.tick(new Map());
    const c = m.r.curves.find((x) => x.alive);
    assert.ok(c, kind);
    m.r.powerups.push({ id: 5000, kind, x: c.x + Math.cos(c.a) * 2, y: c.y + Math.sin(c.a) * 2, vx: 0, vy: 0 });
    const msg = m.tick(new Map([[c.pid, { dir: 1, presses: [1] }]]));
    assert.ok(msg.e?.some((e) => e.e === 'pu-' && e.kind === kind), `${kind} picked`);
    for (let i = 0; i < 600 && m.r.phase !== 'done'; i++) {
      const out = m.tick(new Map(players.map((p) => [p.id, { dir: i % 50 < 25 ? 1 : -1, presses: i % 40 === 0 ? [1] : [] }])));
      for (const t of out.c) assert.ok(t.slice(1, 4).every(Number.isFinite), `${kind}: positions stay numbers`);
    }
  }
});
