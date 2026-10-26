// This device's settings: sound, the shared keyboard's keys. Kept in localStorage. The language is
// the family's own key (src/lib/i18n.svelte.ts). How your curve and the others are shown isn't a
// setting since 2026-10-23 (the page simulates the round itself, src/lib/runner.ts), nor is the
// field's size since 2026-10-27: it always takes the whole available space (Field.svelte).

import { load, save } from './store';
import { DEFAULT_SEAT_KEYS } from './input';
import { setSound } from './sound';

// v3 (2026-10-27): only these two are kept; what older versions saved besides (the field's size,
// the steering switches) is dropped on the next save.
const VERSION = 3;
const stored = load<{ sound?: unknown; seatKeys?: unknown }>('cx-prefs', {});

export const prefs = $state({
  v: VERSION,
  sound: typeof stored.sound === 'boolean' ? stored.sound : true,
  seatKeys: Array.isArray(stored.seatKeys) ? (stored.seatKeys as [string, string][]) : DEFAULT_SEAT_KEYS.map((p) => [...p] as [string, string]),
});

setSound(prefs.sound);

export function savePrefs() {
  setSound(prefs.sound);
  save('cx-prefs', $state.snapshot(prefs));
}
