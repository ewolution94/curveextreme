# CurveExtreme

Our own curve game for the afternoon meeting: steer a line that never stops, slip through its gaps,
outlast everyone. A recreation of [CurveCrash](https://curvecrash.com/) (an Achtung, die Kurve!
successor), steering measured from its public replays, then extended. Rooms with a code (up to ten
players, each on their own device) or one shared keyboard (one to four players on one computer).

The plan, the decisions and the measurements: `development/plans/curveextreme.md`.

## How it works

- **One engine** (`shared/engine.mjs`): the whole game as a deterministic simulation in fixed
  frames, run by every page and by the server. The same round start and the same steering actions
  give the same state to the last bit in every JavaScript engine: the seed makes the randomness, and
  the maths is its own (`shared/dmath.mjs`: sine and cosine from +, −, ×, ÷ alone, since `Math.sin`
  may differ between Chrome and Safari in the last bit). A steering change applies at the moment
  within the frame it happened (the key's or finger's own event time), along exact arcs. A head
  collides with the lines as they're drawn: bands with square ends, every curve moved before any
  head is checked, so a gap is as wide as it looks and two heads meeting in one frame both crash.
- **Everything that makes the feel is data**, so a playtest changes the game without code:
  - `shared/feel.mjs`: the feel profile (speed, turn radius, line width, hit size, gaps, the phases
    before a round, tick rate, field size…). Classic is the reference as measured; GS++ its fast mode.
  - `shared/powerups.mjs`: the 25 powerups (durations, spawn weights, colour = who they hit, what they
    multiply or do). The actions' own numbers (split angle, safe zone, closing walls) are in `ACTIONS`.
  - `shared/modes.mjs`: the modes (which powerups, how often, which feel).
  - `shared/arenas.mjs`: the arenas: the floor's shape (Square as measured, Circle, Hexagon, Ring with
    its island, Cross), its size, and Pillars and patches of Ice and Mud placed from the round's seed;
    every other shape gets a field whose floor has the measured square's room.
- **The Tune panel** (lobby → Feel, or Tune in a game; the host, on a device with the admin code):
  every feel number on Folio's slider, the measured value marked; changes apply from the next round.
  *Save as* keeps a profile on the server (`$DATA_DIR/profiles.json`) for the next room and the
  shared keyboard. The admin code goes in Settings → Admin (`src/lib/admin.svelte.ts`, kept as a hash;
  a door, not a lock: nothing on the server checks it).
- **Netcode: inputs, not positions** (`shared/protocol.mjs`). Getting into a room is an HTTP seat
  reservation (`POST /api/rooms`, `POST /api/rooms/CODE/seats`), then the room's WebSocket with the
  session it gave (`/ws?session=…`, a dependency-free server in `server/ws.mjs`), binary `[type,
  payload]` messages (`shared/wire.mjs`, a MessagePack subset). A round starts with its seed and the
  server time of frame 0; each page measures the server's clock with pings (`src/lib/clock.ts`) and
  simulates the round itself, the frame always coming from the clock. Only steering changes travel:
  `[round, frame, player, actionNum, sub, dir, press]`, one on a press, one on a release, about a
  dozen bytes. Your own goes into your round at once; another player's comes relayed, and if its
  frame is already past, the page rewinds to the snapshot before it and simulates forward again
  (`shared/timeline.mjs`), which ends exactly where it would have.
- **The server is the referee** (`server/rooms.mjs`): it runs the same round `NET.authority` ms behind
  the clock, takes an action whose frame it hasn't simulated yet and relays it, moves a later one to
  the earliest frame still open (the sender's page swaps its copy; the log says how late they came),
  and owns who's in, colours and teams,
  who's out (its word decides), the points and the rounds. Late joiners get the round's start and
  every action so far and simulate up to now. The host can take someone out of the room (kick).
  The timings (`NET`) are data like the feel.
- **The field's size** is a device setting (Settings): the reference's scale (window height ÷ 922 px
  per unit) or the whole screen.
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
| `CURVEEXTREME_CENSUS` | (off) | Census's ingest origin, e.g. `http://census:4901`: `/_e` and `/_e.js` are forwarded there |

## Layout

```
shared/     the engine, its maths and timeline, the protocol and wire format, the feel profiles,
            the powerups, the modes, the colours (server and page)
server/     server.mjs (static files, headers, /healthz), app.mjs, rooms.mjs, ws.mjs, profiles.mjs
src/lib/    net (reservation and socket), clock (the server's clock), runner (a round on the clock),
            render, icons, input, online (a room), local (the shared keyboard), progress (XP,
            stats), prefs, sound, i18n
src/components/  Home, Lobby, Play, Results, Local, Field, Scoreboard, Tuner, the sheets
tests/      *.test.mjs (unit, CI) and *.sim.mjs (simulations, local)
```

## Deploy (NAS)

A push to `release` is the deploy: `docker-publish.yml` runs CI (`ci.yml`: types, unit tests, the build,
a smoke test of the production server: a seat reserved, the binary socket), publishes
`ghcr.io/ewolution94/curveextreme:latest`, and the shared Watchtower recreates the container from
`deploy/portainer-stack.yml` (port 7000, the `/data` volume, Census over the `ewolution` network).
https://curveextreme.ewolution.cloud/ through the Cloudflare tunnel. A deploy ends running rooms.
