// A room on the server: the connection, the room's state (lobby, game, results), the round's world,
// your steering and its log (for the prediction), the stats of the game you're in, and XP at the end.

import * as net from './net';
import { World } from './world';
import { Steering } from './input';
import { forgetRoom, identity, rememberRoom, saveIdentity } from './store';
import { recordGame, type Stats } from './progress';
import { prefs } from './prefs.svelte';
import { sfx } from './sound';
import type { Pending } from './predict';

export type Member = { id: string; name: string; colour: string; avatar: number[]; team: number; connected: boolean; playing: boolean };
export type RoomView = {
  code: string;
  host: string;
  phase: 'lobby' | 'playing' | 'results';
  settings: any;
  members: Member[];
  results: any;
};

export const online = $state({
  open: false,
  /** For the connection pill (Folio's <ewo-connection>). */
  conn: 'connecting' as 'online' | 'connecting' | 'reconnecting',
  everOpen: false,
  view: null as RoomView | null,
  results: null as any,
  profiles: { builtIn: [] as any[], saved: [] as any[] },
  error: '',
  xpGained: 0,
  version: 0, // bumps when the scoreboard or banners should look again
});

export const world = new World();
const me = identity();
export const myId = () => me.id;

// your inputs, numbered; the server says which one it applied last (world.acks)
let seq = 0;
let log: { seq: number; dir: number; press: number; time: number }[] = [];
let ackedDir = 0;

let game = freshStats();
let roundAlive = { since: 0, survived: false };
function freshStats(): Partial<Stats> & { gaps: number } {
  return { rounds: 0, roundsSurvived: 0, kills: 0, deaths: 0, powerups: 0, gaps: 0, turnsLeft: 0, turnsRight: 0, distance: 0, longestRound: 0 };
}

export const steering = new Steering((dir, press) => {
  seq++;
  log.push({ seq, dir, press, time: performance.now() });
  if (log.length > 120) {
    const old = log.shift()!;
    if (old.seq <= (world.acks[me.id] ?? 0)) ackedDir = old.dir;
  }
  if (press === -1) game.turnsLeft! += 1;
  if (press === 1) game.turnsRight! += 1;
  net.send({ t: 'in', s: seq, d: dir, p: press || undefined });
}, prefs.both);

/** Your curve's inputs for the prediction: what the server applies now, and what it will apply. */
export function inputFor(): { dir0: number; pending: Pending[] } {
  const ack = world.acks[me.id] ?? 0;
  let dir0 = ackedDir;
  const pending: Pending[] = [];
  const lead = net.rtt();
  for (const e of log) {
    if (e.seq <= ack) dir0 = e.dir;
    else pending.push({ tick: Math.max(world.k + 1, world.k + Math.ceil((e.time - world.arrival + lead) / world.dtMs)), dir: e.dir, press: e.press });
  }
  return { dir0, pending };
}

/** How far ahead your own curve is drawn: half the trip there plus half back (ms). */
export const aheadMs = () => net.rtt();

net.onOpenChange((open) => {
  online.open = open;
  if (open) online.everOpen = true;
  online.conn = open ? 'online' : online.everOpen ? 'reconnecting' : 'connecting';
});

/** Once the socket is open (at once if it is): a button can wait through a reconnect. */
function whenOpen(signal?: AbortSignal): Promise<void> {
  if (net.isOpen()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const off = net.onOpenChange((open) => {
      if (!open) return;
      off();
      resolve();
    });
    signal?.addEventListener('abort', () => {
      off();
      reject(Object.assign(new Error('timeout'), { code: 'timeout' }));
    });
  });
}

/** The next message `test` accepts (or the server's error), as a promise a waiting button can hold. */
function until<T>(test: (msg: any) => T | undefined, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const off = net.on('*', (m) => {
      if (m.t === 'error') {
        off();
        reject(Object.assign(new Error(m.code), { code: m.code }));
        return;
      }
      const v = test(m);
      if (v !== undefined) {
        off();
        resolve(v);
      }
    });
    signal?.addEventListener('abort', () => {
      off();
      reject(Object.assign(new Error('timeout'), { code: 'timeout' }));
    });
  });
}

net.on('room', (v: RoomView) => {
  online.view = v;
  online.error = '';
  if (v.phase !== 'results') online.results = null;
  net.setRejoin(v.code);
  rememberRoom(v.code);
  if (location.pathname !== `/${v.code}`) history.replaceState(null, '', `/${v.code}`);
});
net.on('profiles', (m) => {
  online.profiles = { builtIn: m.builtIn, saved: m.saved };
});
net.on('round', (m) => {
  world.round(m);
  if (m.no === 1) game = freshStats();
  roundAlive = { since: 0, survived: false };
  online.version++;
});
net.on('snap', (m) => {
  world.snap(m);
  online.version++;
});
net.on('s', (m) => {
  world.tick(m);
  // distance and gaps for the stats
  for (const [cid, , , , bits] of m.c) {
    const c = world.curves.get(cid);
    if (!c || c.pid !== me.id || world.k <= world.free) continue;
    game.distance! += c.m.v / world.rate;
    const prev = c.hist[c.hist.length - 2];
    if (prev && prev.bits & 1 && !(bits & 1) && !(bits & 4)) game.gaps += 1;
  }
});
net.on('over', (m) => {
  online.results = m.results;
  const r = m.results;
  const mine = r.standings.find((s: any) => s.id === me.id);
  if (!mine) return;
  const won = r.type === 'teams' ? r.winner === mine.team : r.winner === me.id;
  online.xpGained = recordGame(mine.points, won, game);
  sfx.match(won);
});
net.on('error', (m) => {
  online.error = m.code;
  if (m.code === 'no-room') {
    const gone = online.view?.code ?? location.pathname.slice(1).toUpperCase();
    forgetRoom(gone);
    net.setRejoin(null);
    online.view = null;
    online.results = null;
  }
});

world.onEvent((ev, w) => {
  switch (ev.e) {
    case 'phase':
      if (ev.p === 'draw') {
        sfx.go();
        roundAlive.since = w.k;
      }
      if (ev.p === 'linger') {
        const mine = w.type === 'teams' ? ev.winner === myTeam() : ev.winner === me.id;
        roundAlive.survived = mine;
        sfx.round(mine);
      }
      online.version++;
      break;
    case 'score':
      if (ev.died.includes(me.id)) {
        game.deaths! += 1;
        game.longestRound = Math.max(game.longestRound ?? 0, (w.k - roundAlive.since) / w.rate);
      }
      online.version++;
      break;
    case 'roundEnd':
      game.rounds! += 1;
      if (roundAlive.survived) {
        game.roundsSurvived! += 1;
        game.longestRound = Math.max(game.longestRound ?? 0, (w.k - roundAlive.since) / w.rate);
      }
      online.version++;
      break;
    case 'die':
      if (ev.by === me.id) game.kills! += 1;
      sfx.crash(ev.pid === me.id);
      break;
    case 'pu+':
      sfx.spawn();
      break;
    case 'pu-':
      if (ev.pid === me.id) game.powerups! += 1;
      sfx.pick(ev.pid === me.id);
      break;
  }
});

function myTeam() {
  return online.view?.members.find((m) => m.id === me.id)?.team ?? 0;
}

function hello() {
  const id = identity();
  net.setHello({ id: id.id, secret: id.secret, name: id.name || 'Player', colour: id.colour, avatar: id.avatar });
}

export function start() {
  hello();
  net.connect();
}

export function updateMe(patch: { name?: string; colour?: string; team?: number; avatar?: number[] }) {
  const { team, ...mine } = patch;
  if (Object.keys(mine).length) saveIdentity(mine);
  hello();
  if (online.view) net.send({ t: 'me', ...patch });
  void team;
}

/** A new room; resolves once its view is here (the button that asked waits for it). */
export async function createRoom(signal?: AbortSignal) {
  online.error = '';
  await whenOpen(signal);
  const done = until((m) => (m.t === 'room' ? m : undefined), signal);
  net.send({ t: 'create' });
  return done;
}
/** Into a room by its code; resolves with its view, rejects with the server's code (no-room, full). */
export function joinRoom(code: string, signal?: AbortSignal) {
  online.error = '';
  const c = code.toUpperCase();
  const done = until((m) => (m.t === 'room' && m.code === c ? m : undefined), signal);
  // A closed socket sends the join itself once it opens (net.setRejoin).
  const send = net.isOpen();
  net.setRejoin(c);
  if (send) net.send({ t: 'join', code: c });
  return done;
}
/** Is there a room with this code, and room in it? */
export async function peekRoom(code: string, signal?: AbortSignal): Promise<{ exists: boolean; full: boolean }> {
  await whenOpen(signal);
  const c = code.toUpperCase();
  const done = until((m) => (m.t === 'peek' && m.code === c ? m : undefined), signal);
  net.send({ t: 'peek', code: c });
  return done;
}
export function leaveRoom() {
  if (online.view) forgetRoom(online.view.code);
  net.send({ t: 'leave' });
  net.setRejoin(null);
  online.view = null;
  online.results = null;
  online.error = '';
  history.replaceState(null, '', '/');
}
export const settings = (patch: object) => net.send({ t: 'settings', patch });
export function startGame(signal?: AbortSignal) {
  const done = until((m) => (m.t === 'room' && m.phase === 'playing' ? m : undefined), signal);
  net.send({ t: 'start' });
  return done;
}
export function stopGame(signal?: AbortSignal) {
  const done = until((m) => (m.t === 'room' && m.phase === 'lobby' ? m : undefined), signal);
  net.send({ t: 'stop' });
  return done;
}
export const saveProfile = (feel: object) => net.send({ t: 'saveProfile', feel });
export const isHost = () => online.view?.host === me.id;
