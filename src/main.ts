// Look A's one face, Archivo, with its width axis: wide for the name and the numbers, normal for the rest.
import '@fontsource-variable/archivo/wdth.css';
import './app.css';
// Folio's shared elements (vendor/ewo); each defines itself once.
import '../vendor/ewo/elements/settings-button.js';
import '../vendor/ewo/elements/sheet.js';
import '../vendor/ewo/elements/guide.js';
import '../vendor/ewo/elements/segmented.js';
import '../vendor/ewo/elements/switch.js';
import '../vendor/ewo/elements/emblem.js';
import '../vendor/ewo/elements/emblem-maker.js';
import '../vendor/ewo/elements/connection.js';
import { mount } from 'svelte';
import App from './App.svelte';
// Every tap answers on a phone, the games' lively way (Folio's pressFeedback, plans/mobile-touch.md).
import { pressFeedback } from '../vendor/ewo/elements/press.js';
// A wait for the server shows at the control that asked (Folio's track() via src/lib/waits.ts):
// CurveExtreme's working mark is a little curve with its head.
import { configureWaiting } from '../vendor/ewo/elements/waiting.js';

pressFeedback({ preset: 'lively' });
configureWaiting({
  mark: '<svg class="curvemark" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 15 C3 8 7 4 12 4" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="15.5" cy="5.5" r="2.2" fill="currentColor"/></svg>',
});

function start() {
  mount(App, { target: document.getElementById('app')! });
  requestAnimationFrame(() => dispatchEvent(new Event('splash:ready')));
}

// Installed, the app opens on the splash screen (index.html, switched on by public/boot.js; written by
// development/plans/splash-rollout). The splash has to be on screen before the first render takes the
// main thread, so the mount waits a frame while it shows.
if (document.documentElement.classList.contains('splash')) {
  let started = false;
  const once = () => {
    if (started) return;
    started = true;
    start();
  };
  requestAnimationFrame(() => setTimeout(once));
  setTimeout(once, 100);
} else {
  start();
}

/** The offline shell (public/sw.js). Production only: a worker would cache what Vite hot-replaces. */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
