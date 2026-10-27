import type { Avatar } from './avatar';
import { playerEmblem, shareEmblem, sharedName, shareName } from '../../vendor/ewo/elements/emblem-shared.js';

// localStorage that never throws (a private window, blocked storage): reads fall back, writes are
// best effort. Everything CurveExtreme keeps lives on the device; the name and the avatar also go to
// Folio's shared cookie, so they follow you to the other ewolution games (development/plans/emblems.md).

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const value = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) && fallback && typeof fallback === 'object' && !Array.isArray(fallback)
      ? { ...fallback, ...value }
      : (value as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage off */
  }
}

const hex = (n: number) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');

/** The name fields' maxlength: a name from another game may be longer. */
const NAME_MAX = 20;

/** This device's player: an id and a secret for the server, a name, a colour and an avatar (the name and the avatar as shared by the other games, when they are). */
export function identity(): { id: string; secret: string; name: string; colour: string; avatar: Avatar } {
  const me = load<{ id: string; secret: string; name: string; colour: string; avatar: Avatar | null }>('cx-me', { id: '', secret: '', name: '', colour: '', avatar: null });
  let changed = false;
  if (!me.id || !me.secret) {
    me.id = `p-${hex(8)}`;
    me.secret = `s-${hex(16)}`;
    changed = true;
  }
  const avatar = playerEmblem('token', me.avatar) as Avatar;
  const name = (sharedName() || me.name).slice(0, NAME_MAX);
  if (String(avatar) !== String(me.avatar) || name !== me.name) {
    me.avatar = avatar;
    me.name = name;
    changed = true;
  }
  if (changed) save('cx-me', me);
  return me as { id: string; secret: string; name: string; colour: string; avatar: Avatar };
}

// The rooms this device was in lately: coming back to one's link (a reload, a drop) goes straight
// back in; any other room's link asks who you are first (Join.svelte).
const ROOMS = 'cx-rooms';
const ROOM_HOURS = 12;

export function knowsRoom(code: string) {
  const rooms = load<Record<string, number>>(ROOMS, {});
  return Date.now() - (rooms[code] ?? 0) < ROOM_HOURS * 3600_000;
}

export function rememberRoom(code: string) {
  const rooms = load<Record<string, number>>(ROOMS, {});
  rooms[code] = Date.now();
  const recent = Object.entries(rooms)
    .filter(([, at]) => Date.now() - at < ROOM_HOURS * 3600_000)
    .slice(-10);
  save(ROOMS, Object.fromEntries(recent));
}

export function forgetRoom(code: string) {
  const rooms = load<Record<string, number>>(ROOMS, {});
  delete rooms[code];
  save(ROOMS, rooms);
}

export function saveIdentity(patch: Partial<{ name: string; colour: string; avatar: Avatar }>) {
  const me = identity();
  save('cx-me', { ...me, ...patch });
  if (patch.name !== undefined) shareName(patch.name);
  // Joining sends the avatar it already has; only one picked in the maker is new, and shared.
  if (patch.avatar && String(patch.avatar) !== String(me.avatar)) shareEmblem('token', patch.avatar);
}
