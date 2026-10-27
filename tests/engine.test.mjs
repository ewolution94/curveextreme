// The engine against the reference's measured numbers and the rules. Fast, fixed seeds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Match, Round, arc, motionOf, targetFor, touchesPiece } from '../shared/engine.mjs';
import { CLASSIC, GSPP, fieldFor, cleanFeel } from '../shared/feel.mjs';
import { MODES } from '../shared/modes.mjs';
import { sin, cos } from '../shared/dmath.mjs';

const players = (n, teams = false) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, colour: '#fff', team: teams ? i % 2 : 0 }));

// The tests start drawing right after the still phase, where the walls kill.
const NOW = { ...CLASSIC, freeTime: 0 };

function setup(n = 2, opts = {}) {
  const m = new Match({ players: players(n, opts.teams), rules: opts.rules ?? {}, feel: opts.feel ?? NOW, mode: opts.mode ?? MODES.none, seed: opts.seed ?? 7 });
  return { m, r: new Round(m.nextRound()) };
}
/** Steps until the curves draw (past the still and free phases). */
function toDraw(r) {
  while (r.phase === 'still' || r.phase === 'free') r.step();
  assert.equal(r.phase, 'draw');
}
/** Holds a direction for a player from now on: one action at the start of the next frame. */
const hold = (r, player, dir, num = 1) => r.step([{ player, num, sub: 0, dir, press: 0 }]);

test('straight: 90 units a second', () => {
  const c = { x: 0, y: 0, a: 0 };
  const mo = motionOf([], CLASSIC);
  for (let i = 0; i < 50; i++) arc(c, mo, 0, 1 / 50);
  assert.ok(Math.abs(c.x - 90) < 1e-9);
});

test('a held turn: radius 35, a full circle in 2.44 s', () => {
  const c = { x: 0, y: 0, a: 0 };
  const mo = motionOf([], CLASSIC);
  const pts = [];
  for (let i = 0; i < 122; i++) {
    arc(c, mo, 1, 1 / 50);
    pts.push([c.x, c.y]);
  }
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const radii = pts.map((p) => Math.hypot(p[0] - cx, p[1] - cy));
  const mean = radii.reduce((s, v) => s + v, 0) / radii.length;
  assert.ok(Math.abs(mean - 35) < 0.3, `radius ${mean}`);
});

test('an arc split anywhere lands on the same point (sub-frame actions are exact)', () => {
  const mo = motionOf([], CLASSIC);
  const whole = { x: 10, y: 20, a: 0.3 };
  arc(whole, mo, 1, 0.02);
  const parts = { x: 10, y: 20, a: 0.3 };
  arc(parts, mo, 1, 0.0073);
  arc(parts, mo, 1, 0.0127);
  assert.ok(Math.abs(whole.x - parts.x) < 1e-12 && Math.abs(whole.y - parts.y) < 1e-12 && Math.abs(whole.a - parts.a) < 1e-12);
});

test('a press mid-frame turns from that moment: between pressing at the frame start and not at all', () => {
  const heading = (sub) => {
    const { r } = setup(1, { feel: { ...NOW, fieldBase: 5000 } });
    toDraw(r);
    r.step(sub === null ? [] : [{ player: 0, num: 1, sub, dir: 1, press: 1 }]);
    return r.s.curves[0].a;
  };
  const none = heading(null), half = heading(500), full = heading(0);
  assert.ok(none < half && half < full, `${none} ${half} ${full}`);
  assert.ok(Math.abs(half - none - (full - none) / 2) < 1e-9, 'half a frame turns half as much');
});

test('phases: 2.5 s still, 2.5 s without a line, then drawing', () => {
  const { r } = setup(1, { feel: { ...CLASSIC, fieldBase: 5000 } });
  const start = { ...r.s.curves[0] };
  for (let i = 0; i < 125; i++) r.step();
  assert.equal(r.phase, 'still');
  assert.equal(r.s.curves[0].x, start.x);
  r.step();
  assert.equal(r.phase, 'free');
  for (let i = 0; i < 124; i++) r.step();
  assert.equal(r.phase, 'free');
  assert.equal(r.trail.x.length, 0, 'no line while free');
  r.step();
  assert.equal(r.phase, 'draw');
});

test('gaps: 16 long, about 158 apart on average', () => {
  const { r } = setup(1, { feel: { ...NOW, fieldBase: 1e6 }, seed: 3 });
  toDraw(r);
  let drawing = 0, gaps = 0, inGap = false, gapLen = 0;
  const lens = [];
  for (let i = 0; i < 50 * 400; i++) {
    const before = r.trail.x.length;
    r.step();
    if (r.trail.x.length > before) {
      drawing++;
      if (inGap) lens.push(gapLen);
      inGap = false;
    } else {
      if (!inGap) {
        gaps++;
        gapLen = 0;
      }
      inGap = true;
      gapLen += 1.8;
    }
  }
  const lineBetween = (drawing * 1.8) / gaps;
  assert.ok(lineBetween > 140 && lineBetween < 178, `average line between gaps ${lineBetween}`);
  const meanGap = lens.reduce((s, v) => s + v, 0) / lens.length;
  assert.ok(meanGap > 15 && meanGap < 19, `gap length ${meanGap}`);
  assert.ok(r.s.gaps[0] >= gaps, 'the round counts the gaps for the stats (back-to-back ones apart)');
});

test('the wall kills, and so does your own line after a circle', () => {
  const { r } = setup(1, { seed: 11 });
  toDraw(r);
  hold(r, 0, 1);
  let died = null;
  for (let i = 0; i < 2000 && !died; i++) died = r.step().find((e) => e.e === 'die');
  assert.ok(died, 'a held turn ends in your own line');
  const { r: r2 } = setup(1, { seed: 12 });
  toDraw(r2);
  let wall = null;
  for (let i = 0; i < 2000 && !wall; i++) wall = r2.step().find((e) => e.e === 'die');
  assert.ok(wall);
  assert.equal(wall.by, null);
});

test('points: the survivor scores, the round runs on 4.65 s, then ends', () => {
  // p0 circles into its own line, p1 drives straight across a field too big to leave in time
  const { r } = setup(2, { seed: 5, feel: { ...NOW, fieldBase: 3000 } });
  toDraw(r);
  r.step([{ player: 0, num: 1, sub: 0, dir: 1, press: 1 }]);
  let scored = null, k0 = 0;
  for (let i = 0; i < 3000 && !scored; i++) {
    k0 = r.k;
    scored = r.step().find((e) => e.e === 'score');
  }
  assert.ok(scored);
  assert.deepEqual(r.s.gains, [0, 1]);
  assert.equal(r.phase, 'linger');
  let end = null, k1 = 0;
  for (let i = 0; i < 400 && !end; i++) {
    k1 = r.k;
    end = r.step().find((e) => e.e === 'done');
  }
  assert.ok(end);
  assert.equal(k1 - k0, Math.round(4.65 * 50));
});

test('the match: first to 10 × (players − 1) with a two-point lead', () => {
  assert.equal(targetFor(5), 40);
  const { m } = setup(2);
  m.applyRound({ gains: { p0: 10, p1: 9 }, winner: 'p0' });
  assert.equal(m.over, false, 'no two-point lead');
  m.applyRound({ gains: { p0: 1, p1: 0 }, winner: 'p0' });
  assert.equal(m.over, true);
  assert.equal(m.winner, 'p0');
});

test('teams: a round goes to the team left; teammates score nothing for each other', () => {
  const { m, r } = setup(4, { teams: true, rules: { type: 'teams' }, seed: 9 });
  assert.equal(m.rules.type, 'teams');
  toDraw(r);
  r.s.curves.find((c) => c.p === 0).x = -100;
  assert.ok(r.step().some((e) => e.e === 'score'));
  assert.deepEqual(r.s.gains, [0, 1, 0, 1]);
  r.s.curves.find((c) => c.p === 2).x = -100;
  const phase = r.step().find((e) => e.e === 'phase' && e.p === 'linger');
  assert.equal(phase.winner, 1);
  m.applyRound(r.result());
  assert.equal(m.teamWins[1], 1);
  assert.deepEqual(m.points, { p0: 0, p1: 2, p2: 0, p3: 2 }, 'p1 and p3 scored for both of the other team');
});

test('the server can take a player out at a frame', () => {
  const { r } = setup(2, { seed: 4 });
  toDraw(r);
  const ev = r.step([], [1]);
  assert.ok(ev.some((e) => e.e === 'die' && e.p === 1 && e.by === null));
  assert.deepEqual(r.s.gains, [1, 0]);
});

test('powerups: green on you, red on the others, blue on everyone; erasers clear lines', () => {
  const { r } = setup(2, { feel: { ...NOW, fieldBase: 2000 } });
  toDraw(r);
  for (let i = 0; i < 30; i++) r.step();
  const [a, b] = r.s.curves;
  const put = (kind, curve) => {
    r.s.powerups.push({ id: 999, kind, x: curve.x + cos(curve.a) * 1.8, y: curve.y + sin(curve.a) * 1.8, vx: 0, vy: 0 });
    return r.step();
  };
  put('greenSpeed', a);
  assert.equal(r.motion(a).v, 180);
  assert.equal(r.motion(b).v, 90);
  put('redTurtle', a);
  assert.equal(r.motion(b).v, 45);
  assert.ok(r.trail.x.length > 0);
  const ev = put('eraser', a);
  assert.ok(ev.some((e) => e.e === 'erase' && e.p === null));
  assert.ok(r.trail.x.length <= 2);
  const before = r.s.curves.length;
  put('split', a);
  assert.equal(r.s.curves.length, before + 2);
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

test('the Tune panel: a new feel reaches the next round', () => {
  const { m, r } = setup(2);
  m.retune({ feel: { ...NOW, speed: 120, name: 'Playtest' } });
  assert.equal(r.feel.speed, 90, 'the running round keeps its feel');
  const next = m.nextRound();
  assert.equal(next.feel.speed, 120);
  assert.equal(next.no, 2);
  assert.notEqual(next.seed, r.start.seed, 'each round its own seed');
});

test('walls while moving without a line: bounce (the default), wrap or solid', () => {
  const run = (freeWalls) => {
    const { r } = setup(1, { feel: { ...CLASSIC, freeTime: 4, freeWalls } });
    const c = r.s.curves[0];
    c.x = 10;
    c.a = Math.PI; // heading out of the left wall
    let died = false, least = Infinity;
    for (let i = 0; i < 260; i++) {
      died ||= r.step().some((e) => e.e === 'die');
      least = Math.min(least, r.s.curves[0].x);
    }
    return { died, x: r.s.curves[0].x, a: r.s.curves[0].a, least };
  };
  assert.equal(run('solid').died, true);
  assert.ok(run('wrap').x > 0, 'came back in on the other side');
  assert.equal(CLASSIC.freeWalls, 'bounce');
  const bounce = run('bounce');
  assert.equal(bounce.died, false);
  assert.ok(bounce.least >= CLASSIC.width / 2 - 1e-9, `never past the wall (${bounce.least})`);
  assert.ok(Math.abs(bounce.a) < 1e-9, 'straight back the way it came');
  assert.equal(cleanFeel({ freeWalls: 'off' }).freeWalls, 'bounce', 'an old profile’s open walls are gone');
});

test('the hitbox is the line as drawn: a gap is as wide as it looks, the side gives the same small allowance', () => {
  const hr = CLASSIC.hit / 2, pr = CLASSIC.width / 2;
  // a piece of line from x = 0 to 1.8 along y = 0 (square ends, as drawn)
  const touches = (x, y) => touchesPiece(x, y, hr, 0, 0, 1.8, 0, pr);
  // past its end: the head's dot is clear at pr from the end, the engine allows hr inside that
  assert.equal(touches(1.8 + hr + 0.01, 0), false, 'past the square end, beyond the hit size: clear');
  assert.equal(touches(1.8 + hr - 0.01, 0), true);
  // beside it: hit at hr + pr from the middle line
  assert.equal(touches(0.9, hr + pr + 0.01), false);
  assert.equal(touches(0.9, hr + pr - 0.01), true);
  // at a corner of the band: the distance to the corner itself
  assert.equal(touches(1.8 + 1.5, pr + 1.5), true, '2.12 from the corner');
  assert.equal(touches(1.8 + 1.8, pr + 1.8), false, '2.55 from the corner');
});

test('two heads reaching one spot in one frame both crash, whichever player comes first', () => {
  for (const swap of [false, true]) {
    const { r } = setup(2, { feel: { ...NOW, fieldBase: 900 }, seed: 5 });
    toDraw(r);
    const [c0, c1] = r.s.curves;
    const A = swap ? c1 : c0, B = swap ? c0 : c1; // A east along y = 400, B north across x = 421.8
    Object.assign(A, { x: 400, y: 400, a: 0 });
    Object.assign(B, { x: 421.8, y: 421.8, a: -Math.PI / 2 });
    const died = new Set();
    for (let i = 0; i < 20 && !died.size; i++) for (const e of r.step()) if (e.e === 'die') died.add(e.cid);
    assert.deepEqual([...died].sort(), [A.id, B.id].sort(), swap ? 'B first' : 'A first');
  }
});

test('the warm-up turns tighter: moving without a line, a held turn has freeTurn × the radius', () => {
  const { r } = setup(1, { feel: { ...CLASSIC, fieldBase: 5000 } });
  for (let i = 0; i < r.stillK; i++) r.step();
  const c = r.s.curves[0];
  assert.equal(r.motion(c).r, CLASSIC.radius * CLASSIC.freeTurn, 'moving without a line');
  while (r.phase !== 'draw') r.step();
  assert.equal(r.motion(c).r, CLASSIC.radius, 'once the lines start');
  assert.ok(CLASSIC.freeTurn < 1);
});
