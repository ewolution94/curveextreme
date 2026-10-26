// The real server over HTTP and real WebSockets: a seat reservation, the binary socket, a round
// started on the shared clock, an action relayed to the other page, a late one rejected, a late
// joiner given the round so far, a kick, the server's word on who's out, the next round. Short: the
// still and free phases are tuned down.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { encode, decode } from '../shared/wire.mjs';
import { UP, DOWN, toAction } from '../shared/protocol.mjs';
import { CLASSIC } from '../shared/feel.mjs';

const PORT = 6900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;

function startServer() {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'cx-'));
  const child = spawn(process.execPath, ['server/server.mjs', '--port', String(PORT)], {
    env: { ...process.env, HOST: '127.0.0.1', DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return new Promise((resolve) => child.stdout.once('data', () => resolve(child)));
}

const who = (name, secret = `secret-${name}-0000`) => ({ id: `id-${name}-0000`, secret, name });

async function reserve(code, person) {
  const res = await fetch(code ? `${BASE}/api/rooms/${code}/seats` : `${BASE}/api/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(person),
  });
  return { status: res.status, body: await res.json() };
}

function client(session, name) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?session=${session}`);
  ws.binaryType = 'arraybuffer';
  const inbox = [];
  const waiters = [];
  let closed = null;
  ws.addEventListener('close', (e) => {
    closed = e.code;
    for (const w of [...waiters]) if (w.type === 'close') (waiters.splice(waiters.indexOf(w), 1), w.resolve(e.code));
  });
  ws.addEventListener('message', (ev) => {
    const [type, payload] = decode(new Uint8Array(ev.data));
    inbox.push({ type, payload });
    for (const w of [...waiters]) {
      if (w.type === type && w.test(payload)) {
        waiters.splice(waiters.indexOf(w), 1);
        inbox.splice(inbox.findIndex((m) => m.payload === payload), 1);
        w.resolve(payload);
      }
    }
  });
  const api = {
    ws,
    send: (type, payload) => ws.send(encode([type, payload])),
    next(type, test = () => true, ms = 6000) {
      const i = inbox.findIndex((m) => m.type === type && test(m.payload));
      if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0].payload);
      return new Promise((resolve, reject) => {
        waiters.push({ type, test, resolve });
        setTimeout(() => reject(new Error(`${name}: no message ${type} in time`)), ms);
      });
    },
    closed(ms = 4000) {
      if (closed !== null) return Promise.resolve(closed);
      return new Promise((resolve, reject) => {
        waiters.push({ type: 'close', test: () => true, resolve });
        setTimeout(() => reject(new Error(`${name}: not closed`)), ms);
      });
    },
    /** The server's clock now, from one ping. */
    async serverNow() {
      const c = performance.now();
      api.send(UP.PING, [c]);
      const [, s] = await api.next(DOWN.PONG, (p) => p[0] === c);
      return s + (performance.now() - c) / 2;
    },
  };
  return api;
}

test('rooms: reservations, the binary socket, a round on the shared clock, actions, a kick', async () => {
  const server = await startServer();
  try {
    // a room, and a seat in it
    const ra = await reserve(null, who('anna'));
    assert.equal(ra.status, 200);
    assert.match(ra.body.code, /^[A-Z]{4}$/);
    const code = ra.body.code;
    const a = client(ra.body.session, 'anna');
    const initA = await a.next(DOWN.INIT);
    assert.equal(initA.view.host, 'id-anna-0000');
    assert.equal(initA.round, null);

    assert.deepEqual(await (await fetch(`${BASE}/api/rooms/${code.toLowerCase()}`)).json(), { exists: true, full: false });
    assert.equal((await (await fetch(`${BASE}/api/rooms/ZZZZ`)).json()).exists, code === 'ZZZZ');
    assert.equal((await reserve('ZZZQ', who('nobody'))).status, code === 'ZZZQ' ? 200 : 404);
    assert.equal((await reserve(code, who('anna', 'secret-wrong-0000'))).status, 403, 'someone else’s id');

    // a socket without a valid session is closed
    const stray = client('nonsense', 'stray');
    assert.equal(await stray.closed(), 4401);

    const rb = await reserve(code, who('ben'));
    assert.equal(rb.status, 200);
    const b = client(rb.body.session, 'ben');
    await b.next(DOWN.INIT);
    await a.next(DOWN.UPDATE, (u) => u.view?.members.filter((m) => m.connected).length === 2);

    // the host tunes the round short, and starts
    a.send(UP.SETTINGS, { feel: { ...CLASSIC, stillTime: 0.3, freeTime: 0, lingerTime: 0.3 } });
    await b.next(DOWN.UPDATE, (u) => u.view?.settings.feel.stillTime === 0.3);
    a.send(UP.START, {});
    const cd = await b.next(DOWN.COUNTDOWN_START);
    assert.equal(cd.no, 1);
    const { start, at } = await a.next(DOWN.ROUND_START);
    await b.next(DOWN.ROUND_START);
    assert.equal(start.players.length, 2);
    assert.equal(typeof start.seed, 'number');
    const me = start.players.findIndex((p) => p.id === 'id-anna-0000');
    const frameMs = 1000 / start.feel.tickRate;

    // an action for the frame the clock is in now reaches the other page
    const now = await a.serverNow();
    const frame = Math.max(0, Math.floor((now - at) / frameMs));
    const action = [start.no, frame, me, 1, 420, 1, 1];
    a.send(UP.ACTION, action);
    assert.deepEqual(await b.next(DOWN.ACTION_ADD), action);

    // one from before the server's frame (a slow connection) moves to the earliest frame still open:
    // the sender takes its copy back and gets the moved one, the others get the moved one
    await new Promise((r) => setTimeout(r, 700));
    a.send(UP.ACTION, [start.no, frame, me, 2, 900, 0, 0]);
    assert.deepEqual(await a.next(DOWN.ACTION_REMOVE), [start.no, me, 2]);
    const moved = await a.next(DOWN.ACTION_ADD, (x) => x[3] === 2);
    assert.ok(moved[1] > frame || (moved[1] === frame && moved[4] > 900), `moved to frame ${moved[1]}`);
    assert.deepEqual([moved[0], moved[2], moved[3], moved[5]], [start.no, me, 2, 0], 'the same action, later');
    assert.deepEqual(await b.next(DOWN.ACTION_ADD, (x) => x[3] === 2), moved);
    // a wrong round is rejected; one for another player is ignored
    a.send(UP.ACTION, [start.no + 5, frame + 40, me, 3, 0, 1, 0]);
    assert.deepEqual(await a.next(DOWN.ACTION_REJECT), [start.no + 5, me, 3]);
    a.send(UP.ACTION, [start.no, frame + 40, 1 - me, 4, 0, -1, 0]);

    // a late joiner watches, and gets the round so far
    const rc = await reserve(code, who('cara'));
    const c = client(rc.body.session, 'cara');
    const initC = await c.next(DOWN.INIT);
    assert.equal(initC.round.start.seed, start.seed);
    assert.deepEqual(initC.round.actions, [action, moved]);
    assert.equal(initC.view.members.find((m) => m.id === 'id-cara-0000').playing, false);

    // the host kicks the watcher: gone, and can't come back
    a.send(UP.KICK, { id: 'id-cara-0000' });
    await c.next(DOWN.KICKED);
    assert.equal(await c.closed(), 4403);
    assert.equal((await reserve(code, who('cara'))).status, 403);

    // nobody steers: both curves reach the walls; the server says who's out, then the next round
    const deaths = await b.next(DOWN.UPDATE, (u) => Array.isArray(u.deaths), 9000);
    assert.ok(deaths.deaths.every(([k, p]) => Number.isInteger(k) && (p === 0 || p === 1)));
    const pts = await b.next(DOWN.UPDATE, (u) => u.points, 9000);
    assert.equal(Object.keys(pts.points).length, 2);
    const next = await b.next(DOWN.COUNTDOWN_START, (x) => x.no === 2, 9000);
    assert.equal(next.no, 2);
    const r2 = await b.next(DOWN.ROUND_START, (x) => x.start.no === 2, 3000);
    assert.notEqual(r2.start.seed, start.seed);

    // the host ends the game: back in the lobby
    a.send(UP.STOP, {});
    await b.next(DOWN.UPDATE, (u) => u.view?.phase === 'lobby');
    a.ws.close();
    b.ws.close();
  } finally {
    server.kill();
  }
});

test('the action format is the guide’s positional array', () => {
  assert.deepEqual(toAction([3, 120, 1, 7, 500, -1, 0]), { round: 3, frame: 120, player: 1, num: 7, sub: 500, dir: -1, press: 0 });
});
