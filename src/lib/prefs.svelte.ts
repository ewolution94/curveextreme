// This device's settings: sound, the shared keyboard's keys. Kept in localStorage. The language is
// the family's own key (src/lib/i18n.svelte.ts). How your curve and the others are shown isn't a
// setting since 2026-10-23 (the page simulates the round itself, src/lib/runner.ts), nor is the
// field's size since 2026-10-27: it always takes the whole available space (Field.svelte).

import { readConfig } from '../../vendor/ewo/elements/config-client.js';
import { load, save } from './store';
import { soundFor } from './defaults';
import { DEFAULT_SEAT_KEYS } from './input';
import { setSound } from './sound';

// v3 (2026-10-27): only these two are kept; what older versions saved besides (the field's size,
// the steering switches) is dropped on the next save.
const VERSION = 3;
const stored = load<{ sound?: unknown; seatKeys?: unknown }>('cx-prefs', {});

// The sound switch is this device's own choice once it's been used (and kept only then); until
// then Dashboard's default, else on (src/lib/defaults.ts).
let ownSound = typeof stored.sound === 'boolean' ? stored.sound : undefined;

export const prefs = $state({
  v: VERSION,
  sound: soundFor(ownSound, readConfig().sounds),
  seatKeys: Array.isArray(stored.seatKeys) ? (stored.seatKeys as [string, string][]) : DEFAULT_SEAT_KEYS.map((p) => [...p] as [string, string]),
});

setSound(prefs.sound);

export function savePrefs() {
  setSound(prefs.sound);
  const { sound, ...rest } = $state.snapshot(prefs);
  save('cx-prefs', ownSound === undefined ? rest : { ...rest, sound });
}

/** The Sounds switch: this device's own choice from now on. */
export function setSoundChoice(on: boolean) {
  ownSound = on;
  prefs.sound = on;
  savePrefs();
}
