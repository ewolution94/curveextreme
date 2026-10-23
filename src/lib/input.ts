// Steering: two keys (or the two halves of a touch screen) become a direction (-1 left, 0, 1 right)
// and, for Corner, single presses. Both held: the one pressed last. One Steering per player: the
// room's one, or each seat of the shared keyboard. It calls back on every press and release; the
// caller sends only what changes (src/lib/online.svelte.ts).

export class Steering {
  private held: number[] = []; // sides held, oldest first
  constructor(private onChange: (dir: number, press: number) => void) {}

  dir() {
    const L = this.held.includes(-1), R = this.held.includes(1);
    if (L && R) return this.held[this.held.length - 1];
    return L ? -1 : R ? 1 : 0;
  }

  press(side: number) {
    if (this.held.includes(side)) return;
    this.held.push(side);
    this.onChange(this.dir(), side);
  }

  release(side: number) {
    const i = this.held.indexOf(side);
    if (i < 0) return;
    this.held.splice(i, 1);
    this.onChange(this.dir(), 0);
  }

  releaseAll() {
    for (const side of [...this.held]) this.release(side);
  }
}

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  if (!el?.tagName) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
};

/** Keys to steerings: code → [steering, side]. Returns the unbind. */
export function bindKeys(keys: Map<string, [Steering, number]>) {
  const down = (e: KeyboardEvent) => {
    if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    const hit = keys.get(e.code);
    if (!hit) return;
    e.preventDefault();
    if (!e.repeat) hit[0].press(hit[1]);
  };
  const up = (e: KeyboardEvent) => {
    const hit = keys.get(e.code);
    if (hit) hit[0].release(hit[1]);
  };
  const blur = () => {
    for (const [s] of keys.values()) s.releaseAll();
  };
  addEventListener('keydown', down);
  addEventListener('keyup', up);
  addEventListener('blur', blur);
  return () => {
    removeEventListener('keydown', down);
    removeEventListener('keyup', up);
    removeEventListener('blur', blur);
    blur();
  };
}

/** The screen's two halves steer one player (phones). Returns the unbind. */
export function bindTouch(el: HTMLElement, steering: Steering) {
  const touches = new Map<number, number>();
  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    const side = e.clientX < window.innerWidth / 2 ? -1 : 1;
    touches.set(e.pointerId, side);
    try { el.setPointerCapture(e.pointerId); } catch { /* gone */ }
    steering.press(side);
    e.preventDefault();
  };
  const lift = (e: PointerEvent) => {
    const side = touches.get(e.pointerId);
    if (side === undefined) return;
    touches.delete(e.pointerId);
    if (![...touches.values()].includes(side)) steering.release(side);
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', lift);
  el.addEventListener('pointercancel', lift);
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointerup', lift);
    el.removeEventListener('pointercancel', lift);
    steering.releaseAll();
  };
}

/** The shared keyboard's default pairs, spread over the keyboard. */
export const DEFAULT_SEAT_KEYS: [string, string][] = [
  ['ArrowLeft', 'ArrowRight'],
  ['KeyA', 'KeyD'],
  ['KeyB', 'KeyN'],
  ['Numpad4', 'Numpad6'],
];

export function keyLabel(code: string) {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return ({ ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Space', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'L-Alt', AltRight: 'R-Alt', Comma: ',', Period: '.', Slash: '/', Minus: '-', Equal: '=' } as Record<string, string>)[code] ?? code;
}
