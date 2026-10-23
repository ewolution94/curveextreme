// Arenas (the user's picks, development/plans/curveextreme.md, "Arenas"): the floor's shape (Square
// as measured, Circle as the reference also has, Hexagon, Ring with its island, Cross), its size, and
// what stands on it: Pillars (round and square, nothing gets through) and patches of Ice (turns
// wider) and Mud (slower). Where the pillars and patches go comes from the round's seed, so every
// page builds the same arena. Each shape gets a field big enough for the floor to have the measured
// square's room. Every number is here, as data.
//
// The tests for "inside" use only +, −, × and comparisons (shared/dmath.mjs's rule for the lockstep).

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
    const dx = Math.abs(x - p.x), dy = Math.abs(y - p.y), reach = p.r + hr;
    if (p.kind === 'square' ? dx < reach && dy < reach : dx * dx + dy * dy < reach * reach) return true;
  }
  return false;
}

/** The patch under (x, y), if any. */
export function patchAt(patches, x, y) {
  for (const p of patches) if (near(p, x, y, p.r)) return p;
  return null;
}
