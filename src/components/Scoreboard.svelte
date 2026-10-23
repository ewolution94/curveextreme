<script lang="ts">
  // Look A's board beside the field: the target (an outlined number, "2 points clear"), then everyone
  // by points: a little curve in their colour, the name, a "+n" ring that pops when they score, the
  // points in wide Archivo, and a thin bar towards the target. Dimmed once they crashed this round. In
  // teams, each team's round wins head its players.
  import type { Snippet } from 'svelte';
  import type { World } from '../lib/world';
  import { t } from '../lib/i18n.svelte';
  import Avatar from './Avatar.svelte';

  type Player = { id: string; name: string; colour: string; team: number; avatar?: number[] | null };
  type Props = { world: World; players: Player[]; me: string | null; version: number; children?: Snippet };
  let { world, players, me, version, children }: Props = $props();

  let chips = $state<Record<string, { n: number; at: number }>>({});
  let seen: Record<string, number> = {};

  // a "+n" when someone scores (n adds up while the ring still shows)
  $effect(() => {
    void version;
    const pts = world.points;
    const now = performance.now();
    for (const p of players) {
      const v = pts[p.id] ?? 0;
      const before = seen[p.id] ?? v;
      if (v > before) {
        const prev = chips[p.id];
        chips[p.id] = { n: v - before + (prev && now - prev.at < 3200 ? prev.n : 0), at: now };
      }
      seen[p.id] = v;
    }
  });

  const info = $derived.by(() => {
    void version;
    return { type: world.type, target: world.target, teamTarget: world.teamTarget, phase: world.phase };
  });

  const rows = $derived.by(() => {
    void version;
    const pts = world.points;
    return players
      .map((p) => ({
        ...p,
        points: pts[p.id] ?? 0,
        alive: [...world.curves.values()].some((c) => c.pid === p.id && c.alive),
      }))
      .sort((a, b) => b.points - a.points);
  });

  const teams = $derived.by(() => {
    void version;
    if (world.type !== 'teams') return [];
    const ids = [...new Set(players.map((p) => p.team))].sort();
    return ids.map((team) => ({ team, wins: world.teamWins[team] ?? 0, members: rows.filter((r) => r.team === team) }));
  });
</script>

<aside class="board" aria-label={t('Players')}>
  <div class="target">
    <small>{info.type === 'teams' ? t('First team to') : t('First to')}</small>
    <b class="num">{info.type === 'teams' ? info.teamTarget : info.target}</b>
    <small>{info.type === 'teams' ? t('rounds') : t('2 points clear')}</small>
  </div>
  <ol class="rows">
    {#if info.type === 'teams'}
      {#each teams as tm (tm.team)}
        <li class="row team" style:--c="var(--ink)">
          <span class="nm">{t('Team {n}', { n: tm.team + 1 })}</span>
          <b class="sc num">{tm.wins}</b>
          <span class="bar"><i style:--p={Math.min(1, tm.wins / Math.max(1, info.teamTarget))}></i></span>
        </li>
        {#each tm.members as r (r.id)}
          {@render row(r, false)}
        {/each}
      {/each}
    {:else}
      {#each rows as r (r.id)}
        {@render row(r, true)}
      {/each}
    {/if}
  </ol>
  {@render children?.()}
</aside>

{#snippet row(r: Player & { points: number; alive: boolean }, bar: boolean)}
  <li class="row" class:out={!r.alive && info.phase !== 'still'} style:--c={r.colour}>
    <span class="who">{#if r.avatar}<span class="av"><Avatar avatar={r.avatar} size={24} ring={false} /></span>{/if}<span class="sw"></span></span>
    <span class="nm">{r.name}{#if r.id === me}<em>{t('you')}</em>{/if}</span>
    {#key chips[r.id]?.at}
      <span class="plus" class:on={!!chips[r.id]} aria-hidden={!chips[r.id]}>+{chips[r.id]?.n ?? 1}</span>
    {/key}
    <b class="sc num">{r.points}</b>
    {#if bar}<span class="bar"><i style:--p={Math.min(1, r.points / Math.max(1, info.target))}></i></span>{/if}
  </li>
{/snippet}

<style>
  .board {
    width: 288px;
    flex: none;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  .target {
    display: grid;
    grid-template-columns: auto 1fr;
    align-content: center;
    column-gap: 16px;
    row-gap: 4px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--rule);
  }
  .target small {
    grid-column: 2;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .target small:first-child {
    align-self: end;
    color: var(--ink);
  }
  .target b {
    grid-row: 1 / 3;
    grid-column: 1;
    font-size: 46px;
    font-weight: 800;
    font-stretch: 118%;
    line-height: 1;
    padding: 8px 14px 6px;
    outline: 1.5px solid var(--edge);
  }
  .rows {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
    display: grid;
    overflow: hidden;
  }
  .row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    align-items: center;
    column-gap: 10px;
    row-gap: 12px;
    padding-top: 14px;
    transition: opacity 0.3s;
  }
  .row.out {
    opacity: 0.4;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .av {
    display: flex;
  }
  .sw {
    position: relative;
    width: 22px;
    height: 7px;
    background: var(--c);
  }
  .sw::after {
    content: '';
    position: absolute;
    right: -3.5px;
    top: 0;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--c);
  }
  .nm {
    font-size: 19px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .team .nm {
    grid-column: 1 / 3;
    font-size: 13px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .nm em {
    margin-left: 8px;
    font-style: normal;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .plus {
    opacity: 0;
    font-size: 14px;
    font-weight: 700;
    color: var(--c);
    border: 1.5px solid var(--c);
    border-radius: 999px;
    padding: 2px 8px;
  }
  .plus.on {
    animation: plus 3.2s both;
  }
  @keyframes plus {
    0% { opacity: 0; transform: scale(0.4); }
    7% { opacity: 1; transform: scale(1.18); }
    13% { transform: none; }
    82% { opacity: 1; }
    100% { opacity: 0; }
  }
  .sc {
    font-size: 30px;
    font-weight: 800;
    font-stretch: 110%;
    min-width: 46px;
    text-align: right;
  }
  .team .sc {
    grid-column: 4;
  }
  .bar {
    grid-column: 1 / -1;
    display: block;
    height: 3px;
    background: rgb(255 255 255 / 0.08);
  }
  .bar i {
    display: block;
    height: 100%;
    width: calc(var(--p, 0) * 100%);
    background: var(--c);
    transition: width 0.4s;
  }
  @media (max-height: 560px) {
    .board {
      width: 186px;
    }
    .target {
      padding-bottom: 10px;
      column-gap: 10px;
    }
    .target b {
      font-size: 28px;
      padding: 5px 9px 4px;
    }
    .target small {
      font-size: 10.5px;
    }
    .row {
      padding-top: 9px;
      row-gap: 8px;
      column-gap: 8px;
    }
    .sw {
      width: 14px;
    }
    .av {
      display: none;
    }
    .nm {
      font-size: 14px;
    }
    .nm em {
      display: none;
    }
    .plus {
      font-size: 11px;
      padding: 1px 6px;
    }
    .sc {
      font-size: 19px;
      min-width: 26px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .plus.on {
      animation: none;
      opacity: 1;
    }
  }
</style>
