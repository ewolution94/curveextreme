// The page's connection to the game server: one WebSocket at /ws, opened again after a drop (with
// a growing pause), the hello and the room rejoined each time, and a ping every few seconds that
// keeps the round-trip time the prediction needs.

type Handler = (msg: any) => void;

const handlers = new Map<string, Set<Handler>>();
let ws: WebSocket | null = null;
let wanted = false;
let retry = 0;
let pingTimer = 0;
let hello: object | null = null;
let rejoin: string | null = null;
let rttMs = 60;
let openListeners = new Set<(open: boolean) => void>();

export function on(type: string, fn: Handler): () => void {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type)!.add(fn);
  return () => handlers.get(type)?.delete(fn);
}

export function onOpenChange(fn: (open: boolean) => void): () => void {
  openListeners.add(fn);
  return () => openListeners.delete(fn);
}

function emit(msg: any) {
  for (const fn of handlers.get(msg.t) ?? []) fn(msg);
  for (const fn of handlers.get('*') ?? []) fn(msg);
}

/** The round trip to the server, smoothed (ms). */
export const rtt = () => rttMs;

export function send(msg: object) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

export const isOpen = () => ws?.readyState === WebSocket.OPEN;

/** Who we are, sent first on every connection. */
export function setHello(h: object) {
  hello = h;
  send({ t: 'hello', ...h });
}

/** The room to go back into after a drop (null: none). */
export function setRejoin(code: string | null) {
  rejoin = code;
}

export function connect() {
  wanted = true;
  if (ws && ws.readyState <= WebSocket.OPEN) return;
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  const socket = new WebSocket(url);
  ws = socket;
  socket.addEventListener('open', () => {
    retry = 0;
    if (hello) socket.send(JSON.stringify({ t: 'hello', ...hello }));
    if (rejoin) socket.send(JSON.stringify({ t: 'join', code: rejoin }));
    for (const fn of openListeners) fn(true);
    clearInterval(pingTimer);
    const ping = () => socket.send(JSON.stringify({ t: 'ping', c: performance.now() }));
    ping();
    pingTimer = window.setInterval(ping, 3000);
  });
  socket.addEventListener('message', (ev) => {
    let msg: any;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (msg.t === 'pong' && typeof msg.c === 'number') {
      const sample = performance.now() - msg.c;
      rttMs = rttMs * 0.7 + sample * 0.3;
      return;
    }
    emit(msg);
  });
  socket.addEventListener('close', () => {
    clearInterval(pingTimer);
    if (ws === socket) ws = null;
    for (const fn of openListeners) fn(false);
    if (!wanted) return;
    retry = Math.min(retry + 1, 6);
    setTimeout(connect, 300 * 2 ** (retry - 1));
  });
}

export function disconnect() {
  wanted = false;
  ws?.close();
  ws = null;
}
