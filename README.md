# CurveExtreme

Our own curve game for the afternoon meeting: steer a line that never stops, slip through its gaps,
outlast everyone. A recreation of [CurveCrash](https://curvecrash.com/) (an Achtung, die Kurve!
successor), steering measured from its public replays, then extended. Rooms with a code (up to ten
players, each on their own device) or one shared keyboard (one to four players on one computer).

The plan, the decisions and the measurements: `development/plans/curveextreme.md`.

## How it works

- **One engine** (`shared/engine.mjs`): the whole game as a deterministic simulation in fixed ticks.
  The server runs it for rooms, the page runs it for the shared keyboard, and the page's prediction
  of your own curve uses the same `steer()`.
- **Everything that makes the feel is data**, so a playtest changes the game without code:
  - `shared/feel.mjs`: the feel profile (speed, turn radius, line width, hit size, gaps, the phases
    before a round, tick rate, field size…). Classic is the reference as measured; GS++ its fast mode.
  - `shared/powerups.mjs`: the 25 powerups (durations, spawn weights, colour = who they hit, what they
    multiply or do). The actions' own numbers (split angle, safe zone, closing walls) are in `ACTIONS`.
  - `shared/modes.mjs`: the modes (which powerups, how often, which feel).
- **The Tune panel** (lobby → Feel, or Tune in a game, host only): every feel number as a dial, the
  measured value as an orange notch; changes apply from the next round. *Save as* keeps a profile on
  the server (`$DATA_DIR/profiles.json`) for the next room and the shared keyboard.
- **How the page shows the game** is a device setting (Settings): the field at the reference's scale
  (window height ÷ 922 px per unit) or the whole screen; your curve drawn ahead with the keys you
  hold (instant) or a tick behind (from the server); others shown 0–3 ticks in the past.
- **Rooms** (`server/rooms.mjs`) over a dependency-free WebSocket server (`server/ws.mjs`) at `/ws`:
  every tick goes to every page as JSON (positions, events); your inputs are numbered and the server
  says which one it applied last, so the page can draw your curve ahead without waiting for it.
- **On the device only**: XP (your points plus 10 for a win), levels (they unlock colours), stats.

## Run it

```bash
npm install
npm run dev          # the page and the game server on http://localhost:6940
npm test             # unit tests (CI runs these)
npm run test:sim     # whole matches by random drivers, every powerup (local only)
npm run check        # types
npm run build && npm start   # the production server on :8080
```

| Variable | Default | |
|---|---|---|
| `PORT` | `8080` | the port (`--port` too) |
| `HOST` | `0.0.0.0` | |
| `DATA_DIR` | `./data` (`/data` in the image) | saved feel profiles |

## Layout

```
shared/     the engine, the feel profiles, the powerups, the modes, the colours (server and page)
server/     server.mjs (static files, headers, /healthz), app.mjs, rooms.mjs, ws.mjs, profiles.mjs
src/lib/    net (the socket), world (a round as the page knows it), predict, render, icons, input,
            online (a room), local (the shared keyboard), progress (XP, stats), prefs, sound, i18n
src/components/  Home, Lobby, Play, Results, Local, Field, Scoreboard, Tuner, the sheets
tests/      *.test.mjs (unit, CI) and *.sim.mjs (simulations, local)
```

## Deploy

Not live yet: the NAS port, the stack (`deploy/portainer-stack.yml`), the hostname and the family
(Census, Atrium, Aale Spiele, Pulse, the landing) come with `/new-app`. CI is ready: `ci.yml` checks
types, tests, builds and smoke-tests the production server; `docker-publish.yml` publishes
`ghcr.io/ewolution94/curveextreme` on a push to `release`.
