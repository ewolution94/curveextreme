<script lang="ts">
  // The screens, in the family's frame (Würfle's App.svelte): the band on top and the footer below,
  // except in a game, where the arena has the screen to itself. "/" is the start; "/KXPT" a room and
  // the link people share: a room this device was in lately is taken again at once, any other asks
  // who you are first (Join). The shared keyboard lives in the page.
  import { onMount } from 'svelte';
  import { online, joinRoom, leaveRoom } from './lib/online.svelte';
  import { knowsRoom } from './lib/store';
  import { unlockAudio } from './lib/sound';
  import { loadCensus } from './lib/census';
  import Bar from './components/Bar.svelte';
  import Footer from './components/Footer.svelte';
  import Guide from './components/Guide.svelte';
  import Home from './components/Home.svelte';
  import Join from './components/Join.svelte';
  import Lobby from './components/Lobby.svelte';
  import Play from './components/Play.svelte';
  import Results from './components/Results.svelte';
  import Local from './components/Local.svelte';

  const CODE = /^[A-Z]{4}$/;
  let path = $state(location.pathname);
  let local = $state(false);
  let localPlaying = $state(false);
  /** Taking a known room again: nothing shows until its view is here. */
  let reclaiming = $state(false);

  const code = $derived(codeFrom(path));
  const phase = $derived(online.view?.phase ?? null);
  const fullscreen = $derived((!local && phase === 'playing') || (local && localPlaying));

  function codeFrom(p: string) {
    const segment = p.replace(/^\/+|\/+$/g, '').toUpperCase();
    return CODE.test(segment) ? segment : null;
  }

  function go(to: string, replace = false) {
    if (location.pathname !== to) history[replace ? 'replaceState' : 'pushState'](null, '', to);
    path = to;
    scrollTo(0, 0);
  }

  function home() {
    if (online.view) leaveRoom();
    local = false;
    go('/');
  }

  async function reclaim(c: string) {
    reclaiming = true;
    const ready = new AbortController();
    const timer = setTimeout(() => ready.abort(), 15_000);
    try {
      await joinRoom(c, ready.signal);
    } catch {
      // Join.svelte shows what's wrong (a room that's gone says so).
    } finally {
      clearTimeout(timer);
      reclaiming = false;
    }
  }

  // Out of a room for good (kicked, the room gone, opened in a newer tab): back to the start, which
  // says why.
  $effect(() => {
    if (!online.view && code && ['kicked', 'no-room', 'elsewhere'].includes(online.error)) go('/', true);
  });

  // The room's own link stays in the address bar (online.svelte.ts writes it); the path follows.
  $effect(() => {
    const c = online.view?.code;
    if (c && path !== `/${c}`) path = `/${c}`;
  });

  onMount(() => {
    if (!code && path !== '/') go('/', true);
    if (code && knowsRoom(code)) void reclaim(code);
    const onPop = () => {
      path = location.pathname;
      if (online.view && codeFrom(path) !== online.view.code) leaveRoom();
    };
    addEventListener('popstate', onPop);
    setTimeout(loadCensus, 600);
    const wake = () => unlockAudio();
    addEventListener('pointerdown', wake);
    addEventListener('keydown', wake);
    return () => {
      removeEventListener('popstate', onPop);
      removeEventListener('pointerdown', wake);
      removeEventListener('keydown', wake);
    };
  });
</script>

{#if !fullscreen}<Bar code={online.view?.code ?? null} onhome={home} />{/if}

<main class:playing={fullscreen}>
  {#if local}
    <Local onExit={() => (local = false)} bind:playing={localPlaying} />
  {:else if phase === 'playing'}
    <Play />
  {:else if phase === 'results' || (online.view && online.results)}
    <Results />
  {:else if online.view}
    <Lobby />
  {:else if code}
    {#if !reclaiming}
      <Join {code} onback={() => go('/')} />
    {/if}
  {:else}
    <Home onjoin={(c) => go(`/${c}`)} onlocal={() => (local = true)} />
  {/if}
</main>

{#if !fullscreen}<Footer />{/if}

<!-- How to play, opened from anywhere (src/lib/ui.svelte.ts). -->
<Guide />

{#if online.view || reclaiming}
  <ewo-connection class="connection" class:in-game={fullscreen} state={reclaiming ? 'connecting' : online.conn}></ewo-connection>
{/if}

<style>
  /* The connection pill (Folio's <ewo-connection>): under the band, or at the top of the arena. */
  .connection {
    --ewo-connection-top: calc(env(safe-area-inset-top, 0px) + var(--bar-h) + 8px);
    --ewo-connection-bg: var(--ink);
    --ewo-connection-fg: var(--ground);
    --ewo-connection-font: var(--ewo-sans);
  }
  .connection.in-game {
    --ewo-connection-top: calc(env(safe-area-inset-top, 0px) + 12px);
  }
  main {
    position: relative;
    z-index: 1;
    max-width: var(--page);
    min-height: calc(100dvh - var(--bar-h) - 120px);
    margin: 0 auto;
    padding: 8px var(--gutter) 48px;
  }
  main.playing {
    max-width: none;
    min-height: 0;
    padding: 0;
  }

  /* In the browser (not installed), Safari's toolbar floats over the bottom of the page. */
  @media not (display-mode: standalone) {
    @supports (-webkit-touch-callout: none) {
      main:not(.playing) {
        padding-bottom: 96px;
      }
    }
  }
</style>
