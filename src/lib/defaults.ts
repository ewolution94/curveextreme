// The order a family setting is decided in (Dashboard, plans/dashboard.md in the workspace): this
// device's own choice, then Dashboard's default (the family's, or one set for CurveExtreme alone),
// then the built-in one, which is today's. public/boot.js does the same for the language before
// first paint. No Svelte and no DOM here, so the tests load it as it is.

export type Lang = 'en' | 'de';

/** The language to show: this device's choice, else Dashboard's, else the browser's (`detected`). */
export const languageFor = (own: Lang | 'system', dashboard: unknown, detected: Lang): Lang =>
  own !== 'system' ? own : dashboard === 'de' || dashboard === 'en' ? dashboard : detected;

/** Sounds on or off: this device's switch once used, else Dashboard's, else on (CurveExtreme's own). */
export const soundFor = (own: unknown, dashboard: unknown): boolean =>
  typeof own === 'boolean' ? own : typeof dashboard === 'boolean' ? dashboard : true;
