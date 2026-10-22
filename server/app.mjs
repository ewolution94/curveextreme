// The game server's parts, shared by the production server (server.mjs) and the dev server
// (vite.config.ts): the rooms over WebSockets at /ws and the feel profiles at /api/profiles.

import { acceptWebSocket } from './ws.mjs';
import { createRooms } from './rooms.mjs';
import { createProfiles } from './profiles.mjs';

export function createGameServer({ dataDir }) {
  const profiles = createProfiles({ dir: dataDir });
  const rooms = createRooms({ profiles });
  const sweeper = setInterval(() => rooms.sweep(), 5000);
  sweeper.unref();

  return {
    /** The JSON API besides the socket; true if it answered. */
    handle(req, res) {
      const { pathname } = new URL(req.url, 'http://localhost');
      if (pathname === '/api/profiles' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache' }).end(JSON.stringify(profiles.list()));
        return true;
      }
      return false;
    },
    /** An HTTP upgrade: ours if it asks for /ws. */
    upgrade(req, socket, head) {
      if (new URL(req.url, 'http://localhost').pathname !== '/ws') return false;
      acceptWebSocket(req, socket, head, (ws) => rooms.connect(ws));
      return true;
    },
    close() {
      clearInterval(sweeper);
      rooms.close();
    },
  };
}
