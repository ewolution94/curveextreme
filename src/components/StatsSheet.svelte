<script lang="ts">
  // Your level, what it unlocks next, and your stats: all on this device.
  import { progress, levelOf } from '../lib/progress';
  import { UNLOCKS } from '../../shared/colours.mjs';
  import { t } from '../lib/i18n.svelte';

  let { open = $bindable(false) }: { open?: boolean } = $props();
  let dialog: HTMLDialogElement;
  let p = $state(progress());
  $effect(() => {
    if (open && !dialog.open) {
      p = progress();
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  });
  const lv = $derived(levelOf(p.xp));
  const s = $derived(p.stats);
  const next = $derived(UNLOCKS.filter((u) => u.level > lv.level).slice(0, 3));
  const fmt = (n: number) => Math.round(n).toLocaleString();
</script>

<dialog class="sheet" bind:this={dialog} onclose={() => (open = false)}>
  <div class="body">
    <h2>{t('Level {n}', { n: lv.level })} <span class="xp num">{t('{xp} XP', { xp: fmt(p.xp) })}</span></h2>
    <div class="bar"><span style:width="{((p.xp - lv.from) / (lv.to - lv.from)) * 100}%"></span></div>
    {#if next.length}
      <div class="next">
        {#each next as u (u.id)}
          <span class="unlock"><i style:background={u.hex}></i>{u.name} · {t('Level {n}', { n: u.level })}</span>
        {/each}
      </div>
    {/if}
    <h3 class="label">{t('Stats')}</h3>
    <dl class="stats num">
      <dt>{t('Games')}</dt><dd>{fmt(s.games)}</dd>
      <dt>{t('Wins')}</dt><dd>{fmt(s.wins)}</dd>
      <dt>{t('Points')}</dt><dd>{fmt(s.points)}</dd>
      <dt>{t('Kills')}</dt><dd>{fmt(s.kills)}</dd>
      <dt>{t('Survived rounds')}</dt><dd>{fmt(s.roundsSurvived)} / {fmt(s.rounds)}</dd>
      <dt>{t('Powerups taken')}</dt><dd>{fmt(s.powerups)}</dd>
      <dt>{t('Gaps')}</dt><dd>{fmt(s.gaps)}</dd>
      <dt>{t('Turns left / right')}</dt><dd>{fmt(s.turnsLeft)} / {fmt(s.turnsRight)}</dd>
      <dt>{t('Distance')}</dt><dd>{fmt(s.distance)} u</dd>
      <dt>{t('Longest round')}</dt><dd>{s.longestRound.toFixed(1)} s</dd>
    </dl>
    <button class="btn" type="button" onclick={() => (open = false)}>{t('Close')}</button>
  </div>
</dialog>

<style>
  .body {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 20px;
  }
  h2 {
    font-size: 20px;
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .xp {
    font: 600 14px var(--body);
    color: var(--muted);
  }
  .bar {
    height: 8px;
    border-radius: 4px;
    background: var(--panel-2);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
  }
  .next {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    color: var(--muted);
    font-size: 13px;
  }
  .unlock {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .unlock i {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }
  .stats {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px 16px;
    margin: 0;
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0;
    text-align: right;
    font-weight: 600;
  }
</style>
