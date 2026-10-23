// Curve colours: ten everyone has from the start (a room of ten always has enough), and more that
// levels unlock (XP lives on each device). The ten are look A's (plans/curveextreme/looks.html),
// picked to stay apart from each other on its black field.

export const BASE = Object.freeze([
  { id: 'red', name: 'Red', hex: '#ff4a3d' },
  { id: 'orange', name: 'Orange', hex: '#ff9f1c' },
  { id: 'yellow', name: 'Yellow', hex: '#ffe53b' },
  { id: 'lime', name: 'Lime', hex: '#b6ef3c' },
  { id: 'green', name: 'Green', hex: '#2fcf6e' },
  { id: 'cyan', name: 'Cyan', hex: '#27d3e0' },
  { id: 'blue', name: 'Blue', hex: '#3f8cff' },
  { id: 'violet', name: 'Violet', hex: '#a26bff' },
  { id: 'pink', name: 'Pink', hex: '#ff5fc1' },
  { id: 'white', name: 'White', hex: '#f2f2f2' },
]);

/** Unlocked at a level: the level is the key. */
export const UNLOCKS = Object.freeze([
  { level: 2, id: 'raspberry', name: 'Raspberry', hex: '#ff2a6d' },
  { level: 3, id: 'teal', name: 'Teal', hex: '#14b8a6' },
  { level: 4, id: 'sand', name: 'Sand', hex: '#c9a46a' },
  { level: 5, id: 'salmon', name: 'Salmon', hex: '#ff8c69' },
  { level: 6, id: 'periwinkle', name: 'Periwinkle', hex: '#8f9bff' },
  { level: 7, id: 'mint', name: 'Mint', hex: '#98ffb3' },
  { level: 8, id: 'mauve', name: 'Mauve', hex: '#e0b0ff' },
  { level: 9, id: 'copper', name: 'Copper', hex: '#c8743a' },
  { level: 10, id: 'ice', name: 'Ice', hex: '#cfefff' },
  { level: 12, id: 'aqua', name: 'Aqua', hex: '#7fffd4' },
  { level: 14, id: 'rose', name: 'Rose', hex: '#ffb3c7' },
  { level: 16, id: 'gold', name: 'Gold', hex: '#d4a017' },
  { level: 18, id: 'crimson', name: 'Crimson', hex: '#c4122f' },
  { level: 20, id: 'ultra', name: 'Ultramarine', hex: '#5b6cff' },
]);

export const ALL = Object.freeze([...BASE, ...UNLOCKS]);
const HEX = new Set(ALL.map((c) => c.hex));

/** A colour the server accepts: one of ours (unlocks are checked on the device, not here). */
export const isColour = (hex) => HEX.has(hex);

/** The first base colour nobody in `taken` has. */
export function freeColour(taken) {
  return (BASE.find((c) => !taken.has(c.hex)) ?? ALL.find((c) => !taken.has(c.hex)) ?? BASE[0]).hex;
}
