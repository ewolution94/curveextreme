// Saved feel profiles: what a playtest tuned in a room's Tune panel, kept under a name so the next
// room (or the shared keyboard) can start from it. One JSON file in the data folder, written
// atomically (learnings/node-server.md); the built-in profiles live in shared/feel.mjs.

import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { BUILT_IN, cleanFeel } from '../shared/feel.mjs';

const MAX_SAVED = 40;

export function createProfiles({ dir }) {
  const file = dir ? path.join(dir, 'profiles.json') : null;
  /** @type {Map<string, object>} */
  const saved = new Map();
  if (file) {
    try {
      const data = JSON.parse(readFileSync(file, 'utf8'));
      for (const p of data.saved ?? []) saved.set(p.name, cleanFeel(p));
    } catch {
      /* no file yet */
    }
  }

  function write() {
    if (!file) return;
    mkdirSync(dir, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify({ saved: [...saved.values()] }, null, 2));
    renameSync(tmp, file);
  }

  return {
    list() {
      return { builtIn: Object.values(BUILT_IN), saved: [...saved.values()] };
    },
    get(name) {
      return saved.get(name) ?? Object.values(BUILT_IN).find((p) => p.name === name) ?? null;
    },
    save(feel) {
      const clean = cleanFeel(feel);
      const name = String(feel?.name ?? '').trim().slice(0, 40);
      if (!name || Object.values(BUILT_IN).some((p) => p.name === name)) return null;
      clean.name = name;
      saved.delete(name);
      saved.set(name, clean);
      while (saved.size > MAX_SAVED) saved.delete(saved.keys().next().value);
      write();
      return clean;
    },
    remove(name) {
      if (!saved.delete(name)) return false;
      write();
      return true;
    },
  };
}
