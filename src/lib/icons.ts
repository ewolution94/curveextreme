// The powerups' discs: green (you), red (your opponents), blue (everyone), each with our own white
// glyph, drawn in a unit box (-1…1) so one function serves the field and the menus.

import { POWERUPS } from '../../shared/powerups.mjs';

// Look A's disc tones (plans/curveextreme/looks.html).
export const DISC: Record<string, string> = { green: '#1fae4b', red: '#e5322d', blue: '#2a6ae8' };

type G = CanvasRenderingContext2D;
const P = Math.PI;

function bolt(g: G) {
  g.beginPath();
  g.moveTo(0.15, -0.75); g.lineTo(-0.35, 0.1); g.lineTo(0.02, 0.1); g.lineTo(-0.15, 0.75); g.lineTo(0.38, -0.12); g.lineTo(0.02, -0.12); g.closePath();
  g.fill();
}
function turtle(g: G) {
  g.beginPath(); g.ellipse(0, 0.08, 0.55, 0.42, 0, P, 0); g.closePath(); g.fill();
  g.beginPath(); g.arc(0.62, -0.02, 0.17, 0, 2 * P); g.fill();
  g.fillRect(-0.45, 0.08, 0.2, 0.28); g.fillRect(0.2, 0.08, 0.2, 0.28);
}
function line(g: G, w: number) {
  g.lineWidth = w; g.beginPath(); g.moveTo(-0.55, 0.55); g.lineTo(0.55, -0.55); g.stroke();
}
function eraser(g: G) {
  g.save(); g.rotate(-P / 4); g.fillRect(-0.62, -0.28, 1.24, 0.56); g.restore();
  g.save(); g.globalCompositeOperation = 'destination-out'; g.rotate(-P / 4); g.fillRect(-0.62, -0.28, 0.42, 0.56); g.restore();
  g.save(); g.rotate(-P / 4); g.lineWidth = 0.1; g.strokeRect(-0.62, -0.28, 1.24, 0.56); g.restore();
}
function bubbles(g: G) {
  for (const [x, y, r] of [[-0.3, -0.25, 0.3], [0.32, -0.15, 0.24], [0, 0.38, 0.26]]) { g.beginPath(); g.arc(x, y, r, 0, 2 * P); g.stroke(); }
}
function reverse(g: G) {
  g.beginPath(); g.arc(0, 0, 0.55, P * 1.15, P * 1.95); g.stroke();
  g.beginPath(); g.arc(0, 0, 0.55, P * 0.15, P * 0.95); g.stroke();
  for (const a of [P * 1.95, P * 0.95]) {
    const x = Math.cos(a) * 0.55, y = Math.sin(a) * 0.55;
    g.beginPath(); g.moveTo(x + Math.cos(a - 0.9) * 0.28, y + Math.sin(a - 0.9) * 0.28); g.lineTo(x, y); g.lineTo(x + Math.cos(a + P / 2 + 0.5) * 0.28, y + Math.sin(a + P / 2 + 0.5) * 0.28); g.stroke();
  }
}
function fly(g: G) {
  g.beginPath(); g.moveTo(-0.7, -0.2); g.quadraticCurveTo(-0.3, -0.6, 0, 0.1); g.quadraticCurveTo(0.3, -0.6, 0.7, -0.2); g.quadraticCurveTo(0.3, 0.1, 0, 0.45); g.quadraticCurveTo(-0.3, 0.1, -0.7, -0.2); g.fill();
}
function openWalls(g: G) {
  g.setLineDash([0.22, 0.16]); g.strokeRect(-0.55, -0.55, 1.1, 1.1); g.setLineDash([]);
  g.beginPath(); g.moveTo(-0.85, 0); g.lineTo(0.85, 0); g.stroke();
}
function switchIcon(g: G) {
  for (const s of [1, -1]) {
    g.beginPath(); g.moveTo(-0.6, -0.4 * s); g.bezierCurveTo(0, -0.4 * s, 0, 0.4 * s, 0.6, 0.4 * s); g.stroke();
    g.beginPath(); g.moveTo(0.38, 0.22 * s); g.lineTo(0.62, 0.4 * s); g.lineTo(0.38, 0.6 * s); g.stroke();
  }
}
function split(g: G) {
  g.beginPath(); g.moveTo(0, 0.7); g.lineTo(0, 0); g.lineTo(-0.5, -0.55); g.moveTo(0, 0); g.lineTo(0.5, -0.55); g.moveTo(0, 0); g.lineTo(0, -0.7); g.stroke();
}
function corner(g: G) {
  g.beginPath(); g.moveTo(-0.5, -0.25); g.lineTo(0, 0.3); g.lineTo(0.5, -0.25); g.stroke();
}
function turn(g: G, r: number) {
  g.beginPath(); g.arc(0, 0.3, r, P * 1.05, P * 1.95); g.stroke();
}
function moving(g: G) {
  g.beginPath(); g.arc(0, 0, 0.5, 0, 2 * P); g.stroke();
  g.beginPath(); g.arc(0.5, 0, 0.16, 0, 2 * P); g.fill();
  g.beginPath(); g.arc(-0.5, 0, 0.16, 0, 2 * P); g.fill();
}
function finger(g: G) {
  g.beginPath(); g.moveTo(-0.6, 0); g.lineTo(0.45, 0); g.stroke();
  g.beginPath(); g.moveTo(0.2, -0.3); g.lineTo(0.55, 0); g.lineTo(0.2, 0.3); g.stroke();
  g.beginPath(); g.moveTo(-0.6, -0.4); g.lineTo(-0.6, 0.4); g.stroke();
}
function darkness(g: G) {
  g.beginPath(); g.arc(0, 0, 0.58, 0, 2 * P); g.fill();
  g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(0.28, -0.2, 0.5, 0, 2 * P); g.fill(); g.restore();
}
function noDraw(g: G) {
  g.beginPath(); g.arc(0, 0, 0.55, 0, 2 * P); g.stroke();
  g.beginPath(); g.moveTo(-0.39, 0.39); g.lineTo(0.39, -0.39); g.stroke();
}
function closing(g: G) {
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    g.beginPath(); g.moveTo(sx * 0.65, sy * 0.25); g.lineTo(sx * 0.65, sy * 0.65); g.lineTo(sx * 0.25, sy * 0.65); g.stroke();
    g.beginPath(); g.moveTo(sx * 0.6, sy * 0.6); g.lineTo(sx * 0.2, sy * 0.2); g.stroke();
  }
}
function cheese(g: G) {
  g.beginPath(); g.moveTo(-0.6, 0.45); g.lineTo(0.65, 0.45); g.lineTo(0.65, -0.1); g.lineTo(-0.6, 0.45); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-0.6, 0.45); g.lineTo(0.65, -0.1); g.lineTo(0.3, -0.55); g.closePath(); g.fill();
  g.save(); g.globalCompositeOperation = 'destination-out';
  for (const [x, y, r] of [[0.25, 0.22, 0.1], [0.45, 0.05, 0.07], [0.05, 0.3, 0.06]]) { g.beginPath(); g.arc(x, y, r, 0, 2 * P); g.fill(); }
  g.restore();
}

const GLYPHS: Record<string, (g: G) => void> = {
  greenSpeed: bolt, redSpeed: bolt,
  thin: (g) => line(g, 0.08),
  fat: (g) => line(g, 0.4),
  greenTurtle: turtle, redTurtle: turtle,
  eraser, greenEraser: eraser,
  bubbles, reverse, fly,
  openWalls, greenOpenWalls: openWalls,
  switch: switchIcon, split,
  greenCorner: corner, redCorner: corner,
  smallTurn: (g) => turn(g, 0.32),
  bigTurn: (g) => turn(g, 0.62),
  movingPowerups: moving, finger, darkness, noDraw,
  closingWalls: closing, cheese,
};

/** A powerup disc of radius r (canvas pixels) at x, y. */
export function drawPowerup(g: G, kind: string, x: number, y: number, r: number) {
  const p = POWERUPS[kind as keyof typeof POWERUPS];
  g.save();
  g.translate(x, y);
  g.fillStyle = DISC[p?.colour ?? 'blue'];
  g.beginPath();
  g.arc(0, 0, r, 0, 2 * P);
  g.fill();
  // the glyph in its own layer, so its cut-outs don't cut the disc
  g.scale(r * 0.62, r * 0.62);
  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  g.lineWidth = 0.16;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const glyph = GLYPHS[kind];
  if (glyph) {
    const hasCut = glyph === eraser || glyph === darkness || glyph === cheese;
    if (hasCut) {
      // draw on a scratch canvas so destination-out only cuts the glyph
      const size = Math.ceil(r * 2);
      const scratch = scratchCanvas(size);
      const s = scratch.getContext('2d')!;
      s.clearRect(0, 0, size, size);
      s.save();
      s.translate(size / 2, size / 2);
      s.scale(r * 0.62, r * 0.62);
      s.fillStyle = '#fff'; s.strokeStyle = '#fff'; s.lineWidth = 0.16; s.lineCap = 'round'; s.lineJoin = 'round';
      glyph(s);
      s.restore();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(scratch, 0, 0, size, size, x - size / 2, y - size / 2, size, size);
    } else {
      glyph(g);
    }
  }
  g.restore();
}

let scratch: HTMLCanvasElement | null = null;
function scratchCanvas(size: number) {
  if (!scratch) scratch = document.createElement('canvas');
  if (scratch.width < size) scratch.width = scratch.height = size;
  return scratch;
}
