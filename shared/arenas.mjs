// Arenas (the user's picks, development/plans/curveextreme.md, "Arenas"): the floor's shape (Square
// as measured, Circle as the reference also has, Hexagon, Ring with its island, Cross), its size, and
// what stands on it: Pillars (round and square, nothing gets through) and patches of Ice (turns
// wider) and Mud (slower). Where the pillars and patches go comes from the round's seed, so every
// page builds the same arena. Each shape gets a field big enough for the floor to have the measured
// square's room. Every number is here, as data.
//
// The tests for "inside" use only +, −, × and comparisons, the bounces dmath's own angles (the
// lockstep's rule, shared/dmath.mjs).

import { PI, HALF_PI, atan2, cos, sin, norm } from './dmath.mjs';

export const SHAPES = Object.freeze(['square', 'circle', 'hexagon', 'ring', 'cross']);
export const SIZES = Object.freeze({ small: 0.8, normal: 1, large: 1.4 });

export const ARENA_NUMBERS = Object.freeze({
  island: 0.3, // the Ring's island: its radius as a share of the ring's
  arm: 0.2, // the Cross: half an arm's width as a share of the field's side
  pillarsBase: 3, // pillars: this many, plus one per player
  pillarSize: [10, 24], // a pillar's radius (or half-side), smallest and largest
  pillarClear: 60, // spawns keep this far from a pillar's edge
  patchesBase: 2, // ice and mud patches: this many, plus one per two players
  patchSize: [34, 62], // a patch's radius, smallest and largest
  ice: { radius: 1.8 }, // on ice a held turn is this much wider
  mud: { speed: 0.6 }, // in mud a curve moves at this share of its speed
});

const HEX = 0.8660254037844386; // √3 / 2: a flat-topped hexagon's apothem over its circumradius
const { island: ISLAND, arm: ARM } = ARENA_NUMBERS;
/** The flat-topped hexagon's walls: each one's outward normal and its angle. */
const HEX_WALLS = [[0, 1, HALF_PI], [0, -1, -HALF_PI], [HEX, 0.5, PI / 6], [HEX, -0.5, -PI / 6], [-HEX, 0.5, (5 * PI) / 6], [-HEX, -0.5, (-5 * PI) / 6]];

/**
 * A head `e` past a wall whose outward normal is (nx, ny), at angle phi: mirrored back in by the
 * wall, and its heading too if it points out (the angle of incidence is the angle of reflection).
 */
function mirror(c, nx, ny, phi, e) {
  c.x -= 2 * e * nx;
  c.y -= 2 * e * ny;
  if (cos(c.a - phi) > 0) c.a = norm(PI + 2 * phi - c.a);
}
/** Each shape's floor as a share of the square on its width. */
const AREA = {
  square: 1,
  circle: 0.7853981633974483,
  hexagon: 0.649519052838329, // (3√3/2)·(W/2)²; its box is W × W·√3/2
  ring: 0.7853981633974483 * (1 - ISLAND * ISLAND),
  cross: 4 * ARM - 4 * ARM * ARM,
};

export const DEFAULT_ARENA = Object.freeze({ shape: 'square', size: 'normal', pillars: false, patches: false });

/** An arena from anywhere (a message, the settings) made safe. */
export function cleanArena(input, base = DEFAULT_ARENA) {
  const out = { ...DEFAULT_ARENA, ...base };
  if (!input || typeof input !== 'object') return out;
  if (SHAPES.includes(input.shape)) out.shape = input.shape;
  if (Object.hasOwn(SIZES, input.size)) out.size = input.size;
  if (typeof input.pillars === 'boolean') out.pillars = input.pillars;
  if (typeof input.patches === 'boolean') out.patches = input.patches;
  return out;
}

/** The field (the arena's bounding box) for a number of players, in units: [width, height]. */
export function arenaField(feel, players, arena = DEFAULT_ARENA) {
  const side = feel.fieldBase * Math.sqrt(Math.max(1, players)) * (SIZES[arena.size] ?? 1);
  if (arena.shape === 'square') return [Math.round(side * feel.fieldWide), Math.round(side * feel.fieldTall)];
  // the other shapes are round or regular: a square box (a hexagon's is √3/2 as tall) with the
  // measured field's room on its floor
  const s = side * Math.sqrt((feel.fieldWide * feel.fieldTall) / AREA[arena.shape]);
  return arena.shape === 'hexagon' ? [Math.round(s), Math.round(s * HEX)] : [Math.round(s), Math.round(s)];
}

/** The arena's floor, at a scale (Closing Walls shrinks it towards the middle). */
export class Floor {
  constructor(arena, W, H) {
    this.shape = arena.shape;
    this.W = W;
    this.H = H;
    this.cx = W / 2;
    this.cy = H / 2;
    this.hw = W / 2;
    this.hh = H / 2;
    this.R = Math.min(W, H) / 2; // circle and ring
    this.hexR = W / 2; // hexagon: circumradius
    this.hexA = H / 2; // hexagon: apothem
    this.arm = ARM * W; // cross: half an arm's width
  }

  /** Is (x, y) on the floor, at least `margin` from every edge, with the walls at scale s? */
  inside(x, y, margin = 0, s = 1) {
    const dx = Math.abs(x - this.cx), dy = Math.abs(y - this.cy);
    switch (this.shape) {
      case 'circle': {
        const r = s * this.R - margin;
        return r > 0 && dx * dx + dy * dy <= r * r;
      }
      case 'ring': {
        const r = s * this.R - margin, i = s * ISLAND * this.R + margin;
        const d2 = dx * dx + dy * dy;
        return r > 0 && d2 <= r * r && d2 >= i * i;
      }
      case 'hexagon': {
        const a = s * this.hexA - margin;
        return dy <= a && HEX * dx + 0.5 * dy <= a;
      }
      case 'cross': {
        const w = s * this.arm - margin;
        return (dx <= s * this.hw - margin && dy <= w) || (dx <= w && dy <= s * this.hh - margin);
      }
      default:
        return dx <= s * this.hw - margin && dy <= s * this.hh - margin;
    }
  }

  /**
   * The warm-up's walls (feel.freeWalls 'bounce'): a head that went closer than `margin` to a wall
   * is mirrored back in, and its heading with it, like a ball off a cushion. (px, py) is where it
   * was this frame, on the floor. The square and the cross mirror in their straight walls, the
   * hexagon in its six, the circle and the ring in the line through the middle.
   */
  bounce(c, px, py, margin, s = 1) {
    if (this.inside(c.x, c.y, margin, s)) return;
    const X = c.x - this.cx, Y = c.y - this.cy;
    switch (this.shape) {
      case 'circle':
      case 'ring': {
        const phi = atan2(Y, X), nx = cos(phi), ny = sin(phi);
        const d = X * nx + Y * ny;
        const out = s * this.R - margin;
        if (d > out) mirror(c, nx, ny, phi, d - out);
        const island = s * ISLAND * this.R + margin;
        if (this.shape === 'ring' && d < island) mirror(c, -nx, -ny, phi + PI, island - d);
        break;
      }
      case 'hexagon': {
        const a = s * this.hexA - margin;
        for (let pass = 0; pass < 2; pass++) {
          for (const [nx, ny, phi] of HEX_WALLS) {
            const e = (c.x - this.cx) * nx + (c.y - this.cy) * ny - a;
            if (e > 0) mirror(c, nx, ny, phi, e);
          }
        }
        break;
      }
      case 'cross': {
        // the arm it was in; from the middle, the arm it left by less
        const w = s * this.arm - margin;
        const across = [s * this.hw - margin, w], upDown = [w, s * this.hh - margin];
        const qx = Math.abs(px - this.cx), qy = Math.abs(py - this.cy);
        const over = ([hx, hy]) => Math.max(0, Math.abs(X) - hx) + Math.max(0, Math.abs(Y) - hy);
        const arm = qy <= w && qx > w ? across : qx <= w && qy > w ? upDown : over(across) <= over(upDown) ? across : upDown;
        this.box(c, arm[0], arm[1]);
        break;
      }
      default:
        this.box(c, s * this.hw - margin, s * this.hh - margin);
    }
    // a corner can leave it outside still: back where it was, the heading turned
    if (!this.inside(c.x, c.y, margin, s) && this.inside(px, py, margin, s)) {
      c.x = px;
      c.y = py;
    }
  }

  /** Mirrors a head back into the box |x| ≤ hx, |y| ≤ hy about the middle. */
  box(c, hx, hy) {
    const X = c.x - this.cx, Y = c.y - this.cy;
    if (X > hx) mirror(c, 1, 0, 0, X - hx);
    else if (-X > hx) mirror(c, -1, 0, PI, -X - hx);
    if (Y > hy) mirror(c, 0, 1, HALF_PI, Y - hy);
    else if (-Y > hy) mirror(c, 0, -1, -HALF_PI, -Y - hy);
  }

  /** The bounding box at scale s (where powerups may be placed; the square's walls). */
  rect(s = 1) {
    return { x0: this.cx - s * this.hw, y0: this.cy - s * this.hh, x1: this.cx + s * this.hw, y1: this.cy + s * this.hh };
  }

  /** The corners of the floor's outline at scale s (hexagon and cross; the others are drawn as arcs). */
  polygon(s = 1) {
    const { cx, cy } = this;
    if (this.shape === 'hexagon') {
      const R = s * this.hexR, A = s * this.hexA;
      return [[cx + R, cy], [cx + R / 2, cy + A], [cx - R / 2, cy + A], [cx - R, cy], [cx - R / 2, cy - A], [cx + R / 2, cy - A]];
    }
    if (this.shape === 'cross') {
      const w = s * this.arm, X = s * this.hw, Y = s * this.hh;
      return [[cx - w, cy - Y], [cx + w, cy - Y], [cx + w, cy - w], [cx + X, cy - w], [cx + X, cy + w], [cx + w, cy + w], [cx + w, cy + Y], [cx - w, cy + Y], [cx - w, cy + w], [cx - X, cy + w], [cx - X, cy - w], [cx - w, cy - w]];
    }
    const r = this.rect(s);
    return [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]];
  }
}

/**
 * The things on the floor for a round, from its random numbers (`rand`, the round's own):
 * pillars { kind: 'round' | 'square', x, y, r } and patches { kind: 'ice' | 'mud', x, y, r }.
 */
export function furnish(arena, floor, players, rand) {
  const N = ARENA_NUMBERS;
  const pillars = [];
  const patches = [];
  if (arena.pillars) {
    const count = N.pillarsBase + players;
    for (let i = 0; i < count; i++) {
      const r = N.pillarSize[0] + rand() * (N.pillarSize[1] - N.pillarSize[0]);
      const kind = rand() < 0.5 ? 'round' : 'square';
      for (let tries = 0; tries < 30; tries++) {
        const x = rand() * floor.W, y = rand() * floor.H;
        if (!floor.inside(x, y, r * 1.5 + 30)) continue;
        if (pillars.some((p) => near(p, x, y, p.r + r + 50))) continue;
        pillars.push({ kind, x, y, r });
        break;
      }
    }
  }
  if (arena.patches) {
    const count = N.patchesBase + Math.floor(players / 2);
    for (let i = 0; i < count; i++) {
      const r = N.patchSize[0] + rand() * (N.patchSize[1] - N.patchSize[0]);
      const kind = i % 2 === 0 ? 'ice' : 'mud';
      for (let tries = 0; tries < 30; tries++) {
        const x = rand() * floor.W, y = rand() * floor.H;
        if (!floor.inside(x, y, r * 0.4)) continue;
        if (pillars.some((p) => near(p, x, y, p.r + r))) continue;
        if (patches.some((p) => near(p, x, y, p.r + r))) continue;
        patches.push({ kind, x, y, r });
        break;
      }
    }
  }
  return { pillars, patches };
}

const near = (p, x, y, d) => (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) < d * d;

/** Does a head of radius hr at (x, y) touch a pillar? */
export function hitsPillar(pillars, x, y, hr) {
  for (const p of pillars) {
    const dx = Math.abs(x - p.x), dy = Math.abs(y - p.y);
    if (p.kind === 'square') {
      // the distance to the square itself: at a corner, to the corner
      const ox = Math.max(0, dx - p.r), oy = Math.max(0, dy - p.r);
      if (ox * ox + oy * oy < hr * hr) return true;
    } else if (dx * dx + dy * dy < (p.r + hr) * (p.r + hr)) return true;
  }
  return false;
}

/**
 * The warm-up's pillars: a head closer than `margin` to one is mirrored off it, like off a wall
 * (off a round pillar's curve, a square one's side or corner). (px, py): where it was, clear.
 */
export function bounceOffPillars(pillars, c, px, py, margin) {
  for (const p of pillars) {
    const X = c.x - p.x, Y = c.y - p.y;
    if (p.kind !== 'square') {
      offRound(c, X, Y, p.r + margin);
      continue;
    }
    const ox = Math.abs(X) - p.r, oy = Math.abs(Y) - p.r;
    if (ox > 0 && oy > 0) offRound(c, X >= 0 ? ox : -ox, Y >= 0 ? oy : -oy, margin);
    else if (ox >= oy) {
      if (ox < margin) mirror(c, X >= 0 ? -1 : 1, 0, X >= 0 ? PI : 0, margin - ox);
    } else if (oy < margin) mirror(c, 0, Y >= 0 ? -1 : 1, Y >= 0 ? -HALF_PI : HALF_PI, margin - oy);
  }
  if (hitsPillar(pillars, c.x, c.y, margin) && !hitsPillar(pillars, px, py, margin)) {
    c.x = px;
    c.y = py;
  }
}

/** Off a round thing: (X, Y) is the head from its middle, R the closest it may come. */
function offRound(c, X, Y, R) {
  if (X * X + Y * Y >= R * R) return;
  const phi = atan2(-Y, -X), nx = cos(phi), ny = sin(phi);
  mirror(c, nx, ny, phi, X * nx + Y * ny + R);
}

/** The patch under (x, y), if any. */
export function patchAt(patches, x, y) {
  for (const p of patches) if (near(p, x, y, p.r)) return p;
  return null;
}
