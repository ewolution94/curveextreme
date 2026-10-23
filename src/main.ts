// Look A's one face, Archivo, with its width axis: wide for the name and the numbers, normal for the rest.
import '@fontsource-variable/archivo/wdth.css';
import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';

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
