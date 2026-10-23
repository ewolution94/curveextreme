// The socket's binary format: everything comes back as it went in; an action stays tiny.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode, decode } from '../shared/wire.mjs';
import { UP } from '../shared/protocol.mjs';

test('values come back as they went in', () => {
  const values = [
    null, true, false, 0, 1, 127, 128, 255, 256, 65535, 65536, 2 ** 32 - 1, -1, -32, -33, -128, -129, -32768, -32769, -(2 ** 31),
    0.5, -1.25, 1e300, 2 ** 40, Math.PI, '', 'Grün', 'x'.repeat(40), 'y'.repeat(300), 'z'.repeat(70000),
    [], [1, [2, [3]]], new Array(20).fill(7), {}, { a: 1, b: 'two', c: [true, null], ü: { deep: -0.5 } },
  ];
  for (const v of values) assert.deepEqual(decode(encode(v)), v);
  assert.deepEqual(decode(encode({ a: undefined, b: 1 })), { b: 1 });
});

test('a steering action is about a dozen bytes', () => {
  const bytes = encode([UP.ACTION, [3, 1234, 4, 57, 812, -1, 0]]);
  assert.ok(bytes.length <= 14, `${bytes.length} bytes`);
});

test('malformed bytes throw instead of turning into something', () => {
  assert.throws(() => decode(new Uint8Array([0x92, 1])));
  assert.throws(() => decode(new Uint8Array([0xc1])));
  assert.throws(() => decode(new Uint8Array([1, 2])));
  assert.throws(() => decode(encode({ __proto__x: 1 }).map((b) => b)) && decode(new Uint8Array([0x81, 0xa9, ...new TextEncoder().encode('__proto__'), 1])));
});
