<!--
  The band across the top, the family's (Würfle's Bar.svelte) in look A: the name (home, which leaves
  a room), the room's code in a room, and Settings. Not in a game: the arena has the screen to itself.
-->
<script lang="ts">
  import { t } from '../lib/i18n.svelte';
  import Settings from './Settings.svelte';
  import Wordmark from './Wordmark.svelte';

  let { code = null, onhome }: { code?: string | null; onhome: () => void } = $props();

  let settingsOpen = $state(false);
  let button: HTMLElement | undefined = $state();

  function closeSettings() {
    settingsOpen = false;
    // Focus goes back where it came from.
    button?.focus();
  }
</script>

<header class="bar">
  <a
    class="home"
    href="/"
    aria-label="CurveExtreme"
    onclick={(e) => {
      e.preventDefault();
      onhome();
    }}><Wordmark size="small" /></a
  >
  <div class="end">
    {#if code}
      <span class="code" aria-label="{t('Room code')} {code}">{code}</span>
    {/if}
    <!-- A real <button> sits inside the element: Enter and Space reach this handler as a click. -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <ewo-settings-button bind:this={button} onclick={() => (settingsOpen = true)}></ewo-settings-button>
  </div>
</header>

<Settings open={settingsOpen} onclose={closeSettings} />

<style>
  .bar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: var(--bar-h);
    padding: env(safe-area-inset-top, 0px) var(--gutter) 0;
    background: var(--panel);
    border-bottom: 1px solid var(--line);
    color: var(--ink);
  }
  .home {
    display: flex;
    text-decoration: none;
  }
  .end {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .code {
    padding: 6px 10px 5px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--ground);
    font: 800 15px/1 var(--display);
    font-stretch: 125%;
    letter-spacing: 0.16em;
  }
</style>
