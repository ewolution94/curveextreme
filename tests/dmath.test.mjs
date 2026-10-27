// The simulation's own sine, cosine and arctangent: within one unit in the last place of Math's, and made of
// nothing but +, −, ×, ÷ and rounding, so every engine computes the same bits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sin, cos, norm, atan2, PI, TAU } from '../shared/dmath.mjs';

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

test('atan2 agrees with Math.atan2 to the last bits, in every quadrant and on the axes', () => {
  let worst = 0, x = 0.37;
  for (let i = 0; i < 20000; i++) {
    x = (x * 9301 + 49297) % 233280; // a fixed walk through every quadrant and many sizes
    const u = (x / 233280) * 2 - 1, v = ((x * 7) % 233280) / 116640 - 1;
    const scale = 10 ** ((i % 7) - 3);
    worst = Math.max(worst, Math.abs(atan2(v * scale, u) - Math.atan2(v * scale, u)));
  }
  assert.ok(worst < 1e-15, `worst ${worst}`);
  assert.equal(atan2(0, 1), 0);
  assert.equal(atan2(1, 0), Math.PI / 2);
  assert.equal(atan2(-1, 0), -Math.PI / 2);
  assert.equal(atan2(0, -1), Math.PI);
  assert.equal(atan2(1, 1), Math.PI / 4);
});
