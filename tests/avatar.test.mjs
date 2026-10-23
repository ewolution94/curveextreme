// The server's avatar ranges are the token emblem's (vendor/ewo): a new Folio with other ranges fails here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR_PARTS, cleanAvatar } from '../server/avatar.mjs';
import { emblemRanges } from '../vendor/ewo/elements/emblem-core.js';

test('the server checks the token emblem’s ranges', () => {
  assert.deepEqual([...AVATAR_PARTS], emblemRanges('token'));
});

test('a bad avatar becomes a random valid one', () => {
  assert.deepEqual(cleanAvatar([1, 2, 3]), [1, 2, 3]);
  for (const bad of [null, [1, 2], [99, 0, 0], ['a', 0, 0], [1.5, 0, 0]]) {
    const a = cleanAvatar(bad);
    assert.equal(a.length, 3);
    a.forEach((v, i) => assert.ok(v >= 0 && v < AVATAR_PARTS[i]));
  }
});
