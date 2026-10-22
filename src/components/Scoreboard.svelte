<script lang="ts">
  // The scoreboard beside the field: the target, the round, everyone by points (a "+1" chip when they
  // score), dimmed once they crashed this round; in teams, each team's round wins above its players.
  import type { World } from '../lib/world';
  import { t } from '../lib/i18n.svelte';

  type Player = { id: string; name: string; colour: string; team: number };
  let { world, players, me, version }: { world: World; players: Player[]; me: string | null; version: number } = $props();

  let chips = $state<Record<string, { n: number; at: number }>>({});
  let seen: Record<string, number> = {};

  // a "+n" chip when someone scores (n adds up while the chip still shows)
  $effect(() => {
    void version;
    const pts = world.points;
    const now = performance.now();
    for (const p of players) {
      const v = pts[p.id] ?? 0;
      const before = seen[p.id] ?? v;
      if (v > before) {
        const prev = chips[p.id];
        chips[p.id] = { n: v - before + (prev && now - prev.at < 1500 ? prev.n : 0), at: now };
      }
      seen[p.id] = v;
    }
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

  const info = $derived.by(() => {
    void version;
    return { no: world.no, type: world.type, target: world.target, teamTarget: world.teamTarget, phase: world.phase };
  });

  const teams = $derived.by(() => {
    void version;
    if (world.type !== 'teams') return [];
    const ids = [...new Set(players.map((p) => p.team))].sort();
    return ids.map((team) => ({ team, wins: world.teamWins[team] ?? 0, members: rows.filter((r) => r.team === team) }));
  });

  // chips fade after 1.5 s
  let tick = $state(0);
  $effect(() => {
    const id = setInterval(() => tick++, 250);
    return () => clearInterval(id);
  });
  const showChip = (id: string) => {
    void tick;
    const c = chips[id];
    return c && performance.now() - c.at < 1500 ? c.n : 0;
  };
</script>

<aside class="board">
  <div class="head">
    <span class="round">{t('Round {n}', { n: info.no })}</span>
    <span class="target num" title={info.type === 'teams' ? t('First team to {n}', { n: info.teamTarget }) : t('First to {n}', { n: info.target })}>
      {info.type === 'teams' ? info.teamTarget : info.target}
    </span>
  </div>
  {#if info.type === 'teams'}
    {#each teams as tm (tm.team)}
      <div class="team">
        <span class="label">{t('Team {n}', { n: tm.team + 1 })}</span>
        <span class="wins num">{tm.wins}</span>
      </div>
      {#each tm.members as r (r.id)}
        {@render row(r)}
      {/each}
    {/each}
  {:else}
    {#each rows as r (r.id)}
      {@render row(r)}
    {/each}
  {/if}
</aside>

{#snippet row(r: { id: string; name: string; colour: string; points: number; alive: boolean })}
  <div class="row" class:dead={!r.alive && info.phase !== 'still'} class:me={r.id === me}>
    <i style:background={r.colour}></i>
    <span class="name">{r.name}</span>
    {#if showChip(r.id)}
      <span class="chip num" style:background={r.colour}>+{showChip(r.id)}</span>
    {/if}
    <span class="pts num">{r.points}</span>
  </div>
{/snippet}

<style>
  .board {
    width: 220px;
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 4px 0;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .round {
    font: 800 13px/1 var(--display);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .target {
    min-width: 54px;
    padding: 8px 10px;
    border-radius: 6px;
    background: var(--accent);
    color: var(--accent-ink);
    font: 800 22px/1 var(--display);
    text-align: center;
  }
  .team {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-top: 6px;
  }
  .wins {
    font: 800 16px/1 var(--display);
  }
  .row {
    display: grid;
    grid-template-columns: 6px minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 10px;
    min-height: 26px;
    transition: opacity 200ms ease;
  }
  .row i {
    width: 6px;
    height: 20px;
    border-radius: 2px;
  }
  .row.dead {
    opacity: 0.4;
  }
  .row.me .name {
    font-weight: 700;
  }
  .name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 16px;
  }
  .pts {
    font: 600 18px/1 var(--display);
    min-width: 2ch;
    text-align: right;
  }
  .chip {
    padding: 2px 6px;
    border-radius: 4px;
    color: #000;
    font: 700 12px/1.2 var(--body);
  }
  @media (max-width: 900px), (max-height: 500px) {
    .board {
      width: 150px;
    }
    .name {
      font-size: 13px;
    }
    .pts {
      font-size: 14px;
    }
    .target {
      font-size: 16px;
      min-width: 40px;
      padding: 6px;
    }
  }
</style>
