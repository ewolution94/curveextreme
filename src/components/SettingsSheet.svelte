<script lang="ts">
  // This device's settings. The two display switches are the steering pick's (A, B, C): flip them
  // during a playtest and the next frame shows the difference.
  import { prefs, savePrefs } from '../lib/prefs.svelte';
  import { steering } from '../lib/online.svelte';
  import { t } from '../lib/i18n.svelte';

  let { open = $bindable(false) }: { open?: boolean } = $props();
  let dialog: HTMLDialogElement;
  $effect(() => {
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });
  function set<K extends keyof typeof prefs>(key: K, value: (typeof prefs)[K]) {
    prefs[key] = value;
    if (key === 'both') steering.both = value as any;
    savePrefs();
  }
</script>

<dialog class="sheet" bind:this={dialog} onclose={() => (open = false)}>
  <div class="body">
    <h2>{t('Settings')}</h2>
    {@render choice(t('Field size'), 'fieldSize', [['fill', t('Fill the screen')], ['reference', t('Like the original')], ['auto', t('Auto')]])}
    {@render choice(t('Your curve'), 'motion', [['predict', t('Instant (drawn ahead)')], ['server', t('From the server')]])}
    {@render choice(t('Others drawn behind'), 'behind', [[0, t('{n} ticks', { n: 0 })], [1, t('{n} ticks', { n: 1 })], [2, t('{n} ticks', { n: 2 })], [3, t('{n} ticks', { n: 3 })]])}
    {@render choice(t('Both keys held'), 'both', [['last', t('Last pressed wins')], ['straight', t('Drive straight')]])}
    {@render choice(t('Sound'), 'sound', [[true, 'On'], [false, 'Off']])}
    {@render choice(t('Language'), 'lang', [['en', 'English'], ['de', 'Deutsch']])}
    <button class="btn" type="button" onclick={() => (open = false)}>{t('Close')}</button>
  </div>
</dialog>

{#snippet choice(label: string, key: any, options: [any, string][])}
  <div class="choice">
    <span class="label">{label}</span>
    <div class="seg" role="radiogroup" aria-label={label}>
      {#each options as [value, text] (String(value))}
        <button type="button" role="radio" aria-checked={(prefs as any)[key] === value} onclick={() => set(key, value)}>{text}</button>
      {/each}
    </div>
  </div>
{/snippet}

<style>
  .body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
  }
  h2 {
    font-size: 18px;
  }
  .choice {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .seg {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 3px;
    border: 1px solid var(--rule);
    border-radius: 10px;
    background: var(--ground);
  }
  .seg button {
    flex: 1 1 auto;
    min-height: 36px;
    padding: 0 12px;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }
  .seg button[aria-checked='true'] {
    background: var(--panel-2);
    color: var(--ink);
    box-shadow: inset 0 0 0 1px var(--rule);
  }
</style>
