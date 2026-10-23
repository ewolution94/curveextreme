<!--
  The arena, the host's pick (shared/arenas.mjs): the floor's shape, each chip with a small drawing
  of it, the size, and two switches for what stands on it: pillars, ice and mud. Read-only for the
  others. Used by the room and the shared keyboard; a change applies from the next round.
-->
<script lang="ts">
  import { SHAPES, SIZES } from '../../shared/arenas.mjs';
  import { t } from '../lib/i18n.svelte';

  type Arena = { shape: string; size: string; pillars: boolean; patches: boolean };
  let { arena, editable = true, onchange }: { arena: Arena; editable?: boolean; onchange: (patch: Partial<Arena>) => void } = $props();

  const NAMES: Record<string, string> = { square: 'Square', circle: 'Circle', hexagon: 'Hexagon', ring: 'Ring', cross: 'Cross' };
  const SIZE_NAMES: Record<string, string> = { small: 'Small', normal: 'Normal', large: 'Large' };
  const things = $derived([arena.pillars && t('Pillars'), arena.patches && t('Ice and mud')].filter(Boolean).join(' · '));
</script>

{#snippet icon(shape: string)}
  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
    {#if shape === 'square'}<rect x="4" y="4" width="16" height="16" />
    {:else if shape === 'circle'}<circle cx="12" cy="12" r="8.5" />
    {:else if shape === 'hexagon'}<path d="M21 12 16.5 19.8h-9L3 12l4.5-7.8h9Z" />
    {:else if shape === 'ring'}<circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2.6" />
    {:else}<path d="M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6Z" />{/if}
  </svg>
{/snippet}

<div class="arena">
  {#if editable}
    <div class="shapes" role="radiogroup" aria-label={t('Shape')}>
      {#each SHAPES as shape (shape)}
        <button class="chip" type="button" role="radio" aria-checked={arena.shape === shape} onclick={() => onchange({ shape })}>
          {@render icon(shape)}{t(NAMES[shape])}
        </button>
      {/each}
    </div>
    <ewo-segmented stretch value={arena.size} label={t('Size')} onchange={(e) => onchange({ size: e.detail.value })}>
      {#each Object.keys(SIZES) as size (size)}<option value={size}>{t(SIZE_NAMES[size])}</option>{/each}
    </ewo-segmented>
    <div class="row">
      <span class="name">{t('Pillars')}<small>{t('Round and square, nothing gets through.')}</small></span>
      <ewo-switch checked={arena.pillars} aria-label={t('Pillars')} onchange={(e) => onchange({ pillars: e.detail.checked })}></ewo-switch>
    </div>
    <div class="row">
      <span class="name">{t('Ice and mud')}<small>{t('On ice a turn is wider, in mud you’re slower.')}</small></span>
      <ewo-switch checked={arena.patches} aria-label={t('Ice and mud')} onchange={(e) => onchange({ patches: e.detail.checked })}></ewo-switch>
    </div>
  {:else}
    <b class="value">{@render icon(arena.shape)}{t(NAMES[arena.shape] ?? 'Square')} · {t(SIZE_NAMES[arena.size] ?? 'Normal')}</b>
    {#if things}<span class="hint">{things}</span>{/if}
  {/if}
</div>

<style>
  .arena {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .shapes {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    gap: 7px;
    padding: 0 12px 0 9px;
  }
  .icon {
    width: 18px;
    height: 18px;
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linejoin: round;
  }
  .chip[aria-checked='true'] .icon {
    stroke: var(--accent);
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .name {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 15px;
  }
  .name small {
    font-size: 12.5px;
    color: var(--muted);
  }
  .value {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font: 800 18px/1.2 var(--display);
    font-stretch: 118%;
  }
  .hint {
    font-size: 13px;
    color: var(--muted);
  }
</style>
