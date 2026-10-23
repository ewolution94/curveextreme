<script lang="ts">
  // Look A's game screen, shared by a room and the shared keyboard (plans/curveextreme/looks.html):
  // on a computer one centred group, the name and the round and room above, the board right beside
  // the field; on a phone held sideways the board left, the field in the middle, the name and the
  // room right.
  import { onMount, type Snippet } from 'svelte';
  import type { RoundRunner } from '../lib/runner';
  import { prefs } from '../lib/prefs.svelte';
  import { POWERUPS } from '../../shared/powerups.mjs';
  import { DISC } from '../lib/icons';
  import { t } from '../lib/i18n.svelte';
  import Field from './Field.svelte';
  import Scoreboard from './Scoreboard.svelte';
  import Wordmark from './Wordmark.svelte';

  type Player = { id: string; name: string; colour: string; team: number; avatar?: number[] | null };
  type Props = {
    runner: RoundRunner;
    version: number;
    /** The round's players, in its order (a player's number is their place here). */
    players: Player[];
    me: string | null;
    code?: string;
    keys?: string; // who steers with which keys, under the board
    banner?: { big: string; small: string } | null;
    actions: Snippet;
    children?: Snippet;
    area?: HTMLDivElement;
  };
  let { runner, version, players, me, code, keys, banner, actions, children, area = $bindable() }: Props = $props();
  const colourOf = (p: number) => players[p]?.colour ?? '#888';

  const BOARD = 288, GAP = 32, PHONE_BOARD = 186, PHONE_SIDE = 128, PHONE_GAP = 16;
  let compact = $state(false);
  let fieldW = $state(0);
  let fieldH = $state(0);
  const no = $derived.by(() => {
    void version;
    return runner.no;
  });

  const phase = $derived.by(() => {
    void version;
    return runner.round.phase as string;
  });

  // your running effects under the board: a disc's colour and the time left
  let fx = $state<{ kind: string; name: string; left: number; colour: string }[]>([]);
  onMount(() => {
    const mq = matchMedia('(max-height: 560px)');
    const set = () => (compact = mq.matches);
    set();
    mq.addEventListener('change', set);
    const timer = setInterval(() => {
      const p = me ? runner.playerOf(me) : -1;
      const T = runner.frameAt(performance.now());
      fx = (p >= 0 ? runner.effectsOf(p, T) : [])
        .map(({ kind, left }) => {
          const pu = (POWERUPS as any)[kind];
          return { kind, name: pu?.name ?? kind, left, colour: DISC[pu?.colour ?? 'blue'] };
        })
        .filter((f) => f.left > 0);
    }, 250);
    return () => {
      mq.removeEventListener('change', set);
      clearInterval(timer);
    };
  });
</script>

<div class="arena" class:compact bind:this={area}>
  {#if !compact}
    <header class="top" style:min-width={fieldW ? `${BOARD + GAP + fieldW}px` : null}>
      <Wordmark size="small" />
      <div class="meta">
        <span class="rnd">{t('Round')} <b class="num">{no}</b></span>
        {#if code}<span class="room">{t('Room')} <b>{code}</b></span>{/if}
        <span class="actions">{@render actions()}</span>
      </div>
    </header>
  {/if}
  <div class="group">
    <div class="boardwrap" style:height={fieldH ? `${fieldH}px` : null}>
    <Scoreboard {runner} {players} {me} {version}>
      {#if !compact}
        <div class="foot">
          {#each fx as f (f.kind)}
            <span class="fx"><i style:background={f.colour}></i>{f.name} <b class="num">{f.left.toFixed(0)} s</b></span>
          {/each}
          {#if keys}<span class="keys">{keys}</span>{/if}
        </div>
      {/if}
    </Scoreboard>
    </div>
    <Field {runner} {colourOf} size={prefs.fieldSize}
      reserve={compact ? PHONE_BOARD + PHONE_SIDE + 2 * PHONE_GAP : BOARD + GAP} bind:width={fieldW} bind:height={fieldH}>
      {#if banner}
        <div class="banner" class:fade={phase === 'free'}>
          <b>{banner.big}</b>
          {#if banner.small}<small>{banner.small}</small>{/if}
        </div>
      {/if}
      {#if compact && phase === 'still'}
        <div class="halves"><span>◀ {t('Hold left')}</span><span>{t('Hold right')} ▶</span></div>
      {/if}
    </Field>
    {#if compact}
      <div class="side">
        <Wordmark size="stack" />
        <span class="rnd">{t('Round')} <b class="num">{no}</b></span>
        {#if code}<span class="room">{t('Room')} <b>{code}</b></span>{/if}
        <span class="actions">{@render actions()}</span>
      </div>
    {/if}
  </div>
  {@render children?.()}
</div>

<style>
  .arena {
    position: fixed;
    inset: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    justify-items: center;
    row-gap: 16px;
    padding: max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left));
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    overflow: hidden;
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 22px;
    min-height: 48px;
    max-width: 100%;
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 22px;
  }
  .rnd,
  .room {
    font-size: 15px;
    color: var(--muted);
    font-weight: 500;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
  .rnd b,
  .room b {
    color: var(--ink);
    font-weight: 700;
    margin-left: 4px;
  }
  .room b {
    letter-spacing: 0.16em;
    font-stretch: 112%;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .group {
    width: 100%;
    min-height: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 32px;
  }
  .boardwrap {
    display: flex;
    align-self: center;
    min-height: 0;
  }
  .boardwrap > :global(.board) {
    height: 100%;
  }
  .foot {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 18px;
  }
  .fx {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--muted);
  }
  .fx i {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .fx b {
    color: var(--ink);
    font-weight: 600;
  }
  .keys {
    font-size: 13px;
    color: var(--muted);
  }
  .banner {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 8px;
    text-align: center;
    pointer-events: none;
    padding: 0 6%;
  }
  .banner b {
    font-size: clamp(16px, 6.2cqw, 54px);
    font-weight: 800;
    font-stretch: 125%;
    letter-spacing: -0.01em;
    line-height: 1.05;
    text-wrap: balance;
    text-shadow: 0 2px 16px #000;
  }
  .banner small {
    font-size: clamp(10px, 2cqw, 15px);
    font-weight: 600;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .banner.fade {
    opacity: 0.35;
  }
  .halves {
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: 10px;
    display: flex;
    justify-content: space-between;
    pointer-events: none;
    font-size: 12px;
    color: var(--muted);
    font-weight: 600;
  }
  .compact {
    grid-template-rows: minmax(0, 1fr);
    padding: max(10px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
  }
  .compact .group {
    gap: 16px;
    align-items: center;
  }
  .side {
    width: 128px;
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 14px;
    align-items: flex-start;
    min-width: 0;
  }
  .side .rnd,
  .side .room {
    font-size: 12.5px;
  }
  .side .actions {
    flex-direction: column;
    align-items: flex-start;
  }
  .side .actions :global(.btn) {
    min-height: 28px;
    padding: 0 8px;
    font-size: 12px;
  }
</style>
