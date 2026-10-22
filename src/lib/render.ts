// Draws the field on three canvases: the trail (lines, drawn once when the shown time passes them),
// the top layer (heads, live line ends, powerups, zones, walls, arrows, bursts, effect rings,
// redrawn every frame) and the fog (darkness). The look comes from a Theme, so a new look is a new
// theme object, not new drawing code.

import { POWERUPS, ACTIONS } from '../../shared/powerups.mjs';
import { drawPowerup } from './icons';
import { predictPath, type Pending } from './predict';
import type { Curve, Seg, World } from './world';

export type Theme = {
  field: string; // the field's ground
  edge: string; // the walls
  arrow: string | null; // null: the curve's own colour
  zoneFill: string;
  zoneEdge: string;
  ring: string;
  veil: string; // outside closing walls
};

export const CLASSIC_THEME: Theme = {
  field: '#000000',
  edge: '#ffffff',
  arrow: null,
  zoneFill: 'rgba(46, 100, 194, 0.22)',
  zoneEdge: 'rgba(110, 160, 255, 0.75)',
  ring: 'rgba(255, 255, 255, 0.85)',
  veil: 'rgba(0, 0, 0, 0.72)',
};

/** How this page shows a round: which curves are its own, how far ahead and behind. */
export type ShowOptions = {
  now: number;
  own: Set<string>; // the player ids this page steers
  predict: boolean; // own curves drawn ahead (instant) or a tick behind
  aheadMs: number; // instant: how far ahead (the round trip online, 0 on the shared keyboard)
  behindTicks: number; // others are shown this many ticks in the past
  inputFor: (pid: string) => { dir0: number; pending: Pending[] }; // own curves' inputs
  colourOf: (pid: string) => string;
};

type Shown = { c: Curve; x: number; y: number; a: number; tail: number[] | null; own: boolean };

export class Renderer {
  trail: CanvasRenderingContext2D;
  top: CanvasRenderingContext2D;
  fog: CanvasRenderingContext2D;
  theme: Theme = CLASSIC_THEME;
  scale = 1;
  dpr = 1;
  bursts: { x: number; y: number; colour: string; born: number; w: number }[] = [];
  private committed = new Map<number, Seg>(); // each curve's last committed piece, for round joins
  private fogOn = false;

  constructor(trail: HTMLCanvasElement, top: HTMLCanvasElement, fog: HTMLCanvasElement) {
    this.trail = trail.getContext('2d')!;
    this.top = top.getContext('2d')!;
    this.fog = fog.getContext('2d')!;
  }

  /** The canvases' size in CSS pixels for a field of W × H units. */
  resize(world: World, cssW: number, cssH: number, colourOf: (pid: string) => string) {
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    for (const g of [this.trail, this.top, this.fog]) {
      g.canvas.style.width = `${cssW}px`;
      g.canvas.style.height = `${cssH}px`;
      g.canvas.width = Math.max(1, Math.round(cssW * this.dpr));
      g.canvas.height = Math.max(1, Math.round(cssH * this.dpr));
    }
    this.scale = this.trail.canvas.width / world.W;
    this.redrawAll(world, colourOf);
  }

  redrawAll(world: World, colourOf: (pid: string) => string) {
    const g = this.trail;
    g.clearRect(0, 0, g.canvas.width, g.canvas.height);
    this.committed.clear();
    for (const c of world.curves.values()) {
      let prev: Seg | null = null;
      for (const s of c.segs) {
        this.piece(g, s, prev && prev.k === s.k - 1 ? prev : null, colourOf(c.pid));
        prev = s;
      }
      if (prev) this.committed.set(c.cid, prev);
    }
    world.redraw = false;
  }

  /** A line piece: square ends (the reference's), a round join to the piece before it. */
  private piece(g: CanvasRenderingContext2D, s: { x1: number; y1: number; x2: number; y2: number; w: number }, prev: Seg | null, colour: string, x2 = s.x2, y2 = s.y2) {
    const k = this.scale;
    g.strokeStyle = colour;
    g.lineWidth = s.w * k;
    g.lineCap = 'butt';
    g.lineJoin = 'round';
    g.beginPath();
    if (prev) {
      g.moveTo(prev.x1 * k, prev.y1 * k);
      g.lineTo(s.x1 * k, s.y1 * k);
    } else g.moveTo(s.x1 * k, s.y1 * k);
    g.lineTo(x2 * k, y2 * k);
    g.stroke();
  }

  private commit(c: Curve, upTo: number, colour: string) {
    while (c.pending.length && c.pending[0].k <= upTo) {
      const s = c.pending.shift()!;
      const prev = this.committed.get(c.cid);
      this.piece(this.trail, s, prev && prev.k === s.k - 1 ? prev : null, colour);
      this.committed.set(c.cid, s);
      c.segs.push(s);
    }
  }

  /** One frame. */
  frame(world: World, o: ShowOptions) {
    if (world.redraw) this.redrawAll(world, o.colourOf);
    const k = this.scale;
    const g = this.top;
    g.clearRect(0, 0, g.canvas.width, g.canvas.height);
    const live = world.liveTick(o.now);
    const behind = live - o.behindTicks;
    const rect = world.rectAt(behind);

    // the curves where this page shows them
    const shown: Shown[] = [];
    for (const c of world.curves.values()) {
      const colour = o.colourOf(c.pid);
      const own = o.own.has(c.pid);
      if (own && o.predict) {
        this.commit(c, world.k, colour);
        const inp = o.inputFor(c.pid);
        const ahead = (o.now - world.arrival + o.aheadMs) / world.dtMs;
        const { pts, head } = predictPath(world, c, ahead, inp.dir0, inp.pending);
        const last = c.hist[c.hist.length - 1];
        const drawing = c.alive && world.phase !== 'still' && world.k > world.free && (last.bits & 1) !== 0 && !c.m.fly;
        shown.push({ c, x: head.x, y: head.y, a: head.a, tail: drawing ? pts : null, own });
      } else {
        const t = own ? live - 1 : behind;
        const base = Math.floor(t);
        this.commit(c, base, colour);
        const p = world.at(c, t);
        const next = c.pending[0];
        const tail = next && next.k === base + 1 && !p.jumpAfter ? [next.x1, next.y1, p.x, p.y] : null;
        shown.push({ c, x: p.x, y: p.y, a: p.a, tail, own });
      }
    }

    // safe zones
    for (const z of world.zones) {
      if (z.until <= behind) continue;
      g.fillStyle = this.theme.zoneFill;
      g.strokeStyle = this.theme.zoneEdge;
      g.lineWidth = 1.5 * this.dpr;
      g.beginPath();
      g.arc(z.x * k, z.y * k, z.r * k, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }

    // powerups
    const pr = (world.feel?.powerupRadius ?? 22) * k;
    for (const p of world.powerups.values()) drawPowerup(g, p.kind, p.x * k, p.y * k, pr);

    // live line ends and heads
    for (const s of shown) {
      const colour = o.colourOf(s.c.pid);
      if (s.tail && s.c.alive) {
        const w = s.c.m.w;
        g.strokeStyle = colour;
        g.lineWidth = w * k;
        g.lineCap = 'butt';
        g.lineJoin = 'round';
        g.beginPath();
        let moved = false;
        for (let i = 0; i + 1 < s.tail.length; i += 2) {
          const x = s.tail[i], y = s.tail[i + 1];
          if (Number.isNaN(x)) { moved = false; continue; }
          if (!moved) { g.moveTo(x * k, y * k); moved = true; } else g.lineTo(x * k, y * k);
        }
        g.stroke();
      }
      if (!s.c.alive) continue;
      g.fillStyle = colour;
      g.beginPath();
      g.arc(s.x * k, s.y * k, Math.max((s.c.m.w / 2) * k, 1.5 * this.dpr), 0, Math.PI * 2);
      g.fill();
    }

    // the heading arrows while the curves sit still, and a ring around your own
    if (live <= world.still) {
      for (const s of shown) {
        if (!s.c.alive) continue;
        const colour = this.theme.arrow ?? o.colourOf(s.c.pid);
        const L = 32, hx = s.x + Math.cos(s.a) * L, hy = s.y + Math.sin(s.a) * L;
        g.strokeStyle = colour;
        g.lineWidth = Math.max(1.5 * this.dpr, s.c.m.w * 0.3 * k);
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo((s.x + Math.cos(s.a) * s.c.m.w * 0.6) * k, (s.y + Math.sin(s.a) * s.c.m.w * 0.6) * k);
        g.lineTo(hx * k, hy * k);
        for (const side of [-1, 1]) {
          const a = s.a + Math.PI + side * 0.5;
          g.moveTo(hx * k, hy * k);
          g.lineTo((hx + Math.cos(a) * 8) * k, (hy + Math.sin(a) * 8) * k);
        }
        g.stroke();
        if (s.own) {
          const pulse = 0.5 + 0.5 * Math.sin(o.now / 180);
          g.strokeStyle = this.theme.ring;
          g.globalAlpha = 0.35 + 0.5 * pulse;
          g.lineWidth = 1.5 * this.dpr;
          g.beginPath();
          g.arc(s.x * k, s.y * k, (s.c.m.w / 2 + 9 + pulse * 3) * k, 0, Math.PI * 2);
          g.stroke();
          g.globalAlpha = 1;
        }
      }
    }

    // effect rings: the longest-running effect's time left, on your own curves
    for (const s of shown) {
      if (!s.own || !s.c.alive || !s.c.m.fx?.length) continue;
      let left = 0;
      for (const [kind, until] of s.c.m.fx) {
        const dur = (POWERUPS as any)[kind]?.dur ?? 1;
        left = Math.max(left, (until - live) / (dur * world.rate));
      }
      if (left <= 0) continue;
      g.strokeStyle = this.theme.ring;
      g.lineWidth = 1.5 * this.dpr;
      g.beginPath();
      g.arc(s.x * k, s.y * k, (s.c.m.w / 2 + 6) * k, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, left));
      g.stroke();
    }

    // crashes: translucent circles in the curve's colour, out about 30 units, gone after 2 s
    this.bursts = this.bursts.filter((b) => o.now - b.born < 2000);
    for (const b of this.bursts) {
      const t = (o.now - b.born) / 2000;
      const e = 1 - (1 - t) * (1 - t);
      g.globalAlpha = 0.45 * (1 - t);
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
    if (world.walls.closing) {
      g.fillStyle = this.theme.veil;
      const W = world.W * k, H = world.H * k;
      g.beginPath();
      g.rect(0, 0, W, H);
      g.rect(rect.x0 * k, rect.y0 * k, (rect.x1 - rect.x0) * k, (rect.y1 - rect.y0) * k);
      g.fill('evenodd');
      g.strokeStyle = this.theme.edge;
      g.lineWidth = 1.5 * this.dpr;
      g.strokeRect(rect.x0 * k, rect.y0 * k, (rect.x1 - rect.x0) * k, (rect.y1 - rect.y0) * k);
    }

    // darkness: black but for a light around each head
    const dark = behind < world.darkUntil;
    const f = this.fog;
    if (dark) {
      f.globalCompositeOperation = 'source-over';
      f.clearRect(0, 0, f.canvas.width, f.canvas.height);
      f.fillStyle = '#000';
      f.fillRect(0, 0, f.canvas.width, f.canvas.height);
      f.globalCompositeOperation = 'destination-out';
      const R = ACTIONS.darkness.radius * k;
      for (const s of shown) {
        if (!s.c.alive) continue;
        const grad = f.createRadialGradient(s.x * k, s.y * k, R * 0.55, s.x * k, s.y * k, R);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        f.fillStyle = grad;
        f.beginPath();
        f.arc(s.x * k, s.y * k, R, 0, Math.PI * 2);
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
