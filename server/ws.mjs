// A small WebSocket server (RFC 6455), so the game server keeps the family's no-dependency rule:
// the upgrade handshake, masked frames from the page, text messages (fragmented ones too), ping
// and pong, close. Messages are JSON text; frames over 1 MB close the connection.

import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_MESSAGE = 1 << 20;
const MAX_BACKLOG = 4 << 20; // a page this far behind is dropped rather than buffered for ever

/** Answers an HTTP upgrade (http.Server's 'upgrade' event) and hands the socket to onOpen. */
export function acceptWebSocket(req, socket, head, onOpen) {
  const key = req.headers['sec-websocket-key'];
  if (String(req.headers.upgrade).toLowerCase() !== 'websocket' || !key) {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    return;
  }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
  socket.setNoDelay(true);
  const ws = new WebSocketConnection(socket);
  onOpen(ws, req);
  if (head?.length) ws.feed(head);
}

export class WebSocketConnection extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.fragments = null;
    this.open = true;
    socket.on('data', (chunk) => this.feed(chunk));
    socket.on('close', () => this.closed());
    socket.on('error', () => socket.destroy());
    socket.on('end', () => socket.end());
  }

  feed(chunk) {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
    while (this.open && this.buffer.length >= 2) {
      const b0 = this.buffer[0], b1 = this.buffer[1];
      const fin = (b0 & 0x80) !== 0;
      const op = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) {
        if (this.buffer.length < 4) return;
        len = this.buffer.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (this.buffer.length < 10) return;
        len = Number(this.buffer.readBigUInt64BE(2));
        off = 10;
      }
      if (len > MAX_MESSAGE) return this.close(1009);
      const maskAt = off;
      if (masked) off += 4;
      if (this.buffer.length < off + len) return;
      let payload = this.buffer.subarray(off, off + len);
      if (masked) {
        const mask = this.buffer.subarray(maskAt, maskAt + 4);
        const out = Buffer.allocUnsafe(len);
        for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i & 3];
        payload = out;
      }
      this.buffer = this.buffer.subarray(off + len);
      this.frame(fin, op, payload);
    }
  }

  frame(fin, op, payload) {
    if (op === 0x8) return this.close(1000);
    if (op === 0x9) return this.write(0xa, payload);
    if (op === 0xa) return;
    if (op === 0x1 || op === 0x2) this.fragments = [payload];
    else if (op === 0x0 && this.fragments) this.fragments.push(payload);
    else return;
    const size = this.fragments.reduce((s, b) => s + b.length, 0);
    if (size > MAX_MESSAGE) return this.close(1009);
    if (!fin) return;
    const message = Buffer.concat(this.fragments).toString('utf8');
    this.fragments = null;
    this.emit('message', message);
  }

  write(op, data) {
    if (!this.open || this.socket.destroyed) return;
    if (this.socket.writableLength > MAX_BACKLOG) {
      this.socket.destroy();
      return;
    }
    const len = data.length;
    let header;
    if (len < 126) {
      header = Buffer.from([0x80 | op, len]);
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | op;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | op;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    this.socket.write(Buffer.concat([header, data]));
  }

  /** Sends a text message (a string, usually JSON). */
  send(text) {
    this.write(0x1, Buffer.from(text, 'utf8'));
  }

  ping() {
    this.write(0x9, Buffer.alloc(0));
  }

  close(code = 1000) {
    if (!this.open) return;
    const body = Buffer.alloc(2);
    body.writeUInt16BE(code, 0);
    this.write(0x8, body);
    this.open = false;
    this.socket.end();
    this.closed();
  }

  closed() {
    if (this.done) return;
    this.done = true;
    this.open = false;
    this.emit('close');
  }
}
