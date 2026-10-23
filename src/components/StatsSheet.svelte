<!--
  Your level, what it unlocks next, and your stats: all on this device. Folio's ewo-sheet, like
  Settings.
-->
<script lang="ts">
  import { progress, levelOf } from '../lib/progress';
  import { UNLOCKS } from '../../shared/colours.mjs';
  import { t } from '../lib/i18n.svelte';

  let { open = $bindable(false) }: { open?: boolean } = $props();
  let p = $state(progress());
  let shown = $state(false);
  $effect(() => {
    if (open) {
      p = progress();
      shown = true;
    }
  });
  const lv = $derived(levelOf(p.xp));
  const s = $derived(p.stats);
  const next = $derived(UNLOCKS.filter((u) => u.level > lv.level).slice(0, 3));
  const fmt = (n: number) => Math.round(n).toLocaleString();
</script>

<ewo-sheet {open} label={t('Your stats')} oncancel={() => (open = false)} onclose={() => ((shown = false), (open = false))}>
  <span slot="heading">{t('Level {n}', { n: lv.level })}</span>
  {#if shown}
    <div class="body">
      <p class="xp num">{t('{xp} XP', { xp: fmt(p.xp) })} · {t('{n} XP to level {next}', { n: fmt(lv.to - p.xp), next: lv.level + 1 })}</p>
      <div class="meter"><span style:width="{((p.xp - lv.from) / (lv.to - lv.from)) * 100}%"></span></div>
      {#if next.length}
        <h3 class="label">{t('Coming up')}</h3>
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
    </div>
  {/if}
</ewo-sheet>

<style>
  .body {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-bottom: 8px;
  }
  .xp {
    margin: 0;
    font-size: 14px;
    color: var(--muted);
  }
  h3 {
    margin: 6px 0 0;
  }
  .meter {
    height: 8px;
    border-radius: 4px;
    background: var(--panel-2);
    overflow: hidden;
  }
  .meter span {
    display: block;
    height: 100%;
    background: var(--accent);
  }
  .next {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    color: var(--ink-2);
    font-size: 14px;
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
    gap: 0;
    margin: 0;
  }
  dt,
  dd {
    padding: 9px 0;
    border-bottom: 1px solid var(--rule);
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
