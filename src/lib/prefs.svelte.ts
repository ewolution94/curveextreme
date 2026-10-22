// This device's settings: how the field and your curve are shown (the steering pick's switches, so a
// playtest can flip them), sound, language, the shared keyboard's keys. Kept in localStorage.

import { load, save } from './store';
import { DEFAULT_SEAT_KEYS, type BothKeys } from './input';
import { setSound } from './sound';

export type FieldSize = 'auto' | 'reference' | 'fill';
export type Motion = 'predict' | 'server';

const browserLang = (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('de')) ? 'de' : 'en';

export const prefs = $state(
  load('cx-prefs', {
    sound: true,
    lang: browserLang as 'en' | 'de',
    /** auto: the reference's scale on a computer (window height ÷ 922 px per unit), the whole screen on a phone */
    fieldSize: 'auto' as FieldSize,
    /** predict: your curve drawn ahead with the keys you hold (instant); server: a tick behind */
    motion: 'predict' as Motion,
    /** others are drawn this many ticks in the past, so their motion stays smooth */
    behind: 2,
    both: 'last' as BothKeys,
    seatKeys: DEFAULT_SEAT_KEYS.map((p) => [...p]) as [string, string][],
  }),
);

setSound(prefs.sound);

export function savePrefs() {
  setSound(prefs.sound);
  save('cx-prefs', $state.snapshot(prefs));
}
