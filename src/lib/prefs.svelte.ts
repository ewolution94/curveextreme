// This device's settings: how the field and your curve are shown (the steering pick's switches, so a
// playtest can flip them), sound, language, the shared keyboard's keys. Kept in localStorage.

import { load, save } from './store';
import { DEFAULT_SEAT_KEYS, type BothKeys } from './input';
import { setSound } from './sound';

export type FieldSize = 'auto' | 'reference' | 'fill';
export type Motion = 'predict' | 'server';

const browserLang = (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('de')) ? 'de' : 'en';

// v2 (2026-10-23): the field fills the screen by default (the user's call); a device that saved the
// old default, auto, moves to fill once. Like the original stays one setting away.
const VERSION = 2;
const saved = load<{ v?: number } | null>('cx-prefs', null);
const outdated = !!saved && (saved.v ?? 1) < VERSION;

export const prefs = $state(
  load('cx-prefs', {
    v: VERSION,
    sound: true,
    lang: browserLang as 'en' | 'de',
    /** fill: all the room there is; reference: the reference's scale (window height ÷ 922 px per unit);
     *  auto: the reference's scale on a computer, the whole screen on a phone */
    fieldSize: 'fill' as FieldSize,
    /** predict: your curve drawn ahead with the keys you hold (instant); server: a tick behind */
    motion: 'predict' as Motion,
    /** others are drawn this many ticks in the past, so their motion stays smooth */
    behind: 2,
    both: 'last' as BothKeys,
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
