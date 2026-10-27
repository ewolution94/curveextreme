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

// fdlibm's arctangent: four breakpoints, then an odd polynomial (within one unit in the last place).
const ATAN_HI = [4.63647609000806093515e-1, 7.85398163397448278999e-1, 9.82793723247329054082e-1, 1.570796326794896558e0];
const ATAN_LO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399538461676577e-17];
const AT = [
  3.33333333333329318027e-1, -1.99999999998764832476e-1, 1.42857142725034663711e-1, -1.1111110405462355788e-1,
  9.09088713343650656196e-2, -7.69187620504482999495e-2, 6.66107313738753120669e-2, -5.83357013379057348645e-2,
  4.97687799461593236017e-2, -3.6531572744216915527e-2, 1.62858201153657823623e-2,
];

export function atan(v) {
  if (v !== v) return v;
  const neg = v < 0;
  let x = neg ? -v : v;
  let id = -1;
  if (x >= 0.4375) {
    if (x < 0.6875) { id = 0; x = (2 * x - 1) / (2 + x); }
    else if (x < 1.1875) { id = 1; x = (x - 1) / (x + 1); }
    else if (x < 2.4375) { id = 2; x = (x - 1.5) / (1 + 1.5 * x); }
    else { id = 3; x = -1 / x; }
  }
  const z = x * x, w = z * z;
  const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
  const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
  const r = id < 0 ? x - x * (s1 + s2) : ATAN_HI[id] - (x * (s1 + s2) - ATAN_LO[id] - x);
  return neg ? -r : r;
}

/** The angle of (x, y), in (−π, π]: like Math.atan2, but the same bits everywhere. */
export function atan2(y, x) {
  if (x > 0) return atan(y / x);
  if (x < 0) return atan(y / x) + (y >= 0 ? PI : -PI);
  return y > 0 ? HALF_PI : y < 0 ? -HALF_PI : 0;
}
