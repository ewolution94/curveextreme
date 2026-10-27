// The powerups as signs (the user's picks, 2026-10-27, plans/curveextreme/powerups.html): the shape
// says who a powerup hits as well as its colour (a green circle you, a red diamond your opponents, a
// blue hexagon everyone), each with a white border like a road sign, and inside it the picture in
// the Mono sketch: one even outline, round ends. The pictures keep what the reference's show (a
// bolt for speed, a turtle for slow), drawn our own way, in a unit box (-1…1). Each sign is drawn
// once per size and kept, so the field only copies it every frame.

import { POWERUPS } from '../../shared/powerups.mjs';

// Look A's disc tones (plans/curveextreme/looks.html).
export const DISC: Record<string, string> = { green: '#1fae4b', red: '#e5322d', blue: '#2a6ae8' };

type G = CanvasRenderingContext2D;
type Pt = [number, number];
const P = Math.PI;
const TAU = 2 * Math.PI;

// ---- the pictures ---------------------------------------------------------------------------

const LINE = 0.15; // every picture's outline, in units

function path(g: G, pts: Pt[], close = false) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  if (close) g.closePath();
}
const stroke = (g: G, pts: Pt[]) => (path(g, pts), g.stroke());
const outline = (g: G, pts: Pt[]) => (path(g, pts, true), g.stroke());
function ring(g: G, x: number, y: number, r: number, a0 = 0, a1 = TAU) {
  g.beginPath();
  g.arc(x, y, r, a0, a1);
  g.stroke();
}
function roundRect(g: G, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
/** An open arrowhead, its tip at (x, y), pointing at angle a, s long. */
function chevron(g: G, x: number, y: number, a: number, s: number) {
  const bx = x - Math.cos(a) * s, by = y - Math.sin(a) * s;
  const nx = -Math.sin(a) * s * 0.8, ny = Math.cos(a) * s * 0.8;
  stroke(g, [[bx + nx, by + ny], [x, y], [bx - nx, by - ny]]);
}
function arrow(g: G, x0: number, y0: number, x1: number, y1: number, s: number) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  stroke(g, [[x0, y0], [x1 - Math.cos(a) * 0.02, y1 - Math.sin(a) * 0.02]]);
  chevron(g, x1, y1, a, s);
}
/** An arrow along the circle (cx, cy, r) from angle a0 to a1, its tip at a1. */
function arcArrow(g: G, cx: number, cy: number, r: number, a0: number, a1: number, s: number) {
  const sg = a1 > a0 ? 1 : -1;
  g.beginPath();
  g.arc(cx, cy, r, a0, a1, sg < 0);
  g.stroke();
  const dir = a1 + (sg * P) / 2;
  chevron(g, cx + r * Math.cos(a1), cy + r * Math.sin(a1), dir - (sg * s) / (2 * r), s);
}
const hexagon = (x: number, y: number, r: number): Pt[] => Array.from({ length: 6 }, (_, i) => [x + r * Math.cos((i * P) / 3), y + r * Math.sin((i * P) / 3)]);
const CORNERS: Pt[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const BUBBLES: [number, number, number][] = [[-0.28, -0.22, 0.32], [0.36, -0.12, 0.24], [0.02, 0.42, 0.26]];
const ARMS = [-0.75 * P, -0.5 * P, -0.25 * P];

/** A wing (s: 1 right, −1 left): the leading edge out to the tip, feathers off the trailing edge. */
function wing(g: G, s: number) {
  g.beginPath();
  g.moveTo(0.1 * s, -0.06);
  g.bezierCurveTo(0.3 * s, -0.5, 0.68 * s, -0.56, 0.92 * s, -0.4);
  g.quadraticCurveTo(0.88 * s, -0.1, 0.68 * s, -0.14);
  g.quadraticCurveTo(0.64 * s, 0.08, 0.44 * s, 0.02);
  g.quadraticCurveTo(0.38 * s, 0.2, 0.1 * s, 0.14);
  g.closePath();
  g.stroke();
}

function bolt(g: G) {
  const pts: Pt[] = [[0.26, -0.8], [-0.46, 0.1], [-0.03, 0.1], [-0.24, 0.8], [0.5, -0.15], [0.07, -0.15]];
  outline(g, pts.map(([x, y]) => [x * 0.92, y * 0.92]));
}
function thin(g: G) {
  g.rotate(-P / 4);
  stroke(g, [[-0.74, 0], [0.74, 0]]);
  for (const s of [1, -1]) chevron(g, 0, 0.17 * s, s > 0 ? -P / 2 : P / 2, 0.2);
}
function fat(g: G) {
  g.rotate(-P / 4);
  roundRect(g, -0.62, -0.25, 1.24, 0.5, 0.25);
  g.stroke();
  for (const s of [1, -1]) chevron(g, 0, 0.7 * s, s > 0 ? P / 2 : -P / 2, 0.2);
}
function turtle(g: G) {
  g.beginPath();
  g.moveTo(-0.66, 0.14);
  g.bezierCurveTo(-0.62, -0.64, 0.5, -0.64, 0.54, 0.14);
  g.closePath();
  g.stroke();
  stroke(g, [[0.5, -0.06], [0.56, -0.06]]);
  ring(g, 0.72, -0.08, 0.15);
  stroke(g, [[-0.38, 0.14], [-0.42, 0.42]]);
  stroke(g, [[0.24, 0.14], [0.28, 0.42]]);
  stroke(g, [[-0.66, 0.06], [-0.84, 0.14]]);
  const h = hexagon(-0.06, -0.2, 0.16);
  outline(g, h);
  stroke(g, [h[0], [0.42, -0.2]]);
  stroke(g, [h[3], [-0.54, -0.2]]);
}
function eraser(g: G) {
  g.save();
  g.translate(0.06, -0.1);
  g.rotate(-P / 5);
  roundRect(g, -0.6, -0.27, 1.2, 0.54, 0.11);
  g.stroke();
  stroke(g, [[-0.16, -0.27], [-0.16, 0.27]]);
  g.restore();
  stroke(g, [[-0.8, 0.66], [-0.3, 0.66]]);
}
function bubbles(g: G) {
  for (const [x, y, r] of BUBBLES) {
    ring(g, x, y, r);
    ring(g, x, y, r * 0.55, P * 1.1, P * 1.45);
  }
}
function reverse(g: G) {
  arcArrow(g, 0, 0, 0.52, P * 1.1, P * 1.86, 0.22);
  arcArrow(g, 0, 0, 0.52, P * 0.1, P * 0.86, 0.22);
}
function fly(g: G) {
  wing(g, 1);
  wing(g, -1);
  g.beginPath();
  g.ellipse(0, 0.04, 0.07, 0.17, 0, 0, TAU);
  g.stroke();
}
function openWalls(g: G) {
  g.setLineDash([0.2, 0.15]);
  outline(g, [[-0.58, -0.58], [0.58, -0.58], [0.58, 0.58], [-0.58, 0.58]]);
  g.setLineDash([]);
  arrow(g, -0.86, 0, 0.84, 0, 0.22);
}
function switchPlaces(g: G) {
  for (const s of [1, -1]) {
    g.beginPath();
    g.moveTo(-0.74, -0.42 * s);
    g.bezierCurveTo(-0.04, -0.42 * s, -0.04, 0.42 * s, 0.72, 0.42 * s);
    g.stroke();
    chevron(g, 0.74, 0.42 * s, 0, 0.22);
  }
}
function split(g: G) {
  stroke(g, [[0, 0.76], [0, 0.1]]);
  for (const a of ARMS) arrow(g, 0, 0.1, Math.cos(a) * 0.74, 0.1 + Math.sin(a) * 0.74, 0.2);
}
function corner(g: G) {
  stroke(g, [[-0.44, 0.72], [-0.44, -0.3], [0.72, -0.3]]);
  chevron(g, 0.74, -0.3, 0, 0.24);
}
function smallTurn(g: G) {
  stroke(g, [[-0.32, 0.68], [-0.32, 0.12]]);
  arcArrow(g, 0, 0.12, 0.32, P, TAU, 0.22);
}
function bigTurn(g: G) {
  stroke(g, [[-0.62, 0.72], [-0.62, 0.32]]);
  arcArrow(g, 0, 0.32, 0.62, P, P * 1.88, 0.22);
}
function moving(g: G) {
  arcArrow(g, 0, 0, 0.58, P * 0.06, P * 0.82, 0.2);
  arcArrow(g, 0, 0, 0.58, P * 1.06, P * 1.82, 0.2);
  ring(g, 0, 0, 0.2);
}
function finger(g: G) {
  arrow(g, -0.5, 0, 0.76, 0, 0.26);
  stroke(g, [[-0.68, -0.42], [-0.68, 0.42]]);
}
function darkness(g: G) {
  // the moon's outline: its circle less the bite, then the bite's edge inside the circle
  ring(g, -0.08, 0.06, 0.6);
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.arc(0.24, -0.18, 0.5, 0, TAU);
  g.fill();
  g.restore();
  g.save();
  g.beginPath();
  g.arc(-0.08, 0.06, 0.6, 0, TAU);
  g.clip();
  ring(g, 0.24, -0.18, 0.5);
  g.restore();
  for (const [x, y, s] of [[0.36, -0.32, 0.13], [0.62, 0.1, 0.08]]) {
    stroke(g, [[x - s, y], [x + s, y]]);
    stroke(g, [[x, y - s], [x, y + s]]);
  }
}
function noDraw(g: G) {
  ring(g, 0, 0, 0.58);
  stroke(g, [[-0.41, 0.41], [0.41, -0.41]]);
}
function closing(g: G) {
  for (const [sx, sy] of CORNERS) {
    stroke(g, [[sx * 0.74, sy * 0.36], [sx * 0.74, sy * 0.74], [sx * 0.36, sy * 0.74]]);
    arrow(g, sx * 0.48, sy * 0.48, sx * 0.14, sy * 0.14, 0.16);
  }
}
function cheese(g: G) {
  outline(g, [[-0.72, 0.5], [0.72, 0.5], [0.72, -0.06]]);
  outline(g, [[-0.72, 0.5], [0.72, -0.06], [0.34, -0.6]]);
  for (const [x, y, r] of [[0.4, 0.3, 0.09], [0.12, 0.38, 0.05], [0.24, -0.16, 0.07]]) ring(g, x, y, r);
}

const GLYPHS: Record<string, (g: G) => void> = {
  greenSpeed: bolt, redSpeed: bolt,
  thin, fat,
  greenTurtle: turtle, redTurtle: turtle,
  eraser, greenEraser: eraser,
  bubbles, reverse, fly,
  openWalls, greenOpenWalls: openWalls,
  switch: switchPlaces, split,
  greenCorner: corner, redCorner: corner,
  smallTurn, bigTurn,
  movingPowerups: moving, finger, darkness, noDraw,
  closingWalls: closing, cheese,
};

// ---- the signs ------------------------------------------------------------------------------

/** Corners of the sign: 0 a circle (hits you), 4 a diamond (your opponents), 6 a hexagon (everyone). */
const SIDES: Record<string, number> = { green: 0, red: 4, blue: 6 };

function signPath(g: G, n: number, R: number) {
  g.beginPath();
  if (!n) {
    g.arc(0, 0, R, 0, TAU);
    return;
  }
  const a0 = n === 4 ? -P / 2 : 0; // the diamond points up, the hexagon left and right (flat on top)
  const pts: Pt[] = Array.from({ length: n }, (_, i) => [R * Math.cos(a0 + (i * TAU) / n), R * Math.sin(a0 + (i * TAU) / n)]);
  const cr = R * (n === 4 ? 0.2 : 0.16);
  g.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    g.arcTo(a[0], a[1], b[0], b[1], cr);
  }
  g.closePath();
}

const colourOf = (kind: string) => (POWERUPS as Record<string, { colour: string }>)[kind]?.colour ?? 'blue';
const canvasOf = (size: number) => {
  const c = document.createElement('canvas');
  c.width = c.height = Math.max(1, Math.ceil(size));
  return c;
};

const sprites = new Map<string, HTMLCanvasElement>();

/** A powerup's sign of radius r (canvas pixels), drawn once and kept. */
function sprite(kind: string, r: number) {
  const key = `${kind}|${Math.round(r * 4)}`;
  let c = sprites.get(key);
  if (c) return c;
  if (sprites.size > 300) sprites.clear(); // sizes from an earlier window size
  const colour = colourOf(kind), n = SIDES[colour] ?? 6, size = Math.ceil(2 * r + 4);
  c = canvasOf(size);
  const g = c.getContext('2d')!;
  g.translate(size / 2, size / 2);
  // the white border, then the face in the powerup's colour
  const R = r * (n ? 1 : 0.96), band = r * 0.11, inset = n ? band / Math.cos(P / n) : band;
  g.fillStyle = '#ffffff';
  signPath(g, n, R);
  g.fill();
  g.fillStyle = DISC[colour];
  signPath(g, n, R - inset);
  g.fill();
  // the picture on a layer of its own, so the moon's bite cuts only the picture
  const pic = canvasOf(size), p = pic.getContext('2d')!;
  const unit = r * (n === 4 ? 0.5 : n === 6 ? 0.56 : 0.58); // the diamond's face is the smallest
  p.translate(size / 2, size / 2);
  p.scale(unit, unit);
  p.strokeStyle = p.fillStyle = '#ffffff';
  p.lineWidth = LINE;
  p.lineCap = 'round';
  p.lineJoin = 'round';
  GLYPHS[kind]?.(p);
  g.drawImage(pic, -size / 2, -size / 2);
  sprites.set(key, c);
  return c;
}

function circle(g: G, x: number, y: number, r: number, colour: string, alpha: number, width: number) {
  if (alpha <= 0) return;
  g.globalAlpha = alpha;
  g.strokeStyle = colour;
  g.lineWidth = width;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.stroke();
  g.globalAlpha = 1;
}

/** The faint ring around the diamond and the hexagon: their sides sit inside the reach. */
function reach(g: G, kind: string, x: number, y: number, r: number, alpha: number) {
  const colour = colourOf(kind);
  if (SIDES[colour]) circle(g, x, y, r, DISC[colour], 0.5 * alpha, Math.max(1, r * 0.045));
}

/** A powerup's sign of radius r (canvas pixels) at x, y, at rest: the guide's and the room's lists. */
export function drawPowerup(g: G, kind: string, x: number, y: number, r: number) {
  reach(g, kind, x, y, r, 1);
  const c = sprite(kind, r);
  g.drawImage(c, x - c.width / 2, y - c.height / 2);
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
export const STAMP_MS = 200; // stamped down from larger
export const PING_MS = 2500; // a ring goes out from the reach this often
export const BURST_MS = 340; // picked up: shrinks inside a burst

/**
 * A powerup on the field (ms on the page's clock): stamped in from `born`, a ping every 2.5 s, and
 * from `gone` (picked up) shrinking inside a burst. False once the burst is over.
 */
export function drawPowerupLive(g: G, kind: string, x: number, y: number, r: number, born: number, gone: number | null, now: number) {
  const colour = DISC[colourOf(kind)];
  const t = clamp((now - born) / STAMP_MS);
  let s = 1 + 0.6 * (1 - easeOut(t)), a = t;
  if (gone !== null) {
    const u = clamp((now - gone) / BURST_MS);
    if (u >= 1) return false;
    circle(g, x, y, r * (1 + 1.3 * easeOut(u)), colour, 0.9 * (1 - u), Math.max(1, r * 0.14 * (1 - u)));
    s = (1 - u) ** 2;
    a = 1 - u;
  } else {
    if (t >= 1) {
      const ph = ((now - born - STAMP_MS) % PING_MS) / 900;
      if (ph < 1) circle(g, x, y, r * (1 + 0.6 * easeOut(ph)), colour, 0.65 * (1 - ph), Math.max(1, r * 0.07));
    }
    reach(g, kind, x, y, r, a);
  }
  if (a <= 0 || s <= 0) return true;
  const c = sprite(kind, r);
  g.globalAlpha = a;
  g.drawImage(c, x - (c.width / 2) * s, y - (c.height / 2) * s, c.width * s, c.height * s);
  g.globalAlpha = 1;
  return true;
}
