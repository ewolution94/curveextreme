// Rooms with a code, and the referee of their games (development/plans/curveextreme.md, "Netcode").
//
// Getting in takes two steps: an HTTP seat reservation (POST /api/rooms to open one, POST
// /api/rooms/CODE/seats to join; app.mjs) answers with a session, and the page opens the room's
// WebSocket with it. Everything on the socket is binary [type, payload] (shared/wire.mjs,
// shared/protocol.mjs).
//
// During a round nobody sends positions. The server sends the round's start (its seed and players)
// with the server time of frame 0; every page simulates the round itself on that shared clock. The
// pages send steering actions, each stamped with its frame and the moment within it; the server
// runs the same simulation NET.authority ms behind the clock, takes an action if its frame is still
// ahead of its own and relays it to everyone else, and rejects one that came too late. It owns the
// rest: who's in, the teams and colours, who's out (its word decides a disagreement), the scores,
// the rounds.

import { Match } from '../shared/engine.mjs';
import { Timeline } from '../shared/timeline.mjs';
import { BUILT_IN, cleanFeel } from '../shared/feel.mjs';
import { MODES } from '../shared/modes.mjs';
import { POWERUPS, POWERUP_KINDS } from '../shared/powerups.mjs';
import { isColour, freeColour } from '../shared/colours.mjs';
import { DEFAULT_ARENA, cleanArena } from '../shared/arenas.mjs';
import { encode, decode } from '../shared/wire.mjs';
import { UP, DOWN, NET, SUBS, toAction, fromAction } from '../shared/protocol.mjs';
import { cleanAvatar } from './avatar.mjs';

const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MAX_PLAYERS = 10;
const MAX_MEMBERS = MAX_PLAYERS * 2;
const MAX_ROOMS = 200;
const EMPTY_FOR = 10 * 60 * 1000; // an empty room goes after ten minutes
const SESSION_FOR = 60 * 1000; // a reservation not used within a minute lapses
const ID = /^[a-z0-9-]{8,64}$/i;

const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);
const int = (v) => Number.isInteger(v);
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

function defaultSettings() {
  return {
    type: 'ffa', // ffa | teams
    teams: 2,
    mode: 'basic',
    target: 0, // 0: the classic 10 × (players − 1)
    teamTarget: 10,
    powerups: [...MODES.basic.powerups], // used when the mode is Custom
    rate: 1, // Custom: how often powerups come
    feel: { ...BUILT_IN.classic },
    arena: { ...DEFAULT_ARENA }, // the floor's shape and size, pillars, ice and mud (shared/arenas.mjs)
  };
}

/** Who a reservation is for, from the request body; null if it doesn't hold up. */
export function cleanWho(body) {
  if (!body || typeof body !== 'object') return null;
  if (!ID.test(String(body.id)) || !ID.test(String(body.secret))) return null;
  return {
    id: String(body.id),
    secret: String(body.secret),
    name: clean(body.name, 20) || 'Player',
    colour: isColour(body.colour) ? body.colour : null,
    avatar: cleanAvatar(body.avatar),
  };
}

export function createRooms({ profiles, clock = () => performance.now() }) {
  /** @type {Map<string, Room>} */
  const rooms = new Map();
  /** session → { room, id, until } */
  const sessions = new Map();

  function newCode() {
    for (;;) {
      let code = '';
      for (let i = 0; i < 4; i++) code += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
      if (!rooms.has(code)) return code;
    }
  }

  /**
   * A seat: in a new room (code null) or the room with this code. Returns { status, body }: 200 with
   * { code, session }, or 404 no-room, 409 full, 403 taken (the id is someone else's) or kicked.
   */
  function reserve(code, who) {
    let room;
    if (code === null) {
      if (rooms.size >= MAX_ROOMS) return { status: 503, body: { code: 'busy' } };
      room = new Room(newCode());
      rooms.set(room.code, room);
    } else {
      room = rooms.get(String(code).toUpperCase());
      if (!room) return { status: 404, body: { code: 'no-room' } };
    }
    const why = room.seat(who);
    if (why) return { status: why === 'full' ? 409 : 403, body: { code: why } };
    const session = token();
    sessions.set(session, { room, id: who.id, until: Date.now() + SESSION_FOR });
    return { status: 200, body: { code: room.code, session } };
  }

  function peek(code) {
    const room = rooms.get(String(code).toUpperCase());
    return { exists: !!room, full: !!room && room.members.size >= MAX_MEMBERS };
  }

  /** A page opened the socket with its session. */
  function connect(ws, session) {
    const s = sessions.get(session);
    sessions.delete(session);
    if (!s || s.until < Date.now() || !s.room.members.has(s.id) || rooms.get(s.room.code) !== s.room) {
      ws.close(4401);
      return;
    }
    const conn = { ws, id: s.id, room: s.room, send: (type, payload) => ws.sendBinary(encode([type, payload])) };
    ws.on('message', (data, binary) => {
      if (!binary) return;
      let msg;
      try {
        msg = decode(data);
      } catch {
        return;
      }
      if (!Array.isArray(msg) || !int(msg[0])) return;
      try {
        conn.room?.handle(conn, msg[0], msg[1]);
      } catch (err) {
        console.error(err);
      }
    });
    ws.on('close', () => conn.room?.disconnect(conn));
    s.room.attach(conn);
  }

  class Room {
    constructor(code) {
      this.code = code;
      this.host = null;
      /** @type {Map<string, any>} id → member */
      this.members = new Map();
      this.kicked = new Set();
      this.settings = defaultSettings();
      this.phase = 'lobby'; // lobby | playing | results
      this.results = null;
      this.emptySince = Date.now();
      this.game = null; // the match being played (start())
    }

    // ---- who's in -------------------------------------------------------------------------

    /** A reservation: the member made or brought up to date. Returns why not, or null. */
    seat(who) {
      if (this.kicked.has(who.id)) return 'kicked';
      let m = this.members.get(who.id);
      if (m && m.secret !== who.secret) return 'taken';
      if (!m) {
        if (this.members.size >= MAX_MEMBERS) return 'full';
        const taken = new Set([...this.members.values()].map((x) => x.colour));
        m = {
          id: who.id, secret: who.secret, name: who.name, avatar: who.avatar,
          colour: who.colour && !taken.has(who.colour) ? who.colour : freeColour(taken),
          team: this.smallestTeam(),
          conn: null,
          reserved: Date.now(),
        };
        this.members.set(m.id, m);
      } else {
        m.name = who.name;
        m.avatar = who.avatar;
        m.reserved = Date.now();
      }
      this.emptySince = 0;
      return null;
    }

    attach(conn) {
      const m = this.members.get(conn.id);
      if (m.conn && m.conn !== conn) {
        m.conn.room = null; // the same player in a newer tab: the old one goes quietly
        m.conn.ws.close(4000);
      }
      m.conn = conn;
      if (!this.host || !this.members.get(this.host)?.conn) this.host = m.id;
      conn.send(DOWN.INIT, this.init(m));
      this.broadcast(DOWN.UPDATE, { view: this.view() }, conn);
    }

    disconnect(conn) {
      const m = this.members.get(conn.id);
      if (!m || m.conn !== conn) return;
      m.conn = null;
      if (this.playing(m.id)) this.letGo(m.id);
      else this.members.delete(m.id);
      this.afterLeave();
    }

    leave(conn) {
      const m = this.members.get(conn.id);
      conn.room = null;
      conn.ws.close(1000);
      if (!m || m.conn !== conn) return;
      m.conn = null;
      if (this.playing(m.id)) this.letGo(m.id);
      else this.members.delete(m.id);
      this.afterLeave();
    }

    afterLeave() {
      const connected = [...this.members.values()].filter((m) => m.conn);
      if (!connected.length) {
        this.emptySince = Date.now();
        this.halt();
        this.phase = 'lobby';
        this.game = null;
        return;
      }
      if (!this.members.get(this.host)?.conn) this.host = connected[0].id;
      this.broadcast(DOWN.UPDATE, { view: this.view() });
    }

    kick(conn, id) {
      if (conn.id !== this.host || id === conn.id) return;
      const m = this.members.get(id);
      if (!m) return;
      this.kicked.add(id);
      const g = this.game;
      if (g?.tl) {
        const p = g.order.indexOf(id);
        if (p >= 0 && !g.announced.has(p) && g.tl.round.playerAlive(p)) {
          // out at the server's next frame, on every page too
          const k = g.tl.k;
          g.tl.kill(k, p);
          g.deaths.push([k, p]);
          g.announced.add(p);
          this.broadcast(DOWN.UPDATE, { deaths: [[k, p]] });
        }
      }
      if (!this.playing(id)) this.members.delete(id);
      const was = m.conn;
      m.conn = null;
      if (was) {
        was.room = null;
        was.send(DOWN.KICKED, {});
        was.ws.close(4403);
      }
      this.afterLeave();
    }

    smallestTeam() {
      const counts = Array.from({ length: this.settings?.teams ?? 2 }, () => 0);
      for (const m of this.members.values()) if (m.team < counts.length) counts[m.team]++;
      return counts.indexOf(Math.min(...counts));
    }

    /** In the match being played (they stay in its standings even when gone). */
    playing(id) {
      return !!this.game?.order.includes(id);
    }

    me(conn, msg) {
      const m = this.members.get(conn.id);
      if (!m || !msg || typeof msg !== 'object') return;
      if (msg.name !== undefined) m.name = clean(msg.name, 20) || m.name;
      if (msg.avatar !== undefined) m.avatar = cleanAvatar(msg.avatar);
      if (msg.colour !== undefined && isColour(msg.colour)) {
        const taken = [...this.members.values()].some((x) => x !== m && x.colour === msg.colour);
        if (!taken) m.colour = msg.colour;
      }
      if (msg.team !== undefined && this.phase !== 'playing') {
        const team = Number(msg.team);
        if (int(team) && team >= 0 && team < this.settings.teams) m.team = team;
      }
      this.broadcast(DOWN.UPDATE, { view: this.view() });
    }

    view() {
      return {
        code: this.code,
        host: this.host,
        phase: this.phase,
        settings: this.settings,
        members: [...this.members.values()].map((m) => ({
          id: m.id, name: m.name, colour: m.colour, avatar: m.avatar, team: m.team,
          connected: !!m.conn, playing: this.playing(m.id),
        })),
        results: this.results,
      };
    }

    /** Everything a page needs on joining: the room, and the round so far to simulate up to now. */
    init(m) {
      const g = this.game;
      return {
        you: m.id,
        now: clock(),
        view: this.view(),
        profiles: profiles.list(),
        match: g ? { points: g.match.points, teamWins: g.match.teamWins } : null,
        round: g?.tl ? { start: g.tl.round.start, at: g.at, actions: g.log, deaths: g.deaths, nums: g.nums } : null,
        countdown: g?.countdown ?? null,
      };
    }

    broadcast(type, payload, except = null) {
      const bytes = encode([type, payload]);
      for (const m of this.members.values()) if (m.conn && m.conn !== except) m.conn.ws.sendBinary(bytes);
    }

    // ---- messages -------------------------------------------------------------------------

    handle(conn, type, payload) {
      switch (type) {
        case UP.PING:
          if (Array.isArray(payload) && typeof payload[0] === 'number') conn.send(DOWN.PONG, [payload[0], clock()]);
          return;
        case UP.ACTION:
          return this.action(conn, payload);
        case UP.ME:
          return this.me(conn, payload);
        case UP.SETTINGS:
          return this.settingsFrom(conn, payload);
        case UP.START:
          return this.start(conn);
        case UP.STOP:
          return this.stop(conn);
        case UP.LEAVE:
          return this.leave(conn);
        case UP.KICK:
          return this.kick(conn, String(payload?.id ?? ''));
        case UP.SAVE_PROFILE: {
          if (this.host !== conn.id) return;
          const saved = profiles.save(payload);
          if (!saved) return conn.send(DOWN.ERROR, { code: 'bad-profile' });
          return this.broadcast(DOWN.UPDATE, { profiles: profiles.list() });
        }
      }
    }

    /** The host's settings. A new feel, mode or arena reaches a running game at its next round. */
    settingsFrom(conn, patch) {
      if (conn.id !== this.host || !patch || typeof patch !== 'object') return;
      const s = this.settings;
      if (patch.type === 'ffa' || patch.type === 'teams') s.type = patch.type;
      if (int(patch.teams) && patch.teams >= 2 && patch.teams <= 4) {
        s.teams = patch.teams;
        for (const m of this.members.values()) if (m.team >= s.teams) m.team = this.smallestTeam();
      }
      if (typeof patch.mode === 'string' && MODES[patch.mode]) {
        const changed = s.mode !== patch.mode;
        s.mode = patch.mode;
        if (changed && patch.feel === undefined) s.feel = { ...BUILT_IN[MODES[patch.mode].feel] };
        if (changed && patch.powerups === undefined) s.powerups = [...MODES[patch.mode].powerups];
      }
      if (Number.isFinite(patch.target)) s.target = Math.max(0, Math.min(500, Math.round(patch.target)));
      if (Number.isFinite(patch.teamTarget)) s.teamTarget = Math.max(1, Math.min(50, Math.round(patch.teamTarget)));
      if (Array.isArray(patch.powerups)) s.powerups = patch.powerups.filter((k) => POWERUPS[k]);
      if (Number.isFinite(patch.rate)) s.rate = Math.max(0.1, Math.min(5, patch.rate));
      if (patch.feel && typeof patch.feel === 'object') s.feel = cleanFeel(patch.feel, s.feel);
      if (patch.arena && typeof patch.arena === 'object') s.arena = cleanArena(patch.arena, s.arena);
      if (typeof patch.profile === 'string') {
        const p = profiles.get(patch.profile);
        if (p) s.feel = { ...p };
      }
      this.game?.match.retune({ feel: s.feel, mode: this.modeData(), arena: s.arena });
      this.broadcast(DOWN.UPDATE, { view: this.view() });
    }

    modeData() {
      const s = this.settings;
      const mode = MODES[s.mode] ?? MODES.basic;
      if (s.mode !== 'custom') return { rate: mode.rate, powerups: mode.powerups };
      return { rate: s.rate, powerups: s.powerups.filter((k) => POWERUP_KINDS.includes(k)) };
    }

    // ---- the game -------------------------------------------------------------------------

    start(conn) {
      if (conn.id !== this.host || this.phase === 'playing') return;
      const players = [...this.members.values()].filter((m) => m.conn).slice(0, MAX_PLAYERS);
      if (!players.length) return;
      const match = new Match({
        players: players.map((m) => ({ id: m.id, name: m.name, colour: m.colour, team: m.team })),
        rules: { type: this.settings.type, target: this.settings.target, teamTarget: this.settings.teamTarget },
        feel: this.settings.feel,
        mode: this.modeData(),
        arena: this.settings.arena,
        seed: (Math.random() * 2 ** 32) >>> 0,
      });
      this.game = {
        match,
        order: players.map((m) => m.id), // a player's number in the actions
        tl: null,
        at: 0, // server time of frame 0
        log: [], // the round's actions, as relayed
        deaths: [], // [frame, player]: the server's word on who's out when
        announced: new Set(),
        nums: [], // each player's last action number
        stamps: [], // each player's last action's [frame, sub]
        countdown: null,
        timer: null,
      };
      this.phase = 'playing';
      this.results = null;
      for (const [id, m] of this.members) if (!m.conn) this.members.delete(id);
      this.broadcast(DOWN.UPDATE, { view: this.view() });
      this.countdown();
    }

    stop(conn) {
      if (conn.id !== this.host || this.phase === 'lobby') return;
      const counting = !!this.game?.countdown;
      this.halt();
      this.game = null;
      this.phase = 'lobby';
      this.results = null;
      for (const [id, m] of this.members) if (!m.conn) this.members.delete(id);
      if (counting) this.broadcast(DOWN.COUNTDOWN_STOP, {});
      this.broadcast(DOWN.UPDATE, { view: this.view() });
    }

    halt() {
      if (!this.game) return;
      clearTimeout(this.game.timer);
      this.game.timer = null;
    }

    /** The next round, a moment from now. */
    countdown() {
      const g = this.game;
      const at = clock() + NET.between;
      g.countdown = { no: g.match.roundNo + 1, at };
      g.tl = null;
      this.broadcast(DOWN.COUNTDOWN_START, g.countdown);
      clearTimeout(g.timer);
      g.timer = setTimeout(() => this.beginRound(), NET.between);
    }

    beginRound() {
      const g = this.game;
      if (!g) return;
      const start = g.match.nextRound();
      g.countdown = null;
      g.tl = new Timeline(start, { rewind: 1 });
      g.at = clock() + NET.lead;
      g.log = [];
      g.deaths = [];
      g.announced = new Set();
      g.nums = g.order.map(() => 0);
      g.stamps = g.order.map(() => [-1, 0]);
      this.broadcast(DOWN.ROUND_START, { start, at: g.at });
      this.schedule();
    }

    frameMs() {
      return this.game.tl.round.frameMs;
    }

    /** The frame the shared clock is in now. */
    clockFrame() {
      return Math.floor((clock() - this.game.at) / this.frameMs());
    }

    schedule() {
      const g = this.game;
      clearTimeout(g.timer);
      const next = g.at + NET.authority + (g.tl.k + 1) * this.frameMs();
      g.timer = setTimeout(() => this.run(), Math.max(0, next - clock()));
    }

    /** Simulates up to the clock, NET.authority behind it; announces who's out; ends the round. */
    run() {
      const g = this.game;
      if (!g?.tl) return;
      const target = Math.floor((clock() - g.at - NET.authority) / this.frameMs());
      if (target > g.tl.k) g.tl.advanceTo(target);
      const round = g.tl.round;
      const out = [];
      for (const e of g.tl.takeEvents()) {
        if (e.e !== 'die' || g.announced.has(e.p) || round.playerAlive(e.p)) continue;
        g.announced.add(e.p);
        g.deaths.push([e.k, e.p]);
        out.push([e.k, e.p]);
      }
      if (out.length) this.broadcast(DOWN.UPDATE, { deaths: out });
      if (round.phase === 'done') return this.endRound();
      this.schedule();
    }

    endRound() {
      const g = this.game;
      g.match.applyRound(g.tl.round.result());
      this.broadcast(DOWN.UPDATE, { points: g.match.points, teamWins: g.match.teamWins });
      if (g.match.over) return this.finish();
      this.countdown();
    }

    finish() {
      const match = this.game.match;
      this.halt();
      this.phase = 'results';
      this.results = {
        type: match.rules.type,
        winner: match.winner,
        standings: match.standings().map((s) => ({ ...s, avatar: this.members.get(s.id)?.avatar ?? null })),
        teamWins: match.teamWins,
        rounds: match.roundNo,
        target: match.rules.target,
      };
      this.game = null;
      this.broadcast(DOWN.UPDATE, { view: this.view() });
    }

    /** A steering action: taken and relayed to the others, or rejected. */
    action(conn, payload) {
      const g = this.game;
      if (!g || !Array.isArray(payload)) return;
      const a = toAction(payload);
      const p = g.order.indexOf(conn.id);
      if (p < 0 || a.player !== p || !int(a.num) || a.num <= (g.nums[p] ?? 0)) return;
      const reject = () => {
        if (g.nums[p] !== undefined) g.nums[p] = a.num;
        conn.send(DOWN.ACTION_REJECT, [a.round, p, a.num]);
      };
      if (!g.tl || a.round !== g.match.roundNo || g.tl.round.phase === 'done') return reject();
      if (!int(a.frame) || !int(a.sub) || a.sub < 0 || a.sub >= SUBS) return reject();
      if (![-1, 0, 1].includes(a.dir) || ![-1, 0, 1, undefined, null].includes(a.press)) return reject();
      const [lf, ls] = g.stamps[p];
      const late = a.frame < g.tl.k;
      const early = a.frame > this.clockFrame() + NET.ahead;
      const backwards = a.frame < lf || (a.frame === lf && a.sub < ls);
      if (late || early || backwards) return reject();
      g.nums[p] = a.num;
      g.stamps[p] = [a.frame, a.sub];
      const action = { ...a, press: a.press || 0 };
      g.tl.add(action);
      const wire = fromAction(action);
      g.log.push(wire);
      this.broadcast(DOWN.ACTION_ADD, wire, conn);
    }

    /** A player gone mid-round: their curve goes straight from the server's next frame. */
    letGo(id) {
      const g = this.game;
      if (!g?.tl) return;
      const p = g.order.indexOf(id);
      if (p < 0 || g.tl.lastDir(p) === 0) return;
      const [lf, ls] = g.stamps[p];
      const frame = Math.max(g.tl.k, lf);
      const action = { round: g.match.roundNo, frame, player: p, num: (g.nums[p] ?? 0) + 1, sub: frame === lf ? ls : 0, dir: 0, press: 0 };
      g.nums[p] = action.num;
      g.stamps[p] = [frame, action.sub];
      g.tl.add(action);
      const wire = fromAction(action);
      g.log.push(wire);
      this.broadcast(DOWN.ACTION_ADD, wire);
    }
  }

  return {
    reserve,
    peek,
    connect,
    /** Every few seconds: lapsed reservations, members who never came, rooms left empty. */
    sweep() {
      const now = Date.now();
      for (const [key, s] of sessions) if (s.until < now) sessions.delete(key);
      for (const [code, room] of rooms) {
        for (const [id, m] of room.members) {
          if (!m.conn && !room.playing(id) && now - m.reserved > SESSION_FOR) room.members.delete(id);
        }
        if (!room.members.size && !room.emptySince) room.emptySince = now;
        if (room.emptySince && now - room.emptySince > EMPTY_FOR) {
          room.halt();
          rooms.delete(code);
        }
      }
    },
    close() {
      for (const room of rooms.values()) room.halt();
    },
    get size() {
      return rooms.size;
    },
  };
}
