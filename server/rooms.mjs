// Rooms with a code: the lobby, the host's settings, and the game loop that runs a Match
// (shared/engine.mjs) in fixed ticks and sends every tick to every page over its WebSocket.
//
// Page → server:  hello, create, join, leave, me, settings, start, stop, in, ping, profiles,
//                 saveProfile
// Server → page:  hi, room, round, snap, s (a tick), over, pong, profiles, error

import { Match } from '../shared/engine.mjs';
import { BUILT_IN, cleanFeel } from '../shared/feel.mjs';
import { MODES } from '../shared/modes.mjs';
import { POWERUPS, POWERUP_KINDS } from '../shared/powerups.mjs';
import { isColour, freeColour } from '../shared/colours.mjs';

const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MAX_PLAYERS = 10;
const MAX_ROOMS = 200;
const EMPTY_FOR = 10 * 60 * 1000; // an empty room goes after ten minutes
const NEXT_ROUND = 400; // ms between a round's end and the next one's start
const ID = /^[a-z0-9-]{8,64}$/i;

const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);

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
  };
}

export function createRooms({ profiles }) {
  /** @type {Map<string, Room>} */
  const rooms = new Map();

  function newCode() {
    for (;;) {
      let code = '';
      for (let i = 0; i < 4; i++) code += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
      if (!rooms.has(code)) return code;
    }
  }

  /** A page connected: one per tab. */
  function connect(ws) {
    const conn = { ws, id: null, secret: null, name: 'Player', colour: null, room: null };
    ws.on('message', (text) => {
      let msg;
      try {
        msg = JSON.parse(text);
      } catch {
        return;
      }
      if (!msg || typeof msg.t !== 'string') return;
      try {
        handle(conn, msg);
      } catch (err) {
        console.error(err);
      }
    });
    ws.on('close', () => conn.room?.disconnect(conn));
  }

  function handle(conn, msg) {
    const send = (m) => conn.ws.send(JSON.stringify(m));
    switch (msg.t) {
      case 'hello':
        if (!ID.test(String(msg.id)) || !ID.test(String(msg.secret))) return send({ t: 'error', code: 'bad-id' });
        conn.id = String(msg.id);
        conn.secret = String(msg.secret);
        conn.name = clean(msg.name, 20) || 'Player';
        conn.colour = isColour(msg.colour) ? msg.colour : null;
        return send({ t: 'hi', protocol: 1 });
      case 'ping':
        return send({ t: 'pong', c: msg.c });
      case 'profiles':
        return send({ t: 'profiles', ...profiles.list() });
    }
    if (!conn.id) return send({ t: 'error', code: 'no-hello' });
    switch (msg.t) {
      case 'create': {
        if (rooms.size >= MAX_ROOMS) return send({ t: 'error', code: 'full' });
        conn.room?.leave(conn);
        const room = new Room(newCode());
        rooms.set(room.code, room);
        return room.join(conn);
      }
      case 'join': {
        const room = rooms.get(String(msg.code ?? '').toUpperCase());
        if (!room) return send({ t: 'error', code: 'no-room' });
        if (conn.room && conn.room !== room) conn.room.leave(conn);
        return room.join(conn);
      }
    }
    const room = conn.room;
    if (!room) return send({ t: 'error', code: 'no-room' });
    switch (msg.t) {
      case 'leave':
        return room.leave(conn);
      case 'me':
        return room.me(conn, msg);
      case 'settings':
        return room.settingsFrom(conn, msg.patch);
      case 'start':
        return room.start(conn);
      case 'stop':
        return room.stop(conn);
      case 'in':
        return room.input(conn, msg);
      case 'saveProfile': {
        if (room.host !== conn.id) return;
        const saved = profiles.save(msg.feel);
        if (!saved) return send({ t: 'error', code: 'bad-profile' });
        return room.broadcast({ t: 'profiles', ...profiles.list() });
      }
    }
  }

  class Room {
    constructor(code) {
      this.code = code;
      this.host = null;
      /** @type {Map<string, any>} id → member */
      this.members = new Map();
      this.settings = defaultSettings();
      this.phase = 'lobby'; // lobby | playing | results
      this.match = null;
      this.round = null; // the current round's start message
      this.results = null;
      this.running = false;
      this.timer = null;
      this.emptySince = 0;
    }

    view() {
      return {
        t: 'room',
        code: this.code,
        host: this.host,
        phase: this.phase,
        settings: this.settings,
        members: [...this.members.values()].map((m) => ({
          id: m.id, name: m.name, colour: m.colour, team: m.team,
          connected: !!m.conn, playing: !!this.match?.players.some((p) => p.id === m.id),
        })),
        results: this.results,
      };
    }

    broadcast(msg) {
      const text = typeof msg === 'string' ? msg : JSON.stringify(msg);
      for (const m of this.members.values()) m.conn?.ws.send(text);
    }

    join(conn) {
      let m = this.members.get(conn.id);
      if (m && m.secret !== conn.secret) return conn.ws.send(JSON.stringify({ t: 'error', code: 'taken' }));
      if (!m) {
        if (this.members.size >= MAX_PLAYERS * 2) return conn.ws.send(JSON.stringify({ t: 'error', code: 'full' }));
        const taken = new Set([...this.members.values()].map((x) => x.colour));
        m = {
          id: conn.id, secret: conn.secret, name: conn.name,
          colour: conn.colour && !taken.has(conn.colour) ? conn.colour : freeColour(taken),
          team: this.smallestTeam(),
          input: { dir: 0, presses: [], seq: 0 },
          conn: null,
        };
        this.members.set(m.id, m);
      }
      if (m.conn && m.conn !== conn) m.conn.ws.close(4000); // the same player in a newer tab
      m.conn = conn;
      m.name = conn.name;
      conn.room = this;
      this.emptySince = 0;
      if (!this.host || !this.members.get(this.host)?.conn) this.host = m.id;
      conn.ws.send(JSON.stringify({ t: 'profiles', ...profiles.list() }));
      this.broadcast(this.view());
      // in the middle of a game: the round so far
      if (this.phase === 'playing' && this.round && this.match?.r) {
        conn.ws.send(JSON.stringify(this.round));
        conn.ws.send(JSON.stringify(this.match.snapshot()));
      }
    }

    smallestTeam() {
      const counts = Array.from({ length: this.settings?.teams ?? 2 }, () => 0);
      for (const m of this.members.values()) if (m.team < counts.length) counts[m.team]++;
      return counts.indexOf(Math.min(...counts));
    }

    disconnect(conn) {
      const m = this.members.get(conn.id);
      if (!m || m.conn !== conn) return;
      m.conn = null;
      m.input = { dir: 0, presses: [], seq: m.input.seq };
      if (this.phase !== 'playing' && !this.match?.players.some((p) => p.id === m.id)) this.members.delete(m.id);
      this.afterLeave();
    }

    leave(conn) {
      const m = this.members.get(conn.id);
      conn.room = null;
      if (!m) return;
      m.conn = null;
      if (!this.match?.players.some((p) => p.id === m.id) || this.phase !== 'playing') this.members.delete(m.id);
      this.afterLeave();
    }

    afterLeave() {
      const connected = [...this.members.values()].filter((m) => m.conn);
      if (!connected.length) {
        this.emptySince = Date.now();
        this.halt();
        this.phase = 'lobby';
        this.match = null;
        this.round = null;
        return;
      }
      if (!this.members.get(this.host)?.conn) this.host = connected[0].id;
      this.broadcast(this.view());
    }

    me(conn, msg) {
      const m = this.members.get(conn.id);
      if (!m) return;
      if (msg.name !== undefined) m.name = clean(msg.name, 20) || m.name;
      if (msg.colour !== undefined && isColour(msg.colour)) {
        const taken = [...this.members.values()].some((x) => x !== m && x.colour === msg.colour);
        if (!taken) m.colour = msg.colour;
      }
      if (msg.team !== undefined && this.phase !== 'playing') {
        const team = Number(msg.team);
        if (Number.isInteger(team) && team >= 0 && team < this.settings.teams) m.team = team;
      }
      this.broadcast(this.view());
    }

    /** The host's settings. A new feel or mode reaches a running game at its next round. */
    settingsFrom(conn, patch) {
      if (conn.id !== this.host || !patch || typeof patch !== 'object') return;
      const s = this.settings;
      if (patch.type === 'ffa' || patch.type === 'teams') s.type = patch.type;
      if (Number.isInteger(patch.teams) && patch.teams >= 2 && patch.teams <= 4) {
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
      if (typeof patch.profile === 'string') {
        const p = profiles.get(patch.profile);
        if (p) s.feel = { ...p };
      }
      this.match?.retune({ feel: s.feel, mode: this.modeData() });
      this.broadcast(this.view());
    }

    modeData() {
      const s = this.settings;
      const mode = MODES[s.mode] ?? MODES.basic;
      if (s.mode !== 'custom') return { rate: mode.rate, powerups: mode.powerups };
      return { rate: s.rate, powerups: s.powerups.filter((k) => POWERUP_KINDS.includes(k)) };
    }

    start(conn) {
      if (conn.id !== this.host || this.phase === 'playing') return;
      const players = [...this.members.values()].filter((m) => m.conn).slice(0, MAX_PLAYERS);
      if (!players.length) return;
      this.match = new Match({
        players: players.map((m) => ({ id: m.id, name: m.name, colour: m.colour, team: m.team })),
        rules: { type: this.settings.type, target: this.settings.target, teamTarget: this.settings.teamTarget },
        feel: this.settings.feel,
        mode: this.modeData(),
        seed: (Math.random() * 2 ** 32) >>> 0,
      });
      // spectators who left before the game are gone; the rest watch
      this.phase = 'playing';
      this.results = null;
      this.broadcast(this.view());
      this.startRound();
    }

    stop(conn) {
      if (conn.id !== this.host) return;
      this.halt();
      this.phase = 'lobby';
      this.match = null;
      this.round = null;
      this.results = null;
      for (const [id, m] of this.members) if (!m.conn) this.members.delete(id);
      this.broadcast(this.view());
    }

    startRound() {
      if (!this.match) return;
      this.round = this.match.startRound();
      this.broadcast(this.round);
      this.running = true;
      this.dt = 1000 / this.match.r.rate;
      this.nextAt = performance.now() + this.dt;
      this.schedule();
    }

    schedule() {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.loop(), Math.max(0, this.nextAt - performance.now()));
    }

    loop() {
      if (!this.running || !this.match) return;
      // catch up after a slow tick, but never more than five at once
      for (let n = 0; n < 5 && this.running && performance.now() >= this.nextAt - 1; n++) {
        this.step();
        this.nextAt += this.dt;
      }
      if (performance.now() - this.nextAt > 250) this.nextAt = performance.now() + this.dt;
      if (this.running) this.schedule();
    }

    step() {
      const inputs = new Map();
      const acks = {};
      for (const m of this.members.values()) {
        inputs.set(m.id, { dir: m.input.dir, presses: m.input.presses });
        if (m.input.seq) acks[m.id] = m.input.seq;
      }
      const msg = this.match.tick(inputs);
      for (const m of this.members.values()) m.input.presses = [];
      msg.a = acks;
      this.broadcast(msg);
      if (msg.e?.some((e) => e.e === 'roundEnd')) {
        this.halt();
        if (this.match.over) this.finish();
        else this.timer = setTimeout(() => this.startRound(), NEXT_ROUND);
      }
    }

    halt() {
      this.running = false;
      clearTimeout(this.timer);
    }

    finish() {
      const match = this.match;
      this.phase = 'results';
      this.results = {
        type: match.rules.type,
        winner: match.winner,
        standings: match.standings(),
        teamWins: match.teamWins,
        rounds: match.roundNo,
        target: match.rules.target,
      };
      this.broadcast({ t: 'over', results: this.results });
      this.match = null;
      this.round = null;
      this.broadcast(this.view());
    }

    input(conn, msg) {
      const m = this.members.get(conn.id);
      if (!m) return;
      const seq = Number(msg.s);
      if (!Number.isInteger(seq) || seq <= m.input.seq) return;
      m.input.seq = seq;
      const dir = Number(msg.d);
      m.input.dir = dir === -1 || dir === 1 ? dir : 0;
      if (msg.p === -1 || msg.p === 1) m.input.presses.push(msg.p);
    }
  }

  return {
    connect,
    /** Every few seconds: forget rooms that stayed empty. */
    sweep() {
      const now = Date.now();
      for (const [code, room] of rooms) {
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
