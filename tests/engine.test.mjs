// The engine against the reference's measured numbers and the rules. Fast, fixed seeds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Match, motionOf, steer, targetFor } from '../shared/engine.mjs';
import { CLASSIC, GSPP, fieldFor, cleanFeel } from '../shared/feel.mjs';
import { MODES } from '../shared/modes.mjs';

const players = (n, teams = false) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, colour: '#fff', team: teams ? i % 2 : 0 }));
const input = (entries) => new Map(entries);

// The tests start drawing right after the still phase: the free phase has no walls, and a curve left
// to drive straight on leaves the field in it (and dies when the lines start, like the reference).
const NOW = { ...CLASSIC, freeTime: 0 };

function match(n = 2, opts = {}) {
  const m = new Match({ players: players(n, opts.teams), rules: opts.rules ?? {}, feel: opts.feel ?? NOW, mode: opts.mode ?? MODES.none, seed: opts.seed ?? 7 });
  m.startRound();
  return m;
}
/** Runs ticks until the curves draw (past the still and free phases). */
function toDraw(m) {
  while (m.r.phase === 'still' || m.r.phase === 'free') m.tick(new Map());
  assert.equal(m.r.phase, 'draw');
}

test('straight: 90 units a second', () => {
  const c = { x: 0, y: 0, a: 0 };
  const mo = motionOf([], CLASSIC);
  for (let i = 0; i < 50; i++) steer(c, mo, 0, [], 1 / 50);
  assert.ok(Math.abs(c.x - 90) < 1e-9);
});

test('a held turn: radius 35, a full circle in 2.44 s', () => {
  const c = { x: 0, y: 0, a: 0 };
  const mo = motionOf([], CLASSIC);
  const pts = [];
  for (let i = 0; i < 122; i++) {
    steer(c, mo, 1, [], 1 / 50);
    pts.push([c.x, c.y]);
  }
  // fit: the centre is the mean of a full circle's points
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const radii = pts.map((p) => Math.hypot(p[0] - cx, p[1] - cy));
  const mean = radii.reduce((s, v) => s + v, 0) / radii.length;
  assert.ok(Math.abs(mean - 35) < 0.3, `radius ${mean}`);
  assert.ok(Math.abs((2 * Math.PI * 35) / 90 - 2.443) < 0.01);
});

test('phases: 2.5 s still, 2.5 s without a line, then drawing', () => {
  const m = match(1, { feel: { ...CLASSIC, fieldBase: 5000 } });
  const start = { ...m.r.curves[0] };
  for (let i = 0; i < 125; i++) m.tick(new Map());
  assert.equal(m.r.phase, 'still');
  assert.equal(m.r.curves[0].x, start.x);
  m.tick(new Map());
  assert.equal(m.r.phase, 'free');
  for (let i = 0; i < 124; i++) m.tick(new Map());
  assert.equal(m.r.phase, 'free');
  assert.equal(m.r.points.x.length, 0, 'no line while free');
  m.tick(new Map());
  assert.equal(m.r.phase, 'draw');
});

test('gaps: 16 long, about 158 apart on average', () => {
  const feel = { ...NOW, fieldBase: 1e6 }; // a field too big to leave
  const m = match(1, { feel, seed: 3 });
  toDraw(m);
  let drawing = 0, gaps = 0, inGap = false, gapLen = 0;
  const lens = [];
  for (let i = 0; i < 50 * 400; i++) {
    const msg = m.tick(new Map());
    const drew = msg.c[0][4] & 1;
    if (drew) {
      drawing++;
      if (inGap) lens.push(gapLen);
      inGap = false;
    } else {
      if (!inGap) { gaps++; gapLen = 0; }
      inGap = true;
      gapLen += 1.8;
    }
  }
  const lineBetween = (drawing * 1.8) / gaps;
  assert.ok(lineBetween > 140 && lineBetween < 178, `average line between gaps ${lineBetween}`);
  const meanGap = lens.reduce((s, v) => s + v, 0) / lens.length;
  assert.ok(meanGap > 15 && meanGap < 19, `gap length ${meanGap}`);
});

test('the wall kills, and so does your own line after a circle', () => {
  const m = match(1, { seed: 11 });
  toDraw(m);
  let died = null;
  for (let i = 0; i < 2000 && !died; i++) {
    const msg = m.tick(input([['p0', { dir: 1, presses: [] }]]));
    died = msg.e?.find((e) => e.e === 'die');
  }
  assert.ok(died, 'a held turn ends in your own line');
  const m2 = match(1, { seed: 12 });
  toDraw(m2);
  let wall = null;
  for (let i = 0; i < 2000 && !wall; i++) wall = m2.tick(new Map()).e?.find((e) => e.e === 'die');
  assert.ok(wall);
  assert.equal(wall.by, null);
});

test('points: the survivor scores, the round runs on 4.65 s, then ends', () => {
  const m = match(2, { seed: 5 });
  toDraw(m);
  // p0 circles (dies in its own line), p1 also circles: whoever dies first gives the other a point
  let scored = null, k0 = 0;
  for (let i = 0; i < 3000 && !scored; i++) {
    const msg = m.tick(input([['p0', { dir: 1, presses: [] }], ['p1', { dir: -1, presses: [] }]]));
    scored = msg.e?.find((e) => e.e === 'score');
    k0 = msg.k;
  }
  assert.ok(scored);
  const total = Object.values(scored.pts).reduce((s, v) => s + v, 0);
  assert.equal(total, 1);
  assert.equal(m.r.phase, 'linger');
  let end = null, k1 = 0;
  for (let i = 0; i < 400 && !end; i++) {
    const msg = m.tick(new Map());
    end = msg.e?.find((e) => e.e === 'roundEnd');
    k1 = msg.k;
  }
  assert.ok(end);
  assert.equal(k1 - k0, Math.round(4.65 * 50));
});

test('the match: first to 10 × (players − 1) with a two-point lead', () => {
  assert.equal(targetFor(5), 40);
  const m = match(2);
  m.points = { p0: 10, p1: 9 };
  m.r.winner = 'p0';
  m.endRound([]);
  assert.equal(m.over, false, 'no two-point lead');
  m.points = { p0: 11, p1: 9 };
  m.endRound([]);
  assert.equal(m.over, true);
  assert.equal(m.winner, 'p0');
});

test('teams: a round goes to the team left; teammates score nothing for each other', () => {
  const m = match(4, { teams: true, rules: { type: 'teams' }, seed: 9 });
  assert.equal(m.rules.type, 'teams');
  toDraw(m);
  // kill p0 (team 0): only team 1 (p1, p3) scores
  m.r.curves.find((c) => c.pid === 'p0').x = -100;
  const msg = m.tick(new Map());
  const score = msg.e.find((e) => e.e === 'score');
  assert.deepEqual(score.pts, { p0: 0, p1: 1, p2: 0, p3: 1 });
  m.r.curves.find((c) => c.pid === 'p2').x = -100;
  const msg2 = m.tick(new Map());
  const phase = msg2.e.find((e) => e.e === 'phase' && e.p === 'linger');
  assert.equal(phase.winner, 1);
  assert.equal(m.teamWins[1], 1);
});

test('powerups: green on you, red on the others, blue on everyone; erasers clear lines', () => {
  const m = match(2, { mode: MODES.none, feel: { ...NOW, fieldBase: 2000 } });
  toDraw(m);
  for (let i = 0; i < 30; i++) m.tick(new Map());
  const [a, b] = m.r.curves;
  const put = (kind, curve) => {
    m.r.powerups.push({ id: 999, kind, x: curve.x + Math.cos(curve.a) * 1.8, y: curve.y + Math.sin(curve.a) * 1.8, vx: 0, vy: 0 });
    return m.tick(new Map());
  };
  put('greenSpeed', a);
  assert.equal(m.motion(a).v, 180);
  assert.equal(m.motion(b).v, 90);
  put('redTurtle', a);
  assert.equal(m.motion(b).v, 45);
  assert.ok(m.r.points.x.length > 0);
  const msg = put('eraser', a);
  assert.ok(msg.e.some((e) => e.e === 'erase' && e.pid === null));
  assert.ok(m.r.points.x.length <= 2);
  const before = m.r.curves.length;
  put('split', a);
  assert.equal(m.r.curves.length, before + 2);
});

test('the same seed and inputs give the same game', () => {
  const run = () => {
    const m = match(3, { mode: MODES.basic, seed: 42 });
    const out = [];
    for (let i = 0; i < 1500; i++) out.push(JSON.stringify(m.tick(input([['p0', { dir: i % 90 < 30 ? 1 : 0, presses: [] }]]))));
    return out.join('\n');
  };
  assert.equal(run(), run());
});

test('fields scale with the players; GS++ is bigger and faster', () => {
  assert.deepEqual(fieldFor(CLASSIC, 2), [361, 361]);
  assert.deepEqual(fieldFor(CLASSIC, 4), [510, 510]);
  assert.deepEqual(fieldFor(GSPP, 5), [924, 764]);
  assert.equal(GSPP.speed, 180);
});

test('a profile from outside is cleaned: unknown keys dropped, numbers kept in range', () => {
  const f = cleanFeel({ speed: 99999, radius: 'x', evil: 1, name: 'Playtest' });
  assert.equal(f.speed, 400);
  assert.equal(f.radius, CLASSIC.radius);
  assert.equal(f.evil, undefined);
  assert.equal(f.name, 'Playtest');
});
