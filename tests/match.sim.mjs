// Whole matches played out by random drivers through the rounds' timelines: every powerup, every
// arena, ten players, many seeds, actions mid-frame. Checks that nothing throws and the rules hold (points only
// go up, a decided match has a two-point lead, every round ends, positions stay numbers), and that a
// copy fed the same actions late (rewinding) ends every round in the same state. Local only
// (npm run test:sim), not in CI: the family's rule for games.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../shared/engine.mjs';
import { Timeline } from '../shared/timeline.mjs';
import { CLASSIC, GSPP } from '../shared/feel.mjs';
import { POWERUP_KINDS } from '../shared/powerups.mjs';
import { SHAPES, hitsPillar } from '../shared/arenas.mjs';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function play(seed, n, feel, opts = {}) {
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, colour: '#fff', team: opts.teams ? i % 2 : 0 }));
  // every arena in turn: the shapes, with pillars, ice and mud on every other seed
  const arena = { shape: SHAPES[seed % SHAPES.length], size: ['small', 'normal', 'large'][seed % 3], pillars: seed % 2 === 1, patches: seed % 4 < 2 };
  const m = new Match({ players, rules: { type: opts.teams ? 'teams' : 'ffa', target: opts.target ?? 0, teamTarget: 3 }, feel, mode: { rate: 3, powerups: [...POWERUP_KINDS] }, arena, seed });
  const drive = rng(seed * 7 + 1);
  let rounds = 0, frames = 0;
  const kinds = new Set();
  while (!m.over && rounds < 40) {
    const start = m.nextRound();
    const tl = new Timeline(start);
    const echo = opts.echo ? new Timeline(start, { rewind: 60 }) : null; // gets each action late
    const late = [];
    const nums = players.map(() => 0);
    const dirs = players.map(() => 0);
    let ended = false, last = { ...m.points };
    for (let k = 0; k < 60 * 150 && !ended; k++) {
      const r = tl.round;
      for (let p = 0; p < n; p++) {
        let dir = dirs[p];
        if (drive() < 0.03) dir = [-1, 0, 1][Math.floor(drive() * 3)];
        // near a wall: turn towards the middle, so rounds last and powerups get picked
        const c = r.s.curves.find((x) => x.p === p && x.alive);
        if (c && r.phase !== 'still') {
          const margin = 45;
          if (!r.floor.inside(c.x, c.y, margin)) {
            const to = Math.atan2(r.H / 2 - c.y, r.W / 2 - c.x);
            dir = Math.atan2(Math.sin(to - c.a), Math.cos(to - c.a)) > 0 ? 1 : -1;
          }
        }
        const press = drive() < 0.02 ? (drive() < 0.5 ? -1 : 1) : 0;
        if (dir !== dirs[p] || press) {
          dirs[p] = dir;
          const a = { player: p, num: ++nums[p], frame: k, sub: Math.floor(drive() * 1000), dir, press };
          tl.add(a);
          if (echo) late.push({ a, at: k + Math.floor(drive() * 20) });
        }
      }
      tl.advanceTo(k + 1);
      frames++;
      if (echo) {
        for (const q of late.filter((q) => q.at === k)) echo.add(q.a);
        echo.advanceTo(k + 1);
      }
      for (const e of tl.takeEvents()) {
        if (e.e === 'pu-') kinds.add(e.kind);
        if (e.e === 'done') ended = true;
      }
      for (const c of r.s.curves) assert.ok([c.x, c.y, c.a].every(Number.isFinite), 'positions stay numbers');
      for (const p of r.s.powerups) assert.ok(!hitsPillar(r.pillars, p.x, p.y, r.feel.powerupRadius), `a disc on a pillar (seed ${seed})`);
      const live = Object.fromEntries(start.players.map((p, i) => [p.id, start.points[p.id] + r.s.gains[i]]));
      for (const [id, v] of Object.entries(live)) assert.ok(v >= last[id], 'points only go up');
      last = live;
    }
    assert.ok(ended, `round ${rounds} ended (seed ${seed})`);
    if (echo) {
      for (const q of late) echo.add(q.a);
      echo.advanceTo(tl.k);
      assert.equal(echo.round.hash(), tl.round.hash(), `the late copy agrees (seed ${seed}, round ${rounds})`);
    }
    m.applyRound(tl.round.result());
    rounds++;
  }
  if (m.over && m.rules.type === 'ffa') {
    const sorted = Object.values(m.points).sort((a, b) => b - a);
    assert.ok(sorted[0] >= m.rules.target && sorted[0] - sorted[1] >= 2);
  }
  return { rounds, frames, kinds };
}

test('ten random drivers, every powerup, 150 seeds', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 150; seed++) {
    const r = play(seed, 10, { ...CLASSIC, freeTime: 0.5 }, { target: 15 });
    for (const k of r.kinds) seen.add(k);
  }
  const missing = POWERUP_KINDS.filter((k) => !seen.has(k));
  assert.deepEqual(missing, []);
});

test('a copy that gets every action late agrees at every round’s end', () => {
  for (let seed = 200; seed < 212; seed++) play(seed, 6, { ...CLASSIC, freeTime: 0.5 }, { target: 8, echo: true });
});

test('GS++ and teams', () => {
  for (let seed = 30; seed < 36; seed++) {
    play(seed, 6, GSPP, { target: 10 });
    play(seed, 4, { ...CLASSIC, freeWalls: 'wrap' }, { teams: true });
  }
});

test('free-phase walls: solid crashes there, wrap and bounce never leave the field', () => {
  for (const freeWalls of ['solid', 'wrap', 'bounce']) {
    for (let seed = 40; seed < 46; seed++) play(seed, 5, { ...CLASSIC, freeWalls }, { target: 8 });
  }
});
