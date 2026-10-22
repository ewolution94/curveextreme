import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
// @ts-expect-error untyped server module
import { createGameServer } from './server/app.mjs';

// The real game server inside Vite's (dev and preview), so `npm run dev` is the whole game on one
// port: the rooms over WebSockets at /ws and the profiles at /api/profiles. Rooms live in this
// process: a restart of the dev server ends the local games.
function gameServer(): Plugin {
  const game = createGameServer({ dataDir: new URL('./data', import.meta.url).pathname });
  const attach = (s: any) => {
    s.middlewares.use((req: any, res: any, next: () => void) => (game.handle(req, res) ? undefined : next()));
    s.httpServer?.on('upgrade', (req: any, socket: any, head: any) => {
      // Vite's own socket (hot reload) asks for the 'vite-hmr' protocol; ours is /ws
      if (req.headers['sec-websocket-protocol']?.includes('vite-hmr')) return;
      game.upgrade(req, socket, head);
    });
  };
  return { name: 'curveextreme-server', configureServer: attach, configurePreviewServer: attach };
}

export default defineConfig({
  plugins: [svelte(), gameServer()],
  // Local previews only; the NAS port comes from development/.claude/skills/portainer/ports.json.
  server: { port: 6940, strictPort: true },
  preview: { port: 6941, strictPort: true },
  build: {
    target: 'es2022',
    // no data: URIs: the CSP's font-src and img-src are 'self'
    assetsInlineLimit: 0,
    cssTarget: ['chrome123', 'safari17.5', 'firefox120'],
  },
});
