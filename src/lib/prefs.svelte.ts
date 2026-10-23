// This device's settings: the field's size, sound, the shared keyboard's keys. Kept in localStorage.
// The language is the family's own key (src/lib/i18n.svelte.ts). How your curve and the others are
// shown isn't a setting since 2026-10-23: the page simulates the round itself (src/lib/runner.ts).

import { load, save } from './store';
import { DEFAULT_SEAT_KEYS } from './input';
import { setSound } from './sound';

export type FieldSize = 'auto' | 'reference' | 'fill';

// v2 (2026-10-23): the field fills the screen by default (the user's call); a device that saved the
// old default, auto, moves to fill once. Like the original stays one setting away.
const VERSION = 2;
const saved = load<{ v?: number } | null>('cx-prefs', null);
const outdated = !!saved && (saved.v ?? 1) < VERSION;

export const prefs = $state(
  load('cx-prefs', {
    v: VERSION,
    sound: true,
    /** fill: all the room there is; reference: the reference's scale (window height ÷ 922 px per unit);
     *  auto: the reference's scale on a computer, the whole screen on a phone */
    fieldSize: 'fill' as FieldSize,
    seatKeys: DEFAULT_SEAT_KEYS.map((p) => [...p]) as [string, string][],
  }),
);

if (outdated) {
  if (prefs.fieldSize === 'auto') prefs.fieldSize = 'fill';
  prefs.v = VERSION;
  save('cx-prefs', $state.snapshot(prefs));
}

setSound(prefs.sound);

export function savePrefs() {
  setSound(prefs.sound);
  save('cx-prefs', $state.snapshot(prefs));
}
