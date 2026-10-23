<!--
  After a game, the family's way (Würfle's Final.svelte): the winner's seal, who won and with how many
  points, everyone's points with their seals and colours, the XP you got and your level. Then the
  host takes everyone back to the room.
-->
<script lang="ts">
  import { online, myId, isHost, stopGame, leaveRoom } from '../lib/online.svelte';
  import { progress, levelOf } from '../lib/progress';
  import { t } from '../lib/i18n.svelte';
  import { waitAt } from '../lib/waits';
  import Avatar from './Avatar.svelte';

  const r = $derived(online.results ?? online.view?.results);
  const members = $derived(new Map((online.view?.members ?? []).map((m) => [m.id, m])));
  const avatarOf = (s: any) => s.avatar ?? members.get(s.id)?.avatar ?? null;
  const nameOf = (s: any) => (s.id === myId() ? t('You') : s.name);
  const hostName = $derived(online.view?.members.find((m) => m.id === online.view?.host)?.name ?? '');
  const winners = $derived.by(() => {
    if (!r || r.winner === null || r.winner === undefined) return [];
    return r.type === 'teams' ? r.standings.filter((s: any) => s.team === r.winner) : r.standings.filter((s: any) => s.id === r.winner);
  });
  const title = $derived.by(() => {
    if (!r || !winners.length) return t('Game over');
    if (r.type === 'teams') return t('Team {n} wins', { n: r.winner + 1 });
    return r.winner === myId() ? t('You win!') : t('{name} wins', { name: winners[0].name });
  });
  const top = $derived(r?.type === 'teams' ? null : (winners[0]?.points ?? null));
  const xp = progress().xp;
  const lv = levelOf(xp);
  let error = $state('');

  async function back(event: Event) {
    error = '';
    try {
      await waitAt(event, (signal) => stopGame(signal), t('Back to the room …'));
    } catch {
      error = t('That didn’t work. Try again.');
    }
  }
</script>

<div class="final">
  <section class="sheet head">
    {#if winners.length}
      <div class="crown">
        {#each winners as w (w.id)}
          {@const a = avatarOf(w)}
          {#if a}<Avatar avatar={a} size={64} />{/if}
        {/each}
      </div>
    {/if}
    <h1 class="display">{title}</h1>
    {#if top !== null}<p class="points">{t('with {n} points', { n: top })}</p>{/if}

    {#if r}
      <ol class="standings">
        {#each r.standings as s, i (s.id)}
          {@const a = avatarOf(s)}
          <li class:me={s.id === myId()}>
            <span class="place num">{i + 1}</span>
            {#if a}<Avatar avatar={a} size={26} ring={false} />{/if}
            <i class="swatch" style:background={s.colour}></i>
            <span class="name">{nameOf(s)}{#if r.type === 'teams'}<small> · {t('Team {n}', { n: s.team + 1 })}</small>{/if}</span>
            <b class="pts num">{s.points}</b>
          </li>
        {/each}
      </ol>
    {/if}
  </section>

  {#if online.xpGained}
    <section class="sheet xp">
      <strong class="num">{t('+{n} XP', { n: online.xpGained })}</strong>
      <span class="lv">{t('Level {n}', { n: lv.level })}</span>
      <span class="meter"><span style:width="{((xp - lv.from) / (lv.to - lv.from)) * 100}%"></span></span>
    </section>
  {/if}

  <div class="actions">
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    {#if isHost()}
      <button class="btn primary block big" type="button" onclick={back}>{t('Back to the room')}</button>
    {:else}
      <p class="hint center">{t('{name} takes everyone back to the room.', { name: hostName })}</p>
    {/if}
    <button class="btn quiet" type="button" onclick={leaveRoom}>{t('Leave the room')}</button>
  </div>
</div>

<style>
  .final {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 520px;
    margin: 18px auto 0;
  }
  .head {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 26px 18px 14px;
    text-align: center;
  }
  .crown {
    display: flex;
    gap: 10px;
  }
  h1 {
    font-size: clamp(26px, 6vw, 34px);
    line-height: 1.1;
  }
  .points {
    margin: 0;
    color: var(--muted);
  }
  .standings {
    align-self: stretch;
    margin: 10px 0 0;
    padding: 0;
    list-style: none;
    text-align: left;
  }
  li {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    border-top: 1px solid var(--rule);
  }
  .place {
    width: 2ch;
    color: var(--muted);
    font-weight: 600;
    text-align: right;
  }
  .swatch {
    flex: none;
    width: 18px;
    height: 5px;
    border-radius: 3px;
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }
  .name small {
    color: var(--muted);
    font-weight: 500;
  }
  li.me .name {
    color: var(--accent);
  }
  .pts {
    font: 800 20px/1 var(--display);
    font-stretch: 125%;
  }
  .xp {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 8px 12px;
    align-items: baseline;
    padding: 16px 18px;
  }
  .xp strong {
    font: 800 22px/1 var(--display);
    font-stretch: 118%;
    color: var(--accent);
  }
  .lv {
    color: var(--ink-2);
    font-weight: 600;
  }
  .meter {
    grid-column: 1 / -1;
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
  .actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .big {
    min-height: 54px;
    font-size: 17px;
  }
  .center {
    text-align: center;
  }
</style>
