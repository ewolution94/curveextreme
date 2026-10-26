// Arenas: each shape's floor has the measured square's room, its edges kill, pillars kill, ice
// widens a turn and mud slows it, the open wall leads across, and every arena stays deterministic
// when actions arrive late.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Match, Round } from '../shared/engine.mjs';
import { Timeline } from '../shared/timeline.mjs';
import { ARENA_NUMBERS, Floor, SHAPES, arenaField, cleanArena, hitsPillar } from '../shared/arenas.mjs';
import { CLASSIC, fieldFor } from '../shared/feel.mjs';
import { MODES } from '../shared/modes.mjs';
import { cos, sin } from '../shared/dmath.mjs';

const NOW = { ...CLASSIC, freeTime: 0 };
const players = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, colour: '#fff' }));
function round(arena, n = 2, opts = {}) {
  const m = new Match({ players: players(n), feel: opts.feel ?? NOW, mode: opts.mode ?? MODES.none, arena, seed: opts.seed ?? 3 });
  return new Round(m.nextRound());
}
const toDraw = (r) => {
  while (r.phase === 'still' || r.phase === 'free') r.step();
};

test('the square as before; every other shape has the measured square’s room', () => {
  assert.deepEqual(arenaField(CLASSIC, 4, cleanArena({})), fieldFor(CLASSIC, 4));
  const [W] = fieldFor(CLASSIC, 4);
  for (const shape of SHAPES) {
    const [w, h] = arenaField(CLASSIC, 4, { ...cleanArena({}), shape });
    const f = new Floor({ shape }, w, h);
    let inside = 0;
    const N = 400;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (f.inside(((i + 0.5) / N) * w, ((j + 0.5) / N) * h)) inside++;
    const area = (inside / (N * N)) * w * h;
    assert.ok(Math.abs(area / (W * W) - 1) < 0.02, `${shape}: ${Math.round(area)} against ${W * W}`);
  }
  assert.deepEqual(arenaField(CLASSIC, 4, { ...cleanArena({}), size: 'large' }), fieldFor(CLASSIC, 4).map((v) => Math.round((v / 1) * 1.4)));
});

test('the floor’s edges: the ring’s island and the cross’s corners are walls', () => {
  const ring = new Floor({ shape: 'ring' }, 400, 400);
  assert.equal(ring.inside(200, 200), false, 'the island');
  assert.equal(ring.inside(200, 30), true);
  assert.equal(ring.inside(5, 5), false);
  const cross = new Floor({ shape: 'cross' }, 400, 400);
  assert.equal(cross.inside(30, 30), false, 'a corner');
  assert.equal(cross.inside(200, 10), true);
  assert.equal(cross.inside(10, 200), true);
  const hex = new Floor({ shape: 'hexagon' }, 400, 346);
  assert.equal(hex.inside(395, 173), true, 'near the right corner');
  assert.equal(hex.inside(380, 20), false, 'outside a slanted edge');
  assert.equal(hex.inside(200, 340), true);
  assert.equal(new Floor({ shape: 'circle' }, 400, 400).inside(200, 200, 0, 0.3), true);
  assert.equal(new Floor({ shape: 'circle' }, 400, 400).inside(200, 100, 0, 0.3), false, 'closing walls shrink it');
});

test('spawns land on the floor and clear of the pillars, in every shape', () => {
  for (const shape of SHAPES) {
    for (let seed = 1; seed < 15; seed++) {
      const r = round({ shape, size: 'normal', pillars: true, patches: true }, 6, { seed });
      for (const c of r.s.curves) {
        assert.ok(r.floor.inside(c.x, c.y, 10), `${shape} seed ${seed}: spawn on the floor`);
        for (const p of r.pillars) assert.ok(Math.hypot(c.x - p.x, c.y - p.y) > p.r + 20, `${shape}: spawn clear of a pillar`);
      }
      assert.ok(r.pillars.length >= 5, `${shape}: ${r.pillars.length} pillars`);
      assert.ok(r.patches.some((p) => p.kind === 'ice') && r.patches.some((p) => p.kind === 'mud'));
    }
  }
});

test('a pillar kills', () => {
  const r = round({ shape: 'square', size: 'normal', pillars: true, patches: false }, 1, { feel: { ...NOW, fieldBase: 900 } });
  toDraw(r);
  const c = r.s.curves[0];
  const p = r.pillars[0];
  c.x = p.x - (p.r + 6) * cos(c.a);
  c.y = p.y - (p.r + 6) * sin(c.a);
  let died = null;
  for (let i = 0; i < 10 && !died; i++) died = r.step().find((e) => e.e === 'die');
  assert.ok(died);
});

test('ice turns wider, mud is slower', () => {
  const r = round({ shape: 'square', size: 'normal', pillars: false, patches: true }, 1, { feel: { ...NOW, fieldBase: 900 } });
  const c = r.s.curves[0];
  const plain = r.motion({ ...c, x: -999, y: -999 });
  const ice = r.patches.find((p) => p.kind === 'ice');
  const mud = r.patches.find((p) => p.kind === 'mud');
  assert.equal(r.motion({ ...c, x: ice.x, y: ice.y }).r, plain.r * ARENA_NUMBERS.ice.radius);
  assert.equal(r.motion({ ...c, x: mud.x, y: mud.y }).v, plain.v * ARENA_NUMBERS.mud.speed);
});

test('an edge kills on every shape; an open wall leads across the middle', () => {
  for (const shape of ['circle', 'hexagon', 'ring', 'cross']) {
    const r = round({ shape, size: 'normal', pillars: false, patches: false }, 1, { seed: 9 });
    toDraw(r);
    let died = null;
    for (let i = 0; i < 4000 && !died; i++) died = r.step().find((e) => e.e === 'die');
    assert.ok(died, `${shape}: straight on ends at an edge`);
    assert.equal(died.by, null);
  }
  const r = round({ shape: 'circle', size: 'normal', pillars: false, patches: false }, 1, { seed: 9 });
  const c = { x: r.floor.cx + r.floor.R + 1, y: r.floor.cy, a: 0 };
  assert.equal(r.wrap(c, r.floor.cx + r.floor.R - 1, r.floor.cy, 1), true);
  assert.ok(Math.abs(c.x - (r.floor.cx - r.floor.R + 1)) < 1e-9, 'across the middle');
});

test('every arena stays deterministic when actions come late', () => {
  for (const shape of SHAPES) {
    const players4 = players(4);
    const start = new Match({ players: players4, feel: { ...CLASSIC, freeTime: 0.5, hit: 1 }, mode: { rate: 4, powerups: ['closingWalls', 'movingPowerups', 'openWalls', 'switch'] }, arena: { shape, size: 'normal', pillars: true, patches: true }, seed: 11 }).nextRound();
    let x = 7;
    const rand = () => (x = (Math.imul(x, 1103515245) + 12345) >>> 0) / 4294967296;
    const acts = [];
    const num = [0, 0, 0, 0];
    for (let f = 0; f < 1200; f++) for (let p = 0; p < 4; p++) if (rand() < 0.06) acts.push({ player: p, num: ++num[p], frame: f, sub: Math.floor(rand() * 1000), dir: [-1, 0, 1][Math.floor(rand() * 3)], press: 0 });
    const a = new Timeline(start);
    for (const q of acts) a.add(q);
    a.advanceTo(1200);
    const b = new Timeline(start);
    for (let k = 0; k <= 1215; k++) {
      for (const q of acts) if (q.frame + (q.num % 15) === k) b.add(q);
      b.advanceTo(Math.min(k, 1200));
    }
    b.advanceTo(1200);
    assert.equal(b.round.hash(), a.round.hash(), shape);
  }
});

test('a powerup lands only where it’s free: none on a floor full of pillars, every one in the gap', () => {
  const r = round({ shape: 'square', size: 'normal', pillars: true, patches: false }, 2, { mode: { rate: 1, powerups: ['greenSpeed'] } });
  toDraw(r);
  // pillars all over the floor, 40 apart (each 60 wide): nowhere for a disc
  const all = [];
  for (let x = 0; x <= r.W + 40; x += 40) for (let y = 0; y <= r.H + 40; y += 40) all.push({ kind: 'square', x, y, r: 30 });
  r.pillars = all;
  for (let i = 0; i < 40; i++) r.spawn(r.k, r.rectAt(r.k), []);
  assert.equal(r.s.powerups.length, 0, 'no free spot, no powerup');
  // a clearing in the middle: every disc lands in it
  const cx = r.W / 2, cy = r.H / 2;
  r.pillars = all.filter((p) => Math.abs(p.x - cx) > 110 || Math.abs(p.y - cy) > 110);
  for (let i = 0; i < 40; i++) r.spawn(r.k, r.rectAt(r.k), []);
  assert.ok(r.s.powerups.length > 0);
  for (const p of r.s.powerups) assert.ok(!hitsPillar(r.pillars, p.x, p.y, CLASSIC.powerupRadius), 'in the clearing');
});

test('a square pillar hits by the distance to the square, also at its corners', () => {
  const sq = [{ kind: 'square', x: 0, y: 0, r: 10 }];
  const hr = CLASSIC.hit / 2;
  assert.equal(hitsPillar(sq, 10 + hr - 0.01, 0, hr), true, 'beside it');
  assert.equal(hitsPillar(sq, 10 + hr + 0.01, 0, hr), false);
  assert.equal(hitsPillar(sq, 11.7, 11.7, hr), true, '2.4 from the corner');
  assert.equal(hitsPillar(sq, 11.9, 11.9, hr), false, '2.69 from the corner');
});
