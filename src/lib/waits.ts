// Waiting for the server, at the control that asked (Folio's track(), development/plans/waiting-states.md):
// the tapped button stays pressed and locked until the answer, shows the little curve after 150 ms,
// says what it's doing after 1.2 s, "Taking longer …" after 6 s, and offers "Try again" at 12 s.
// The room's answers come over the socket (src/lib/online.svelte.ts turns them into promises).

import { track } from '../../vendor/ewo/elements/waiting.js';

/** The control behind an event: the clicked button, or a form's submit button. */
export function controlOf(from: Event | Element | null | undefined): Element | null {
  if (!from) return null;
  if (from instanceof Element) return from;
  if (from instanceof SubmitEvent && from.submitter) return from.submitter;
  return from.currentTarget instanceof Element ? from.currentTarget : null;
}

/** Any wait at a control: `run` gets the signal that track() aborts at 12 s. */
export function waitAt<T>(from: Event | Element | null | undefined, run: (signal: AbortSignal) => Promise<T>, words?: string) {
  return track(controlOf(from), run, { label: words });
}
