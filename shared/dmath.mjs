// Maths that comes out the same to the last bit in every JavaScript engine, for the simulation every
// page runs (shared/engine.mjs). Math.sin, cos, hypot, log and pow may differ between Chrome's V8
// and Safari's JavaScriptCore in the last bit, and in a lockstep game a last bit decides a near-miss
// differently on two screens. +, −, ×, ÷, Math.round and Math.floor are exact IEEE-754 everywhere,
// so sine and cosine here are built from those alone: Cody-Waite range reduction and the classic
// fdlibm kernels (Sun Microsystems' freely distributable minimax coefficients, within one unit in
// the last place on [−π/4, π/4]). tests/dmath.test.mjs checks them against Math.sin and Math.cos.

export const PI = 3.141592653589793;
export const TAU = 6.283185307179586;
export const HALF_PI = 1.5707963267948966;

const INV_PIO2 = 0.6366197723675814;
const PIO2_1 = 1.5707963267341256; // the first 33 bits of π/2: n × PIO2_1 is exact
const PIO2_1T = 6.077100506506192e-11; // π/2 − PIO2_1

const S1 = -1.66666666666666324348e-1;
const S2 = 8.33333333332248946124e-3;
const S3 = -1.98412698298579493134e-4;
const S4 = 2.75573137070700676789e-6;
const S5 = -2.50507602534068634195e-8;
const S6 = 1.58969099521155010221e-10;

const C1 = 4.16666666666666019037e-2;
const C2 = -1.38888888888741095749e-3;
const C3 = 2.48015872894767294178e-5;
const C4 = -2.75573143513906633035e-7;
const C5 = 2.0875723212981748279e-9;
const C6 = -1.13596475577881948265e-11;

function kernelSin(x) {
  const z = x * x;
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  return x + z * x * (S1 + z * r);
}

function kernelCos(x) {
  const z = x * x;
  const r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  const hz = 0.5 * z;
  const w = 1 - hz;
  return w + (1 - w - hz + z * r);
}

/** The quadrant and the rest of x after taking out whole quarter turns (|x| up to about 1e6). */
function reduce(x) {
  const n = Math.round(x * INV_PIO2);
  return [n & 3, x - n * PIO2_1 - n * PIO2_1T];
}

export function sin(x) {
  const [q, r] = reduce(x);
  if (q === 0) return kernelSin(r);
  if (q === 1) return kernelCos(r);
  if (q === 2) return -kernelSin(r);
  return -kernelCos(r);
}

export function cos(x) {
  const [q, r] = reduce(x);
  if (q === 0) return kernelCos(r);
  if (q === 1) return -kernelSin(r);
  if (q === 2) return -kernelCos(r);
  return kernelSin(r);
}

/** An angle brought into [−π, π). */
export const norm = (a) => a - TAU * Math.floor((a + PI) / TAU);

/** The squared distance: compare it with a squared radius, no square root needed. */
export const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
