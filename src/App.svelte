<script lang="ts">
  // The screens: home, a room (lobby, game, results) or the shared keyboard.
  import { onMount } from 'svelte';
  import { online, start, joinRoom } from './lib/online.svelte';
  import { unlockAudio } from './lib/sound';
  import { loadCensus } from './lib/census';
  import Home from './components/Home.svelte';
  import Lobby from './components/Lobby.svelte';
  import Play from './components/Play.svelte';
  import Results from './components/Results.svelte';
  import Local from './components/Local.svelte';

  let local = $state(false);

  onMount(() => {
    start();
    const code = location.pathname.slice(1).toUpperCase();
    if (/^[A-Z]{4}$/.test(code)) joinRoom(code);
    setTimeout(loadCensus, 600);
    const wake = () => unlockAudio();
    addEventListener('pointerdown', wake);
    addEventListener('keydown', wake);
    return () => {
      removeEventListener('pointerdown', wake);
      removeEventListener('keydown', wake);
    };
  });
</script>

{#if local}
  <Local onExit={() => (local = false)} />
{:else if online.view?.phase === 'playing'}
  <Play />
{:else if online.view?.phase === 'results' || (online.view && online.results)}
  <Results />
{:else if online.view}
  <Lobby />
{:else}
  <Home onLocal={() => (local = true)} />
{/if}
