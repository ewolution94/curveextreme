import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
// What CurveExtreme hands Dashboard (public/ewo.config.json), checked with Folio's own rules, and the
// order a setting is decided in: this device's own choice, then Dashboard's default, then the
// built-in one (src/lib/defaults.ts, and public/boot.js before first paint).
import { checkManifest, resolve } from '../vendor/ewo/elements/config-core.js';
import { languageFor, soundFor } from '../src/lib/defaults.ts';

const manifest = JSON.parse(readFileSync(new URL('../public/ewo.config.json', import.meta.url), 'utf8'));

test('the manifest is one Dashboard takes: the family’s language and sounds (dark only: no theme)', () => {
  const { ok, problems, manifest: checked } = checkManifest(manifest);
  assert.deepEqual(problems, []);
  assert.ok(ok);
  assert.equal(checked.app, 'curveextreme');
  assert.deepEqual(Object.keys(checked.settings), ['lang', 'sounds']);
});

test('with nothing set in Dashboard: the browser’s language and sounds on, the page as it ships', () => {
  const { values, sources } = resolve(manifest, {});
  assert.deepEqual(values, { lang: 'system', sounds: true });
  assert.deepEqual(sources, { lang: 'built-in', sounds: 'own' });
  assert.equal(languageFor('system', values.lang, 'de'), 'de');
  assert.equal(languageFor('system', values.lang, 'en'), 'en');
  assert.equal(soundFor(undefined, values.sounds), true);
  // No #ewo-config at all (offline, Dashboard off): the same.
  assert.equal(languageFor('system', undefined, 'de'), 'de');
  assert.equal(soundFor(undefined, undefined), true);
});

test('Dashboard’s family language and this app’s own values reach the page; the family’s sounds don’t', () => {
  assert.deepEqual(resolve(manifest, { family: { lang: 'en', sounds: false } }).values, { lang: 'en', sounds: true });
  assert.deepEqual(resolve(manifest, { family: { lang: 'en' }, app: { lang: 'de', sounds: false } }).values, { lang: 'de', sounds: false });
});

test('the device’s own choice beats Dashboard’s default, which beats the built-in one', () => {
  // QA's `ewo:lang` = `en` is this device's own choice, so it keeps winning.
  assert.equal(languageFor('en', 'de', 'de'), 'en');
  assert.equal(languageFor('system', 'en', 'de'), 'en');
  assert.equal(languageFor('system', 'system', 'de'), 'de');
  assert.equal(languageFor('system', 'fr', 'de'), 'de');
  assert.equal(soundFor(true, false), true);
  assert.equal(soundFor(false, true), false);
  assert.equal(soundFor(undefined, false), false);
  assert.equal(soundFor(undefined, 'off'), true);
});

/** public/boot.js against a stub page: the language it applies before first paint. */
function boot({ stored = {}, config, languages = ['de-DE'] }) {
  const root = { dataset: {}, lang: 'en', classList: { add() {}, remove() {} }, style: { setProperty() {} } };
  const document = {
    documentElement: root,
    getElementById: (id) => (id === 'ewo-config' && config ? { textContent: JSON.stringify(config) } : null),
    addEventListener() {},
  };
  const localStorage = { getItem: (key) => stored[key] ?? null };
  vm.runInNewContext(readFileSync(new URL('../public/boot.js', import.meta.url), 'utf8'), {
    document,
    localStorage,
    matchMedia: () => ({ matches: false }),
    navigator: { languages, language: languages[0] },
    location: { search: '' },
    screen: {},
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener() {},
    setTimeout() {},
  });
  return root.lang;
}

test('before first paint: the saved language, else Dashboard’s, else the browser’s', () => {
  assert.equal(boot({}), 'de');
  assert.equal(boot({ languages: ['fr-FR', 'en-GB'] }), 'en');
  assert.equal(boot({ config: { lang: 'system', sounds: true } }), 'de');
  assert.equal(boot({ config: { lang: 'en' } }), 'en');
  assert.equal(boot({ stored: { 'ewo:lang': 'system' }, config: { lang: 'en' } }), 'en');
  assert.equal(boot({ stored: { 'ewo:lang': 'de' }, config: { lang: 'en' } }), 'de');
  assert.equal(boot({ stored: { 'ewo:lang': 'en' }, config: { lang: 'de' }, languages: ['de-DE'] }), 'en');
  // The app's own key from before 2026-10-23 is a choice too.
  assert.equal(boot({ stored: { 'cx-prefs': JSON.stringify({ lang: 'de' }) }, config: { lang: 'en' } }), 'de');
});
