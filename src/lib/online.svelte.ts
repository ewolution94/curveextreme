// A room on the server, as this page plays it: the line (net.ts), the room's view (who's in, the
// settings, the phase), and the round, simulated here on the server's clock (runner.ts). Your
// steering goes into the round at once and to the server as an action; the others' actions come
// relayed and rewind the round if they're late; a rejected action of yours is taken back and your
// steering sent again. The server's word on who's out and on the points decides. Stats for the
// game you're in, and XP at its end.

import * as net from './net';
import * as clock from './clock';
import { RoundRunner, type RoundEvent } from './runner';
import { Steering } from './input';
import { forgetRoom, identity, rememberRoom, saveIdentity } from './store';
import { recordGame, type Stats } from './progress';
import { sfx } from './sound';
import { UP, DOWN, NET, toAction, fromAction } from '../../shared/protocol.mjs';

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
  /** For the connection pill (Folio's <ewo-connection>). */
  conn: 'online' as net.LineState,
  view: null as RoomView | null,
  results: null as any,
  profiles: { builtIn: [] as any[], saved: [] as any[] },
  error: '',
  xpGained: 0,
  /** The next round's number while it counts down. */
  countdown: null as null | { no: number; at: number },
  version: 0, // bumps when the scoreboard or banners should look again
});

/** The round being played (not reactive: read it under online.version). */
export const game = { runner: null as RoundRunner | null };

const me = identity();
export const myId = () => me.id;

let num = 0; // your last action's number this round
let stats = freshStats();
function freshStats(): Partial<Stats> {
  return { rounds: 0, roundsSurvived: 0, kills: 0, deaths: 0, powerups: 0, gaps: 0, turnsLeft: 0, turnsRight: 0, distance: 0, longestRound: 0 };
}

/** Your player number in the round being played, or −1 (watching). */
function mine() {
  return game.runner ? game.runner.playerOf(me.id) : -1;
}

/** Your steering into the round, and to the server, when it changes. */
export const steering = new Steering((dir, press, time) => {
  if (press === -1) stats.turnsLeft! += 1;
  if (press === 1) stats.turnsRight! += 1;
  steer(dir, press, time);
});

function steer(dir: number, press: number, time = performance.now()) {
  const r = game.runner;
  const p = mine();
  if (!r || p < 0 || r.round.phase === 'done') return;
  if (!press && r.lastDir(p) === dir) return;
  const a = r.local(p, dir, press, ++num, time);
  net.send(UP.ACTION, fromAction({ ...a, round: r.no }));
}

function who(): net.Who {
  const id = identity();
  return { id: id.id, secret: id.secret, name: id.name || 'Player', colour: id.colour, avatar: id.avatar };
}

// ---- the round -------------------------------------------------------------------------------

function newRound(start: any, at: number, past?: { actions: any[]; deaths: [number, number][]; nums: number[] }) {
  finishStats();
  const zero = () => clock.toPage(at);
  const p = start.players.findIndex((x: any) => x.id === me.id);
  const r = new RoundRunner(start, zero, { own: p >= 0 ? [p] : [], shift: p >= 0 ? 0 : -NET.watch });
  for (const a of past?.actions ?? []) r.insert(toAction(a));
  for (const [k, q] of past?.deaths ?? []) r.kill(k, q);
  num = p >= 0 ? (past?.nums?.[p] ?? 0) : 0;
  r.on(onEvent);
  game.runner = r;
  online.countdown = null;
  online.version++;
  // keys held while the round started: that direction from its first frame
  if (p >= 0 && steering.dir() !== 0) steer(steering.dir(), 0);
}

function onEvent(e: RoundEvent) {
  const r = game.runner;
  if (!r) return;
  const p = mine();
  switch (e.e) {
    case 'phase':
      if (e.p === 'draw') sfx.go();
      if (e.p === 'linger') {
        const won = r.start.type === 'teams' ? p >= 0 && e.winner === r.start.players[p].team : e.winner === p;
        sfx.round(won && p >= 0);
      }
      break;
    case 'die':
      if (p >= 0 && e.by === p) stats.kills! += 1;
      if (e.p === p && !r.round.playerAlive(p)) stats.deaths! += 1;
      sfx.crash(e.p === p);
      break;
    case 'pu+':
      sfx.spawn();
      break;
    case 'pu-':
      if (e.p === p) stats.powerups! += 1;
      sfx.pick(e.p === p);
      break;
  }
  if (['phase', 'score', 'done', 'die'].includes(e.e)) online.version++;
}

/** The round that just ended into the game's stats (once). */
const counted = new WeakSet<RoundRunner>();
function finishStats() {
  const r = game.runner;
  const p = mine();
  if (!r || p < 0 || r.round.phase !== 'done' || counted.has(r)) return;
  counted.add(r);
  const s = r.round.s;
  stats.rounds! += 1;
  stats.distance! += s.dist[p];
  stats.gaps! += s.gaps[p];
  const lived = s.deadAt[p] < 0 ? s.k : s.deadAt[p];
  stats.longestRound = Math.max(stats.longestRound ?? 0, Math.max(0, lived - r.round.freeK) / r.round.rate);
  if (s.deadAt[p] < 0) stats.roundsSurvived! += 1;
}

// ---- messages --------------------------------------------------------------------------------

net.onState((s) => (online.conn = s));

net.on(DOWN.INIT, (m) => {
  clock.roughly(m.now);
  setView(m.view);
  online.profiles = m.profiles;
  online.countdown = m.countdown ? { no: m.countdown.no, at: m.countdown.at } : null;
  if (m.round) newRound(m.round.start, m.round.at, m.round);
  else game.runner = null;
  online.version++;
});

net.on(DOWN.UPDATE, (m) => {
  if (m.view) setView(m.view);
  if (m.profiles) online.profiles = m.profiles;
  if (m.deaths && game.runner) for (const [k, q] of m.deaths) game.runner.kill(k, q);
  if (m.points || m.deaths) online.version++;
});

net.on(DOWN.COUNTDOWN_START, (m) => {
  online.countdown = { no: m.no, at: m.at };
  online.version++;
});
net.on(DOWN.COUNTDOWN_STOP, () => {
  online.countdown = null;
  online.version++;
});

net.on(DOWN.ROUND_START, (m) => newRound(m.start, m.at));

net.on(DOWN.ACTION_ADD, (a) => {
  const r = game.runner;
  const x = toAction(a);
  if (r && x.round === r.no) r.insert(x);
});

net.on(DOWN.ACTION_REMOVE, ([round, player, n]) => {
  const r = game.runner;
  if (r && round === r.no) r.remove(player, n);
});

/** Too late: taken back, and what you're holding now sent again. */
net.on(DOWN.ACTION_REJECT, ([round, player, n]) => {
  const r = game.runner;
  if (!r || round !== r.no) return;
  r.remove(player, n);
  if (player === mine()) steer(steering.dir(), 0);
});

net.on(DOWN.KICKED, () => {
  online.error = 'kicked';
});

net.on(DOWN.ERROR, (m) => {
  online.error = m.code;
});

net.onEnd((code) => {
  if (online.view) forgetRoom(online.view.code);
  online.error = code;
  online.view = null;
  online.results = null;
  game.runner = null;
  online.version++;
});

function setView(v: RoomView) {
  const before = online.view?.phase;
  online.view = v;
  online.error = '';
  rememberRoom(v.code);
  if (location.pathname !== `/${v.code}`) history.replaceState(null, '', `/${v.code}`);
  if (v.phase === 'lobby') {
    game.runner = null;
    online.countdown = null;
    online.results = null;
  }
  if (v.phase === 'playing' && before !== 'playing') {
    stats = freshStats();
    online.results = null;
  }
  if (v.phase === 'results' && before !== 'results' && v.results) {
    finishStats();
    online.results = v.results;
    const mineAt = v.results.standings.find((s: any) => s.id === me.id);
    if (mineAt && before === 'playing') {
      const won = v.results.type === 'teams' ? v.results.winner === mineAt.team : v.results.winner === me.id;
      online.xpGained = recordGame(mineAt.points, won, stats);
      sfx.match(won);
    }
  }
  online.version++;
}

// ---- what the page asks for ------------------------------------------------------------------

export function updateMe(patch: { name?: string; colour?: string; team?: number; avatar?: number[] }) {
  const { team, ...mine } = patch;
  if (Object.keys(mine).length) saveIdentity(mine);
  if (online.view) net.send(UP.ME, patch);
  void team;
}

/** Waits for the room's first message after a reservation (the button that asked holds). */
function entered(code: string, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const done = () => {
      offInit();
      offEnd();
    };
    const offInit = net.on(DOWN.INIT, (m) => {
      if (m.view.code !== code) return;
      done();
      resolve();
    });
    const offEnd = net.onEnd((why) => {
      done();
      reject(new net.NetError(why));
    });
    signal?.addEventListener('abort', () => {
      done();
      reject(new net.NetError('timeout'));
    });
  });
}

async function enter(code: string | null, signal?: AbortSignal) {
  online.error = '';
  const seat = await net.reserve(code, who(), signal);
  const ready = entered(seat.code, signal);
  net.connect(seat.code, seat.session, who);
  await ready;
}

/** A new room; resolves once it's here (the button that asked waits for it). */
export const createRoom = (signal?: AbortSignal) => enter(null, signal);

/** Into a room by its code; rejects with the server's reason (no-room, full, kicked). */
export const joinRoom = (code: string, signal?: AbortSignal) => enter(code.toUpperCase(), signal);

/** Is there a room with this code, and room in it? */
export const peekRoom = (code: string, signal?: AbortSignal) => net.peek(code.toUpperCase(), signal);

export function leaveRoom() {
  if (online.view) forgetRoom(online.view.code);
  net.send(UP.LEAVE, {});
  net.disconnect();
  online.view = null;
  online.results = null;
  online.error = '';
  online.countdown = null;
  game.runner = null;
  history.replaceState(null, '', '/');
}

export const settings = (patch: object) => net.send(UP.SETTINGS, patch);
export const saveProfile = (feel: object) => net.send(UP.SAVE_PROFILE, feel);
export const kick = (id: string) => net.send(UP.KICK, { id });

/** Resolves once the view reaches a phase (a waiting button holds until then). */
function phaseIs(phase: RoomView['phase'], signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const off = net.on(DOWN.UPDATE, (m) => {
      if (m.view?.phase !== phase) return;
      off();
      resolve();
    });
    signal?.addEventListener('abort', () => {
      off();
      reject(new net.NetError('timeout'));
    });
  });
}

export function startGame(signal?: AbortSignal) {
  const done = phaseIs('playing', signal);
  net.send(UP.START, {});
  return done;
}

export function stopGame(signal?: AbortSignal) {
  const done = phaseIs('lobby', signal);
  net.send(UP.STOP, {});
  return done;
}

export const isHost = () => online.view?.host === me.id;
