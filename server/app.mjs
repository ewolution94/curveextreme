// The game server's parts, shared by the production server (server.mjs) and the dev server
// (vite.config.ts). Getting into a room is two steps (server/rooms.mjs): an HTTP seat reservation,
// then the room's WebSocket with the session it gave.
//
//   GET  /api/rooms/CODE         is the room there, is it full
//   POST /api/rooms              a new room and a seat in it   → { code, session }
//   POST /api/rooms/CODE/seats   a seat in a room              → { code, session }
//   GET  /api/profiles           the feel profiles
//   GET  /ws?session=…           the room's socket (binary, shared/protocol.mjs)

import { acceptWebSocket } from './ws.mjs';
import { createRooms, cleanWho } from './rooms.mjs';
import { createProfiles } from './profiles.mjs';
import { createCensus } from './census.mjs';

const MAX_BODY = 4096;

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        resolve(null);
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}

export function createGameServer({ dataDir, censusTarget = '' }) {
  const census = createCensus({ target: censusTarget, site: 'curveextreme' });
  const profiles = createProfiles({ dir: dataDir });
  const rooms = createRooms({ profiles });
  const sweeper = setInterval(() => rooms.sweep(), 5000);
  sweeper.unref();

  return {
    /** Census's beacon and views, and the JSON API besides the socket; true if it answered. */
    async handle(req, res) {
      if (await census(req, res)) return true;
      const { pathname } = new URL(req.url, 'http://localhost');
      if (pathname === '/api/profiles' && req.method === 'GET') {
        json(res, 200, profiles.list());
        return true;
      }
      const room = pathname.match(/^\/api\/rooms(?:\/([A-Za-z]{4}))?(\/seats)?$/);
      if (!room) return false;
      const [, code, seats] = room;
      if (req.method === 'GET' && code && !seats) {
        json(res, 200, rooms.peek(code));
        return true;
      }
      if (req.method === 'POST' && (code ? seats : !seats)) {
        const who = cleanWho(await readJson(req));
        if (!who) {
          json(res, 400, { code: 'bad-request' });
          return true;
        }
        const out = rooms.reserve(code ?? null, who);
        json(res, out.status, out.body);
        return true;
      }
      json(res, 405, { code: 'method' });
      return true;
    },
    /** An HTTP upgrade: ours if it asks for /ws with a session. */
    upgrade(req, socket, head) {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname !== '/ws') return false;
      const session = url.searchParams.get('session') ?? '';
      acceptWebSocket(req, socket, head, (ws) => rooms.connect(ws, session));
      return true;
    },
    close() {
      clearInterval(sweeper);
      rooms.close();
    },
  };
}
