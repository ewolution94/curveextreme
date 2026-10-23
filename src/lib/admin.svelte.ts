// The admin switch (the user, 2026-10-23: "not everybody messes around with" the engine's numbers).
// Typing the admin code in Settings makes this device the admin's: the Tune panel in a game and the
// feel in the room (every number of the engine) show only then. It's a door, not a lock: no
// password, nothing on the server, and the code is kept here only as a hash so it doesn't read in
// the page's source. Turning it off in Settings hides them again.

import { load, save } from './store';

const KEY = 'cx-admin';
const CODE_HASH = '6c67ebab'; // FNV-1a of the code, lower case, trimmed

function fnv(text: string) {
  let h = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) h = Math.imul(h ^ byte, 0x01000193);
  return (h >>> 0).toString(16);
}

export const admin = $state({ on: load<boolean>(KEY, false) === true });

/** True if the code was right: this device is the admin's from now on. */
export function unlock(code: string) {
  if (fnv(code.trim().toLowerCase()) !== CODE_HASH) return false;
  admin.on = true;
  save(KEY, true);
  return true;
}

export function lock() {
  admin.on = false;
  save(KEY, false);
}
