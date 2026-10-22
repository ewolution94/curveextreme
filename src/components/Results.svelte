<script lang="ts">
  // After a game: who won, everyone's points, the XP you got and your level.
  import { online, myId, isHost, stopGame, leaveRoom } from '../lib/online.svelte';
  import { progress, levelOf } from '../lib/progress';
  import { t } from '../lib/i18n.svelte';

  const r = $derived(online.results ?? online.view?.results);
  const names = $derived(new Map((r?.standings ?? []).map((s: any) => [s.id, s.name])));
  const xp = progress().xp;
  const lv = levelOf(xp);
  const title = $derived(
    !r ? t('Game over') : r.type === 'teams' ? (r.winner === null ? t('Game over') : t('Team {n} wins', { n: r.winner + 1 })) : r.winner ? t('{name} wins', { name: String(names.get(r.winner) ?? '?') }) : t('Game over'),
  );
</script>

<main class="results">
  <h1>{title}</h1>
  {#if r}
    <ol class="panel">
      {#each r.standings as s, i (s.id)}
        <li class:me={s.id === myId()}>
          <span class="place num">{i + 1}</span>
          <i style:background={s.colour}></i>
          <span class="name">{s.name}{#if r.type === 'teams'} · {t('Team {n}', { n: s.team + 1 })}{/if}</span>
          <span class="pts num">{s.points}</span>
        </li>
      {/each}
    </ol>
  {/if}
  {#if online.xpGained}
    <div class="xp">
      <strong class="num">{t('+{n} XP', { n: online.xpGained })}</strong>
      <span>{t('Level {n}', { n: lv.level })}</span>
      <span class="bar"><span style:width="{((xp - lv.from) / (lv.to - lv.from)) * 100}%"></span></span>
    </div>
  {/if}
  <div class="actions">
    {#if isHost()}
      <button class="btn primary" type="button" onclick={stopGame}>{t('Back to the room')}</button>
    {:else}
      <p class="muted">{t('Waiting for the host to start.')}</p>
    {/if}
    <button class="btn ghost" type="button" onclick={leaveRoom}>{t('Leave')}</button>
  </div>
</main>

<style>
  .results {
    max-width: 560px;
    margin: 0 auto;
    padding: max(40px, env(safe-area-inset-top)) 16px 32px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  h1 {
    font-size: clamp(24px, 5vw, 36px);
    text-transform: uppercase;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 8px 16px;
  }
  li {
    display: grid;
    grid-template-columns: 2ch 8px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    min-height: 40px;
    border-bottom: 1px solid var(--rule);
  }
  li:last-child {
    border-bottom: 0;
  }
  li.me .name {
    font-weight: 700;
  }
  li i {
    width: 8px;
    height: 24px;
    border-radius: 2px;
  }
  .place {
    color: var(--muted);
  }
  .pts {
    font: 800 20px var(--display);
  }
  .xp {
    display: grid;
    gap: 6px;
  }
  .xp strong {
    font: 800 22px var(--display);
    color: var(--accent);
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
  .actions {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }
  .muted {
    color: var(--muted);
    margin: 0;
  }
</style>
