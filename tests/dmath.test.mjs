// The simulation's own sine and cosine: within one unit in the last place of Math's, and made of
// nothing but +, −, ×, ÷ and rounding, so every engine computes the same bits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sin, cos, norm, PI, TAU } from '../shared/dmath.mjs';

test('sine and cosine agree with Math to a unit in the last place', () => {
  let worst = 0;
  for (let i = 0; i <= 200000; i++) {
    const x = -40 + (80 * i) / 200000;
    worst = Math.max(worst, Math.abs(sin(x) - Math.sin(x)), Math.abs(cos(x) - Math.cos(x)));
  }
  assert.ok(worst <= 2.3e-16, `worst ${worst}`);
});

test('the easy values come out exactly', () => {
  assert.equal(sin(0), 0);
  assert.equal(cos(0), 1);
  assert.equal(sin(-0.25), -sin(0.25));
  assert.equal(cos(-0.25), cos(0.25));
});

test('angles are kept in [−π, π)', () => {
  for (const a of [0, 3.2, -3.2, 10, -10, PI, -PI]) {
    const n = norm(a);
    assert.ok(n >= -PI && n < PI, `${a} → ${n}`);
    assert.ok(Math.abs(Math.sin(n) - Math.sin(a)) < 1e-12);
  }
  assert.equal(norm(TAU + 1), norm(1));
});
