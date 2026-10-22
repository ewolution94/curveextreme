// The real server over real WebSockets: a room with a code, two players, a round, inputs acked,
// a late joiner who gets the field so far. Short: the still and free phases are tuned to zero.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PORT = 6900 + Math.floor(Math.random() * 90);

function startServer() {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'cx-'));
  const child = spawn(process.execPath, ['server/server.mjs', '--port', String(PORT)], {
    env: { ...process.env, HOST: '127.0.0.1', DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return new Promise((resolve) => child.stdout.once('data', () => resolve(child)));
}

function client(id) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const inbox = [];
  const waiters = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    inbox.push(msg);
    for (const w of [...waiters]) if (w.test(msg)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(msg); }
  });
  const api = {
    ws, inbox,
    send: (m) => ws.send(JSON.stringify(m)),
    next: (test, ms = 3000) => {
      const found = inbox.find(test);
      if (found) { inbox.splice(inbox.indexOf(found), 1); return Promise.resolve(found); }
      return new Promise((resolve, reject) => {
        const w = { test, resolve: (m) => { inbox.splice(inbox.indexOf(m), 1); resolve(m); } };
        waiters.push(w);
        setTimeout(() => reject(new Error(`timed out waiting (${id})`)), ms);
      });
    },
  };
  return new Promise((resolve) => ws.addEventListener('open', () => {
    api.send({ t: 'hello', id: `id-${id}-0000`, secret: `secret-${id}-0000`, name: id, colour: '#ff4d4d' });
    resolve(api);
  }));
}

test('a room: create, join, play a round, ack inputs, join late', async () => {
  const server = await startServer();
  try {
    const a = await client('anna');
    await a.next((m) => m.t === 'hi');
    a.send({ t: 'create' });
    const room = await a.next((m) => m.t === 'room');
    assert.match(room.code, /^[A-Z]{4}$/);
    assert.equal(room.host, 'id-anna-0000');

    const b = await client('ben');
    b.send({ t: 'join', code: room.code });
    const seen = await b.next((m) => m.t === 'room' && m.members.length === 2);
    const colours = seen.members.map((m) => m.colour);
    assert.notEqual(colours[0], colours[1], 'two players, two colours');

    // only the host changes settings
    b.send({ t: 'settings', patch: { mode: 'none' } });
    a.send({ t: 'settings', patch: { mode: 'none', feel: { stillTime: 0, freeTime: 0 } } });
    const set = await a.next((m) => m.t === 'room' && m.settings.mode === 'none');
    assert.equal(set.settings.feel.stillTime, 0);

    a.send({ t: 'start' });
    const round = await b.next((m) => m.t === 'round');
    assert.equal(round.curves.length, 2);
    assert.equal(round.rate, 50);

    b.send({ t: 'in', s: 1, d: 1 });
    const acked = await b.next((m) => m.t === 's' && m.a?.['id-ben-0000'] === 1);
    assert.ok(acked.c.length >= 1);

    a.send({ t: 'ping', c: 123 });
    assert.equal((await a.next((m) => m.t === 'pong')).c, 123);

    // a third page in the middle of the round gets the round and the lines so far
    await new Promise((r) => setTimeout(r, 300));
    const c = await client('cleo');
    c.send({ t: 'join', code: room.code });
    await c.next((m) => m.t === 'round');
    const snap = await c.next((m) => m.t === 'snap');
    assert.ok(snap.runs.length >= 1, 'lines so far');
    const view = await c.next((m) => m.t === 'room' && m.members.length === 3);
    assert.equal(view.members.find((m) => m.id === 'id-cleo-0000').playing, false, 'watches until the next game');

    for (const x of [a, b, c]) x.ws.close();
  } finally {
    server.kill('SIGTERM');
  }
});
