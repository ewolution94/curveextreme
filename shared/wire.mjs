// The binary format on the socket: a small subset of MessagePack (msgpack.org), written here so the
// server keeps the family's no-dependency rule and the page needs no library. Every message is one
// encoded array [type, payload] (shared/protocol.mjs); the hot path, a steering action, is a
// positional array of small integers and comes to about a dozen bytes.
//
// Kinds: nil, false, true, integers (fixint, int/uint 8–32), float64, strings (UTF-8), arrays and
// maps with string keys. undefined is written as nil; anything else (functions, symbols) throws.

const te = new TextEncoder();
const td = new TextDecoder();

class Writer {
  constructor() {
    this.buf = new Uint8Array(256);
    this.view = new DataView(this.buf.buffer);
    this.n = 0;
  }
  room(k) {
    if (this.n + k <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.n + k) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.n));
    this.buf = next;
    this.view = new DataView(next.buffer);
  }
  u8(v) {
    this.room(1);
    this.buf[this.n++] = v;
  }
  u16(v) {
    this.room(2);
    this.view.setUint16(this.n, v);
    this.n += 2;
  }
  u32(v) {
    this.room(4);
    this.view.setUint32(this.n, v);
    this.n += 4;
  }
  bytes(b) {
    this.room(b.length);
    this.buf.set(b, this.n);
    this.n += b.length;
  }
  value(v) {
    if (v === null || v === undefined) return this.u8(0xc0);
    if (v === false) return this.u8(0xc2);
    if (v === true) return this.u8(0xc3);
    if (typeof v === 'number') return this.number(v);
    if (typeof v === 'string') return this.string(v);
    if (Array.isArray(v)) {
      const len = v.length;
      if (len < 16) this.u8(0x90 | len);
      else if (len < 0x10000) (this.u8(0xdc), this.u16(len));
      else (this.u8(0xdd), this.u32(len));
      for (const item of v) this.value(item);
      return;
    }
    if (typeof v === 'object') {
      const keys = Object.keys(v).filter((k) => v[k] !== undefined);
      const len = keys.length;
      if (len < 16) this.u8(0x80 | len);
      else if (len < 0x10000) (this.u8(0xde), this.u16(len));
      else (this.u8(0xdf), this.u32(len));
      for (const k of keys) {
        this.string(k);
        this.value(v[k]);
      }
      return;
    }
    throw new TypeError(`wire: can't write a ${typeof v}`);
  }
  number(v) {
    if (Number.isInteger(v) && v >= -0x80000000 && v <= 0xffffffff && !Object.is(v, -0)) {
      if (v >= 0) {
        if (v < 0x80) return this.u8(v);
        if (v < 0x100) return (this.u8(0xcc), this.u8(v));
        if (v < 0x10000) return (this.u8(0xcd), this.u16(v));
        return (this.u8(0xce), this.u32(v));
      }
      if (v >= -32) return this.u8(v & 0xff);
      this.room(5);
      if (v >= -0x80) {
        this.buf[this.n++] = 0xd0;
        this.view.setInt8(this.n, v);
        this.n += 1;
      } else if (v >= -0x8000) {
        this.buf[this.n++] = 0xd1;
        this.view.setInt16(this.n, v);
        this.n += 2;
      } else {
        this.buf[this.n++] = 0xd2;
        this.view.setInt32(this.n, v);
        this.n += 4;
      }
      return;
    }
    this.room(9);
    this.buf[this.n++] = 0xcb;
    this.view.setFloat64(this.n, v);
    this.n += 8;
  }
  string(s) {
    const b = te.encode(s);
    const len = b.length;
    if (len < 32) this.u8(0xa0 | len);
    else if (len < 0x100) (this.u8(0xd9), this.u8(len));
    else if (len < 0x10000) (this.u8(0xda), this.u16(len));
    else (this.u8(0xdb), this.u32(len));
    this.bytes(b);
  }
}

/** A value as bytes. */
export function encode(value) {
  const w = new Writer();
  w.value(value);
  return w.buf.slice(0, w.n);
}

/** Bytes (Uint8Array, ArrayBuffer or a Node Buffer) back to a value; throws on anything malformed. */
export function decode(input) {
  const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let i = 0;
  const need = (k) => {
    if (i + k > buf.length) throw new RangeError('wire: cut short');
  };
  const str = (len) => {
    need(len);
    const s = td.decode(buf.subarray(i, i + len));
    i += len;
    return s;
  };
  const arr = (len) => {
    if (len > buf.length - i) throw new RangeError('wire: cut short');
    const out = new Array(len);
    for (let k = 0; k < len; k++) out[k] = read();
    return out;
  };
  const map = (len) => {
    if (len > buf.length - i) throw new RangeError('wire: cut short');
    const out = {};
    for (let k = 0; k < len; k++) {
      const key = read();
      if (typeof key !== 'string' || key === '__proto__') throw new TypeError('wire: bad key');
      out[key] = read();
    }
    return out;
  };
  function read() {
    need(1);
    const b = buf[i++];
    if (b < 0x80) return b;
    if (b >= 0xe0) return b - 0x100;
    if ((b & 0xf0) === 0x90) return arr(b & 0x0f);
    if ((b & 0xf0) === 0x80) return map(b & 0x0f);
    if ((b & 0xe0) === 0xa0) return str(b & 0x1f);
    let v;
    switch (b) {
      case 0xc0: return null;
      case 0xc2: return false;
      case 0xc3: return true;
      case 0xcc: need(1); return buf[i++];
      case 0xcd: need(2); v = view.getUint16(i); i += 2; return v;
      case 0xce: need(4); v = view.getUint32(i); i += 4; return v;
      case 0xd0: need(1); v = view.getInt8(i); i += 1; return v;
      case 0xd1: need(2); v = view.getInt16(i); i += 2; return v;
      case 0xd2: need(4); v = view.getInt32(i); i += 4; return v;
      case 0xcb: need(8); v = view.getFloat64(i); i += 8; return v;
      case 0xd9: need(1); return str(buf[i++]);
      case 0xda: need(2); v = view.getUint16(i); i += 2; return str(v);
      case 0xdb: need(4); v = view.getUint32(i); i += 4; return str(v);
      case 0xdc: need(2); v = view.getUint16(i); i += 2; return arr(v);
      case 0xdd: need(4); v = view.getUint32(i); i += 4; return arr(v);
      case 0xde: need(2); v = view.getUint16(i); i += 2; return map(v);
      case 0xdf: need(4); v = view.getUint32(i); i += 4; return map(v);
    }
    throw new TypeError(`wire: unknown byte ${b.toString(16)}`);
  }
  const value = read();
  if (i !== buf.length) throw new RangeError('wire: bytes left over');
  return value;
}
