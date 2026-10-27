// Draws a round as this page simulates it (runner.ts) on four canvases: the floor (the arena's
// shape, its ice and mud, its pillars; drawn once a round), the trail (the lines, each piece drawn
// once when it's old enough that no late action can change it), the top layer (the newest pieces,
// the heads between frames, powerups, zones, the shape's edge and closing walls, arrows, bursts,
// effect rings, redrawn every frame) and the fog (darkness). A rewind deeper than the trail's settled
// part draws the trail again from the round's lines. The look comes from a Theme, so a new look is a
// new theme object, not new drawing code.

import { POWERUPS, ACTIONS } from '../../shared/powerups.mjs';
import { wrapInto } from '../../shared/engine.mjs';
import { ARENA_NUMBERS } from '../../shared/arenas.mjs';
import { drawPowerup } from './icons';
import type { RoundRunner } from './runner';

export type Theme = {
  field: string; // the field's ground
  edge: string; // the walls
  arrow: string | null; // null: the curve's own colour
  zoneFill: string;
  zoneEdge: string;
  ring: string;
  veil: string; // outside closing walls
  pillar: string;
  pillarEdge: string;
  ice: string;
  iceEdge: string;
  mud: string;
  mudEdge: string;
  open: string; // the edge while Open Walls runs
};

export const CLASSIC_THEME: Theme = {
  field: '#000000',
  edge: '#ffffff',
  arrow: null,
  zoneFill: 'rgba(46, 100, 194, 0.22)',
  zoneEdge: 'rgba(110, 160, 255, 0.75)',
  ring: 'rgba(255, 255, 255, 0.85)',
  veil: 'rgba(0, 0, 0, 0.72)',
  pillar: '#1d1d21',
  pillarEdge: '#e9e9ea',
  ice: 'rgba(150, 210, 255, 0.14)',
  iceEdge: 'rgba(170, 220, 255, 0.55)',
  mud: 'rgba(122, 82, 44, 0.42)',
  mudEdge: 'rgba(176, 124, 72, 0.7)',
  open: '#7fa9ff',
};

/** The floor's outline at scale s (a ring's island as a hole: fill it with 'evenodd'). */
export function shapePath(g: CanvasRenderingContext2D, floor: any, k: number, s = 1) {
  g.beginPath();
  if (floor.shape === 'circle' || floor.shape === 'ring') {
    g.arc(floor.cx * k, floor.cy * k, s * floor.R * k, 0, Math.PI * 2);
    if (floor.shape === 'ring') {
      const r = s * ARENA_NUMBERS.island * floor.R * k;
      g.moveTo(floor.cx * k + r, floor.cy * k);
      g.arc(floor.cx * k, floor.cy * k, r, 0, Math.PI * 2, true);
    }
    return;
  }
  const pts = floor.polygon(s);
  g.moveTo(pts[0][0] * k, pts[0][1] * k);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] * k, pts[i][1] * k);
  g.closePath();
}

/** Frames a line piece waits on the top layer before it goes on the trail for good. */
const SETTLE = 12;

export type ShowOptions = {
  now: number;
  /** The frame shown, fractional (the runner's clock). */
  T: number;
  colourOf: (player: number) => string;
  /** What's written beside a player's head while the curves sit still: [its left, its right]. */
  labelsOf?: (player: number) => [string, string] | null;
};

type Head = { c: any; x: number; y: number; a: number; own: boolean };

export class Renderer {
  floor: CanvasRenderingContext2D;
  trail: CanvasRenderingContext2D;
  top: CanvasRenderingContext2D;
  fog: CanvasRenderingContext2D;
  theme: Theme = CLASSIC_THEME;
  scale = 1;
  dpr = 1;
  bursts: { x: number; y: number; colour: string; born: number; w: number }[] = [];
  private fogOn = false;
  /** What's on the trail canvas: whose lines (round and trail object), how many points, up to which frame. */
  private drawnRunner: RoundRunner | null = null;
  private drawnTrail: any = null;
  private drawnLen = 0;
  private drawnFrame = -1;
  private lastOf = new Map<number, number>(); // each curve's last point on the trail canvas
  private floorOf: RoundRunner | null = null; // whose arena is on the floor canvas

  constructor(floor: HTMLCanvasElement, trail: HTMLCanvasElement, top: HTMLCanvasElement, fog: HTMLCanvasElement) {
    this.floor = floor.getContext('2d')!;
    this.trail = trail.getContext('2d')!;
    this.top = top.getContext('2d')!;
    this.fog = fog.getContext('2d')!;
  }

  /** The canvases' size in CSS pixels for a field of W × H units. */
  resize(W: number, cssW: number, cssH: number) {
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    for (const g of [this.floor, this.trail, this.top, this.fog]) {
      g.canvas.style.width = `${cssW}px`;
      g.canvas.style.height = `${cssH}px`;
      g.canvas.width = Math.max(1, Math.round(cssW * this.dpr));
      g.canvas.height = Math.max(1, Math.round(cssH * this.dpr));
    }
    this.scale = this.trail.canvas.width / W;
    this.drawnTrail = null; // drawn again at the new size
    this.floorOf = null;
  }

  /** The arena's floor: the shape (the square's is the field itself), ice and mud, pillars. */
  private drawFloor(runner: RoundRunner) {
    const g = this.floor;
    const round = runner.round;
    const k = this.scale;
    const t = this.theme;
    g.clearRect(0, 0, g.canvas.width, g.canvas.height);
    if (round.floor.shape !== 'square') {
      g.fillStyle = t.field;
      shapePath(g, round.floor, k);
      g.fill('evenodd');
    }
    // ice and mud stay on the floor: a patch at the edge is cut by it
    g.save();
    if (round.floor.shape !== 'square') {
      shapePath(g, round.floor, k);
      g.clip('evenodd');
    }
    for (const p of round.patches) {
      g.fillStyle = p.kind === 'ice' ? t.ice : t.mud;
      g.strokeStyle = p.kind === 'ice' ? t.iceEdge : t.mudEdge;
      g.lineWidth = 1.2 * this.dpr;
      g.setLineDash(p.kind === 'ice' ? [4 * this.dpr, 4 * this.dpr] : []);
      g.beginPath();
      g.arc(p.x * k, p.y * k, p.r * k, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.setLineDash([]);
    }
    g.restore();
    for (const p of round.pillars) {
      g.fillStyle = t.pillar;
      g.strokeStyle = t.pillarEdge;
      g.lineWidth = 1.5 * this.dpr;
      g.beginPath();
      if (p.kind === 'square') g.rect((p.x - p.r) * k, (p.y - p.r) * k, 2 * p.r * k, 2 * p.r * k);
      else g.arc(p.x * k, p.y * k, p.r * k, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    this.floorOf = runner;
  }

  /** Piece i of a trail: square ends (the reference's), a round join to the piece before it. */
  private piece(g: CanvasRenderingContext2D, t: any, i: number, prev: number | undefined, colour: string) {
    const k = this.scale;
    g.strokeStyle = colour;
    g.lineWidth = t.r[i] * 2 * k;
    g.lineCap = 'butt';
    g.lineJoin = 'round';
    g.beginPath();
    const joined = prev !== undefined && t.f[prev] === t.f[i] - 1 && t.x[prev] === t.px[i] && t.y[prev] === t.py[i];
    if (joined) {
      g.moveTo(t.px[prev] * k, t.py[prev] * k);
      g.lineTo(t.px[i] * k, t.py[i] * k);
    } else g.moveTo(t.px[i] * k, t.py[i] * k);
    g.lineTo(t.x[i] * k, t.y[i] * k);
    g.stroke();
  }

  /** The trail canvas brought up to `upTo` (points from older frames), from scratch if it must. */
  private settle(runner: RoundRunner, upTo: number, colourOf: (p: number) => string) {
    const t = runner.round.trail;
    const rewound = runner.takeRewound();
    if (runner !== this.drawnRunner || t !== this.drawnTrail || rewound <= this.drawnFrame || t.x.length < this.drawnLen) {
      const g = this.trail;
      g.clearRect(0, 0, g.canvas.width, g.canvas.height);
      this.drawnRunner = runner;
      this.drawnTrail = t;
      this.drawnLen = 0;
      this.drawnFrame = -1;
      this.lastOf.clear();
    }
    let i = this.drawnLen;
    while (i < t.x.length && t.f[i] <= upTo) {
      this.piece(this.trail, t, i, this.lastOf.get(t.cid[i]), colourOf(t.p[i]));
      this.lastOf.set(t.cid[i], i);
      i++;
    }
    this.drawnLen = i;
    this.drawnFrame = Math.max(this.drawnFrame, upTo);
  }

  /** One frame. */
  frame(runner: RoundRunner, o: ShowOptions) {
    const round = runner.round;
    const s = round.s;
    const k = this.scale;
    const g = this.top;
    const T = Math.max(0, o.T);
    const frac = Math.min(1, Math.max(0, T - s.k));
    if (this.floorOf !== runner) this.drawFloor(runner);
    this.settle(runner, s.k - SETTLE, o.colourOf);
    g.clearRect(0, 0, g.canvas.width, g.canvas.height);
    const scale = round.scaleAt(T);
    const rect = round.floor.rect(scale);
    const floor = round.floor;
    let open = false;
    for (const c of s.curves) if (c.alive && c.effects.some((e: any) => e.kind === 'openWalls' || e.kind === 'greenOpenWalls')) open = true;

    // the edge of a shaped floor (the square's is the field's own line), dashed while walls are open
    if (floor.shape !== 'square' && scale === 1) {
      g.strokeStyle = open ? this.theme.open : this.theme.edge;
      g.lineWidth = 1.5 * this.dpr;
      g.setLineDash(open ? [6 * this.dpr, 5 * this.dpr] : []);
      shapePath(g, floor, k);
      g.stroke();
      g.setLineDash([]);
    }

    // the newest pieces, not on the trail yet
    const t = s.trail;
    const last = new Map(this.lastOf);
    for (let i = this.drawnLen; i < t.x.length; i++) {
      this.piece(g, t, i, last.get(t.cid[i]), o.colourOf(t.p[i]));
      last.set(t.cid[i], i);
    }

    // the heads, between frames: the next frame's arcs, with this frame's actions known so far
    const acts = runner.actionsAt(s.k);
    const heads: Head[] = [];
    for (const c of s.curves) {
      const h = round.headAt(c, frac, acts);
      const m = round.motion(c);
      if (m.wrap && floor.shape === 'square') wrapInto(h, rect);
      heads.push({ c, x: h.x, y: h.y, a: h.a, own: runner.own.has(c.p) });
      // the live line end, from the last point to the head
      const drawing = c.alive && (s.phase === 'draw' || s.phase === 'linger') && c.gapLeft <= 0 && !m.fly && Math.abs(h.x - c.x) + Math.abs(h.y - c.y) < 40;
      const end = last.get(c.id);
      if (drawing && end !== undefined && t.f[end] === s.k - 1) {
        g.strokeStyle = o.colourOf(c.p);
        g.lineWidth = m.w * k;
        g.lineCap = 'butt';
        g.lineJoin = 'round';
        g.beginPath();
        g.moveTo(t.px[end] * k, t.py[end] * k);
        g.lineTo(c.x * k, c.y * k);
        g.lineTo(h.x * k, h.y * k);
        g.stroke();
      }
    }

    // safe zones
    for (const z of s.zones) {
      g.fillStyle = this.theme.zoneFill;
      g.strokeStyle = this.theme.zoneEdge;
      g.lineWidth = 1.5 * this.dpr;
      g.beginPath();
      g.arc(z.x * k, z.y * k, z.r * k, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }

    // powerups
    const pr = round.feel.powerupRadius * k;
    for (const p of s.powerups) drawPowerup(g, p.kind, p.x * k, p.y * k, pr);

    // heads
    for (const h of heads) {
      if (!h.c.alive) continue;
      const m = round.motion(h.c);
      g.fillStyle = o.colourOf(h.c.p);
      g.beginPath();
      g.arc(h.x * k, h.y * k, Math.max((m.w / 2) * k, 1.5 * this.dpr), 0, Math.PI * 2);
      g.fill();
    }

    // the heading arrows while the curves sit still, and a ring around your own
    if (T <= round.stillK) {
      for (const h of heads) {
        if (!h.c.alive) continue;
        const m = round.motion(h.c);
        const colour = this.theme.arrow ?? o.colourOf(h.c.p);
        const L = 32, hx = h.x + Math.cos(h.a) * L, hy = h.y + Math.sin(h.a) * L;
        g.strokeStyle = colour;
        g.lineWidth = Math.max(1.5 * this.dpr, m.w * 0.3 * k);
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo((h.x + Math.cos(h.a) * m.w * 0.6) * k, (h.y + Math.sin(h.a) * m.w * 0.6) * k);
        g.lineTo(hx * k, hy * k);
        for (const side of [-1, 1]) {
          const a = h.a + Math.PI + side * 0.5;
          g.moveTo(hx * k, hy * k);
          g.lineTo((hx + Math.cos(a) * 8) * k, (hy + Math.sin(a) * 8) * k);
        }
        g.stroke();
        // which way is left and which is right for this curve, beside its head as it points (only
        // the curves steered here); upright text, outlined in the field's black
        const labels = h.own ? o.labelsOf?.(h.c.p) : null;
        if (labels) {
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.lineJoin = 'round';
          g.lineWidth = 4 * this.dpr;
          g.strokeStyle = this.theme.field;
          g.fillStyle = colour;
          // just outside the pulsing ring around your own head (at most w/2 + 12 units)
          const ring = (m.w / 2 + 12) * k + 6 * this.dpr;
          labels.forEach((text, i) => {
            // an arrow key alone is a small glyph: drawn larger, so it reads like the letters
            const fontPx = Math.round((/^[←→↑↓]$/.test(text) ? 22 : 15) * this.dpr);
            g.font = `700 ${fontPx}px 'Archivo Variable', system-ui, sans-serif`;
            const side = i === 0 ? -1 : 1; // the curve's left is its heading turned back a quarter
            const nx = -side * Math.sin(h.a), ny = side * Math.cos(h.a);
            const away = ring + (g.measureText(text).width / 2) * Math.abs(nx) + (fontPx / 2) * Math.abs(ny);
            const lx = h.x * k + nx * away, ly = h.y * k + ny * away;
            g.strokeText(text, lx, ly);
            g.fillText(text, lx, ly);
          });
        }
        if (h.own) {
          const pulse = 0.5 + 0.5 * Math.sin(o.now / 180);
          g.strokeStyle = this.theme.ring;
          g.globalAlpha = 0.35 + 0.5 * pulse;
          g.lineWidth = 1.5 * this.dpr;
          g.beginPath();
          g.arc(h.x * k, h.y * k, (m.w / 2 + 9 + pulse * 3) * k, 0, Math.PI * 2);
          g.stroke();
          g.globalAlpha = 1;
        }
      }
    }

    // effect rings: the longest-running effect's time left, on your own curves
    for (const h of heads) {
      if (!h.own || !h.c.alive || !h.c.effects.length) continue;
      let left = 0;
      for (const e of h.c.effects) {
        const dur = (POWERUPS as any)[e.kind]?.dur ?? 1;
        left = Math.max(left, (e.until - T) / (dur * round.rate));
      }
      if (left <= 0) continue;
      const m = round.motion(h.c);
      g.strokeStyle = this.theme.ring;
      g.lineWidth = 1.5 * this.dpr;
      g.beginPath();
      g.arc(h.x * k, h.y * k, (m.w / 2 + 6) * k, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, left));
      g.stroke();
    }

    // crashes: translucent circles in the curve's colour, out about 30 units, gone after 2 s
    this.bursts = this.bursts.filter((b) => o.now - b.born < 2000);
    for (const b of this.bursts) {
      const tb = (o.now - b.born) / 2000;
      const e = 1 - (1 - tb) * (1 - tb);
      g.globalAlpha = 0.45 * (1 - tb);
      g.fillStyle = b.colour;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + (b.born % 1);
        const d = (14 + ((i * 7) % 5) * 4) * e;
        g.beginPath();
        g.arc((b.x + Math.cos(a) * d) * k, (b.y + Math.sin(a) * d) * k, b.w * 0.9 * k, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }

    // closing walls: dark outside, a line where they are
    if (s.walls.closing) {
      g.fillStyle = this.theme.veil;
      const W = round.W * k, H = round.H * k;
      shapePath(g, floor, k, scale);
      g.rect(0, 0, W, H);
      g.fill('evenodd');
      g.strokeStyle = open ? this.theme.open : this.theme.edge;
      g.lineWidth = 1.5 * this.dpr;
      shapePath(g, floor, k, scale);
      g.stroke();
    }

    // darkness: black but for a light around each head
    const f = this.fog;
    if (T < s.darkUntil) {
      f.globalCompositeOperation = 'source-over';
      f.clearRect(0, 0, f.canvas.width, f.canvas.height);
      f.fillStyle = '#000';
      f.fillRect(0, 0, f.canvas.width, f.canvas.height);
      f.globalCompositeOperation = 'destination-out';
      const R = ACTIONS.darkness.radius * k;
      for (const h of heads) {
        if (!h.c.alive) continue;
        const grad = f.createRadialGradient(h.x * k, h.y * k, R * 0.55, h.x * k, h.y * k, R);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        f.fillStyle = grad;
        f.beginPath();
        f.arc(h.x * k, h.y * k, R, 0, Math.PI * 2);
        f.fill();
      }
      f.globalCompositeOperation = 'source-over';
      this.fogOn = true;
    } else if (this.fogOn) {
      f.clearRect(0, 0, f.canvas.width, f.canvas.height);
      this.fogOn = false;
    }
  }

  burst(x: number, y: number, colour: string, w: number, now: number) {
    this.bursts.push({ x, y, colour, w, born: now });
  }
}
