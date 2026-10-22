<script lang="ts">
  // The curve colours: the ten everyone has and the ones levels unlock (locked ones show their level).
  import { ALL, UNLOCKS } from '../../shared/colours.mjs';
  import { levelOf } from '../lib/progress';
  import { t } from '../lib/i18n.svelte';

  type Props = { value: string; xp: number; taken?: Set<string>; onPick: (hex: string) => void };
  let { value, xp, taken = new Set(), onPick }: Props = $props();
  const level = $derived(levelOf(xp).level);
  const lockedAt = (id: string) => UNLOCKS.find((u) => u.id === id)?.level ?? 0;
</script>

<div class="swatches" role="radiogroup" aria-label={t('Your colour')}>
  {#each ALL as c (c.id)}
    {@const need = lockedAt(c.id)}
    {@const locked = need > level}
    {@const busy = taken.has(c.hex) && c.hex !== value}
    <button
      type="button"
      role="radio"
      aria-checked={c.hex === value}
      aria-label={locked ? `${c.name} · ${t('Unlocked at level {n}', { n: need })}` : c.name}
      title={locked ? t('Unlocked at level {n}', { n: need }) : c.name}
      disabled={locked || busy}
      class:locked
      style:--c={c.hex}
      onclick={() => onPick(c.hex)}
    >
      {#if locked}<span class="lv num">{need}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  button {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 2px solid transparent;
    background: var(--c);
    cursor: pointer;
    padding: 0;
    position: relative;
    box-shadow: inset 0 0 0 2px rgb(0 0 0 / 0.25);
  }
  button[aria-checked='true'] {
    border-color: #fff;
    box-shadow: 0 0 0 2px var(--ground), 0 0 0 4px var(--c);
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.3;
  }
  button.locked {
    opacity: 0.22;
  }
  .lv {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 11px;
    font-weight: 700;
    color: #fff;
  }
</style>
