// Curve colours: ten everyone has from the start (a room of ten always has enough), and more that
// levels unlock (XP lives on each device). Picked to stay apart from each other on a dark field.

export const BASE = Object.freeze([
  { id: 'red', name: 'Red', hex: '#ff4d4d' },
  { id: 'orange', name: 'Orange', hex: '#ff9f1c' },
  { id: 'yellow', name: 'Yellow', hex: '#ffe14d' },
  { id: 'green', name: 'Green', hex: '#7be04a' },
  { id: 'teal', name: 'Teal', hex: '#2ed8c3' },
  { id: 'blue', name: 'Blue', hex: '#4da3ff' },
  { id: 'violet', name: 'Violet', hex: '#a07bff' },
  { id: 'pink', name: 'Pink', hex: '#ff6fcf' },
  { id: 'white', name: 'White', hex: '#f4f4f4' },
  { id: 'sand', name: 'Sand', hex: '#c9a46a' },
]);

/** Unlocked at a level: the level is the key. */
export const UNLOCKS = Object.freeze([
  { level: 2, id: 'raspberry', name: 'Raspberry', hex: '#ff2a6d' },
  { level: 3, id: 'cyan', name: 'Cyan', hex: '#00e0ff' },
  { level: 4, id: 'lime', name: 'Lime', hex: '#c6ff1a' },
  { level: 5, id: 'gold', name: 'Gold', hex: '#ffd23f' },
  { level: 6, id: 'periwinkle', name: 'Periwinkle', hex: '#8f9bff' },
  { level: 7, id: 'salmon', name: 'Salmon', hex: '#ff8c69' },
  { level: 8, id: 'mint', name: 'Mint', hex: '#98ffb3' },
  { level: 9, id: 'mauve', name: 'Mauve', hex: '#e0b0ff' },
  { level: 10, id: 'blaze', name: 'Blaze', hex: '#ff5a1f' },
  { level: 12, id: 'aqua', name: 'Aqua', hex: '#7fffd4' },
  { level: 14, id: 'rose', name: 'Rose', hex: '#ffb3c7' },
  { level: 16, id: 'ice', name: 'Ice', hex: '#cfefff' },
  { level: 18, id: 'crimson', name: 'Crimson', hex: '#e0193c' },
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
