// A room on the server: the connection, the room's state (lobby, game, results), the round's world,
// your steering and its log (for the prediction), the stats of the game you're in, and XP at the end.

import * as net from './net';
import { World } from './world';
import { Steering } from './input';
import { identity, saveIdentity } from './store';
import { recordGame, type Stats } from './progress';
import { prefs } from './prefs.svelte';
import { sfx } from './sound';
import type { Pending } from './predict';

export type Member = { id: string; name: string; colour: string; team: number; connected: boolean; playing: boolean };
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
});

net.on('room', (v: RoomView) => {
  online.view = v;
  if (v.phase !== 'results') online.results = null;
  net.setRejoin(v.code);
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
    net.setRejoin(null);
    online.view = null;
    if (location.pathname !== '/') history.replaceState(null, '', '/');
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

export function start() {
  const id = identity();
  net.setHello({ id: id.id, secret: id.secret, name: id.name || 'Player', colour: id.colour });
  net.connect();
}

export function updateMe(patch: { name?: string; colour?: string; team?: number }) {
  if (patch.name !== undefined || patch.colour !== undefined) saveIdentity(patch);
  const id = identity();
  net.setHello({ id: id.id, secret: id.secret, name: id.name || 'Player', colour: id.colour });
  if (online.view) net.send({ t: 'me', ...patch });
}

export const createRoom = () => {
  online.error = '';
  net.send({ t: 'create' });
};
export const joinRoom = (code: string) => {
  online.error = '';
  net.setRejoin(code.toUpperCase());
  net.send({ t: 'join', code: code.toUpperCase() });
};
export function leaveRoom() {
  net.send({ t: 'leave' });
  net.setRejoin(null);
  online.view = null;
  online.results = null;
  history.replaceState(null, '', '/');
}
export const settings = (patch: object) => net.send({ t: 'settings', patch });
export const startGame = () => net.send({ t: 'start' });
export const stopGame = () => net.send({ t: 'stop' });
export const saveProfile = (feel: object) => net.send({ t: 'saveProfile', feel });
export const isHost = () => online.view?.host === me.id;
