// The server's clock, as seen from this page: the difference between the two, measured with pings.
// A ping carries the page's time; the pong adds the server's; the round trip says how far off the
// reading can be, so the reading with the shortest round trip among the last ones wins. A round's
// frame 0 is at a server time, so a page knows which frame it is in from the clock alone.

const KEEP = 12;
let samples: { rtt: number; diff: number }[] = [];
let diff: number | null = null;
let rttMs = 80;

/** server time − page time, in ms (null until the first reading). */
export const serverDiff = () => diff;

/** The round trip of the best recent reading, smoothed. */
export const rtt = () => rttMs;

/** A first, rough reading (the server's time in its first message, without the trip's length). */
export function roughly(serverNow: number, pageNow = performance.now()) {
  if (diff === null) diff = serverNow - pageNow;
}

/** A pong: [the page's time when it pinged, the server's time when it answered]. */
export function sample(pinged: number, serverNow: number, pageNow = performance.now()) {
  const trip = pageNow - pinged;
  if (trip < 0 || trip > 10_000) return;
  samples.push({ rtt: trip, diff: serverNow - (pinged + pageNow) / 2 });
  if (samples.length > KEEP) samples.shift();
  const best = samples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
  diff = best.diff;
  rttMs = rttMs * 0.7 + trip * 0.3;
}

/** A new server (a reconnect after a deploy): start measuring again. */
export function reset() {
  samples = [];
  diff = null;
}

/** The page's clock time of a server time. */
export const toPage = (serverTime: number) => serverTime - (diff ?? 0);
