// localStorage that never throws (a private window, blocked storage): reads fall back, writes are
// best effort. Everything CurveExtreme keeps lives on the device.

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

/** This device's player: an id and a secret for the server, a name and a colour. */
export function identity(): { id: string; secret: string; name: string; colour: string } {
  const me = load('cx-me', { id: '', secret: '', name: '', colour: '' });
  if (!me.id || !me.secret) {
    me.id = `p-${hex(8)}`;
    me.secret = `s-${hex(16)}`;
    save('cx-me', me);
  }
  return me;
}

export function saveIdentity(patch: Partial<{ name: string; colour: string }>) {
  const me = identity();
  save('cx-me', { ...me, ...patch });
}
