// The page's line to a room, in the two steps the server wants (server/app.mjs): an HTTP seat
// reservation, then the room's WebSocket with the session it gave. Binary [type, payload] messages
// (shared/wire.mjs). The clock is measured right away and every NET.ping after (src/lib/clock.ts).
// After a drop it reserves again and reconnects, pausing a little longer each time; a room that's
// gone, a kick or a newer tab ends that.

import { encode, decode } from '../../shared/wire.mjs';
import { UP, DOWN, NET } from '../../shared/protocol.mjs';
import * as clock from './clock';

export type Who = { id: string; secret: string; name: string; colour: string; avatar: number[] };
export type LineState = 'online' | 'connecting' | 'reconnecting';

/** A refusal from the server: no-room, full, taken, kicked, busy, or offline (no answer). */
export class NetError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

const handlers = new Map<number, Set<(payload: any) => void>>();
const stateListeners = new Set<(s: LineState) => void>();
const endListeners = new Set<(code: string) => void>();
let ws: WebSocket | null = null;
let room: { code: string; who: () => Who } | null = null;
let retry = 0;
let pingTimer = 0;
let retryTimer = 0;

export function on(type: number, fn: (payload: any) => void) {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type)!.add(fn);
  return () => handlers.get(type)?.delete(fn);
}

export function onState(fn: (s: LineState) => void) {
  stateListeners.add(fn);
  return () => stateListeners.delete(fn);
}

/** The line ended for good: the room is gone, you were kicked, or the room was opened in a newer tab. */
export function onEnd(fn: (code: string) => void) {
  endListeners.add(fn);
  return () => endListeners.delete(fn);
}

const setState = (s: LineState) => stateListeners.forEach((fn) => fn(s));

export function send(type: number, payload: unknown = {}) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(encode([type, payload]));
}

export const isOpen = () => ws?.readyState === WebSocket.OPEN;

async function api(path: string, init?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new NetError('timeout');
    throw new NetError('offline');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new NetError(body.code ?? 'other');
  return body;
}

/** A seat in a room (code) or in a new one (null). */
export function reserve(code: string | null, who: Who, signal?: AbortSignal): Promise<{ code: string; session: string }> {
  return api(code ? `/api/rooms/${code}/seats` : '/api/rooms', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(who),
    signal,
  });
}

/** Is there a room with this code, and room in it? */
export function peek(code: string, signal?: AbortSignal): Promise<{ exists: boolean; full: boolean }> {
  return api(`/api/rooms/${code}`, { signal });
}

function ping() {
  send(UP.PING, [performance.now()]);
}

/** Opens the room's socket with a reservation's session. `who` is asked again for each reconnect. */
export function connect(code: string, session: string, who: () => Who) {
  room = { code, who };
  clearTimeout(retryTimer);
  open(session);
}

function open(session: string) {
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?session=${encodeURIComponent(session)}`;
  const socket = new WebSocket(url);
  socket.binaryType = 'arraybuffer';
  ws = socket;
  setState(retry ? 'reconnecting' : 'connecting');
  socket.addEventListener('open', () => {
    retry = 0;
    setState('online');
    clearInterval(pingTimer);
    // a few quick readings for the clock, then one every NET.ping
    ping();
    for (const ms of [120, 260, 420]) setTimeout(ping, ms);
    pingTimer = window.setInterval(ping, NET.ping);
  });
  socket.addEventListener('message', (ev) => {
    let msg: any;
    try {
      msg = decode(new Uint8Array(ev.data as ArrayBuffer));
    } catch {
      return;
    }
    if (!Array.isArray(msg)) return;
    const [type, payload] = msg;
    if (type === DOWN.PONG) return clock.sample(payload[0], payload[1]);
    for (const fn of handlers.get(type) ?? []) fn(payload);
  });
  socket.addEventListener('close', (ev) => {
    clearInterval(pingTimer);
    if (ws !== socket) return;
    ws = null;
    if (!room) return;
    // kicked, or the same player in a newer tab: this page's line ends here
    if (ev.code === 4403 || ev.code === 4000) return end(ev.code === 4403 ? 'kicked' : 'elsewhere');
    setState('reconnecting');
    retry = Math.min(retry + 1, 6);
    retryTimer = window.setTimeout(again, 300 * 2 ** (retry - 1));
  });
}

async function again() {
  if (!room) return;
  try {
    const seat = await reserve(room.code, room.who());
    if (room) open(seat.session);
  } catch (e) {
    const code = (e as NetError).code;
    if (code === 'no-room' || code === 'kicked' || code === 'taken') return end(code);
    retry = Math.min(retry + 1, 6);
    retryTimer = window.setTimeout(again, 300 * 2 ** (retry - 1));
  }
}

function end(code: string) {
  room = null;
  clearTimeout(retryTimer);
  for (const fn of endListeners) fn(code);
}

/** Leaves the room's line (the page says LEAVE first). */
export function disconnect() {
  room = null;
  clearTimeout(retryTimer);
  clearInterval(pingTimer);
  const socket = ws;
  ws = null;
  socket?.close();
}
