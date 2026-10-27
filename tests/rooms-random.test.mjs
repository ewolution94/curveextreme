// Room codes and seeds come from the random source the rooms are given (crypto's in the server),
// never from Math.random: a fake source here decides both.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRooms } from '../server/rooms.mjs';
import { Match } from '../shared/engine.mjs';
import { CLASSIC } from '../shared/feel.mjs';
import { encode, decode } from '../shared/wire.mjs';
import { UP, DOWN } from '../shared/protocol.mjs';

const PROFILES = { list: () => [], get: () => null, save: () => null };

/** A socket the rooms can talk to: it keeps what it was sent. */
function socket() {
  const on = {}, got = [];
  return { on: (e, fn) => (on[e] = fn), sendBinary: (b) => got.push(decode(b)), close() {}, got, send: (type, payload) => on.message(encode([type, payload]), true), drop: () => on.close?.() };
}

test('room codes and seeds come from the given random source', async () => {
  const calls = [];
  const SEED = 0x9e3779b9;
  const randomInt = (n) => (calls.push(n), n === 2 ** 32 ? SEED : 0);
  const rooms = createRooms({ profiles: PROFILES, randomInt });

  const r = rooms.reserve(null, { id: 'id-anna-0000', secret: 'secret-anna-0000', name: 'Anna', colour: null, avatar: null });
  assert.equal(r.status, 200);
  assert.match(r.body.code, /^(.)\1{3}$/, 'four times the first letter: every pick was the source’s 0');
  assert.equal(calls.length, 4);

  const ws = socket();
  rooms.connect(ws, r.body.session);
  ws.send(UP.START, {});
  assert.deepEqual(calls.slice(4), [2 ** 32], 'one draw for the game’s seed');
  const start = await new Promise((resolve, reject) => {
    const t0 = Date.now();
    (function look() {
      const m = ws.got.find(([type]) => type === DOWN.ROUND_START);
      if (m) return resolve(m[1].start);
      if (Date.now() - t0 > 3000) return reject(new Error('no round started'));
      setTimeout(look, 20);
    })();
  });
  const expected = new Match({ players: [{ id: 'x', team: 0 }], feel: CLASSIC, mode: { rate: 1, powerups: [] }, seed: SEED }).nextRound().seed;
  assert.equal(start.seed, expected, 'the round’s seed follows from the drawn one');
  ws.send(UP.STOP, {});
  ws.drop();
});
