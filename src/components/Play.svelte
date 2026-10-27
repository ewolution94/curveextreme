<script lang="ts">
  // A game in a room, in look A's arena (Arena.svelte): your keys (← → or A D) and the screen's halves
  // steer your curve, banners for the round's start and its winner. The round is simulated here on
  // the server's clock (src/lib/runner.ts). The host can tune the feel mid-game (from the next round)
  // or end the game in Settings.
  import { onMount } from 'svelte';
  import { online, game, myId, isHost, steering, stopGame, settings, saveProfile, leaveRoom } from '../lib/online.svelte';
  import { bindKeys, bindTouch, Steering } from '../lib/input';
  import { t } from '../lib/i18n.svelte';
  import Arena from './Arena.svelte';
  import Tuner from './Tuner.svelte';
  import Settings from './Settings.svelte';
  import { admin } from '../lib/admin.svelte';

  const v = $derived(online.view!);
  const runner = $derived.by(() => {
    void online.version;
    return game.runner;
  });
  const members = $derived(new Map(v.members.map((m) => [m.id, m])));
  // the round's players in its order: a player's number is their place here
  const players = $derived(
    (runner?.start.players ?? []).map((p: any) => {
      const m = members.get(p.id);
      return { id: p.id, name: m?.name ?? '?', colour: m?.colour ?? '#888', team: p.team, avatar: m?.avatar ?? null };
    }),
  );
  const playing = $derived(players.some((p: any) => p.id === myId()));
  const hostName = $derived(v.members.find((m) => m.id === v.host)?.name ?? '');
  let tuneOpen = $state(false);
  let settingsOpen = $state(false);
  let settingsButton: HTMLElement | undefined = $state();
  let area = $state<HTMLDivElement>();

  const banner = $derived.by(() => {
    void online.version;
    if (online.countdown) return { big: t('Round {n}', { n: online.countdown.no }), small: t('Get ready') };
    if (!runner) return null;
    const r = runner.round;
    const phase = r.phase;
    if (phase === 'still' || phase === 'free') return { big: t('Round {n}', { n: runner.no }), small: playing ? t('Get ready') : t('Watching') };
    if (phase === 'linger' || phase === 'done') {
      const w = r.s.winner;
      if (w === null || w === undefined) return { big: t('Nobody takes the round'), small: '' };
      if (runner.start.type === 'teams') return { big: t('Team {n} takes the round', { n: Number(w) + 1 }), small: '' };
      return { big: t('{name} takes the round', { name: players[w]?.name ?? '?' }), small: '' };
    }
    return null;
  });
  // beside your own head before the round moves: which way is left and which is right for it
  const labelsOf = (p: number): [string, string] | null => (players[p]?.id === myId() ? [t('Left').toUpperCase(), t('Right').toUpperCase()] : null);
  const keys = $derived(playing ? `${t('{name} steers with', { name: members.get(myId())?.name ?? '' })} ← → · A D` : `${t('Watching')} · ${t('You join the next game.')}`);

  onMount(() =>
    bindKeys(
      new Map<string, [Steering, number]>([
        ['ArrowLeft', [steering, -1]], ['KeyA', [steering, -1]],
        ['ArrowRight', [steering, 1]], ['KeyD', [steering, 1]],
      ]),
    ),
  );
  // the screen's halves steer on a phone (the arena comes once the first round has started)
  $effect(() => {
    if (area) return bindTouch(area, steering);
  });
</script>

{#if runner}
  <Arena {runner} version={online.version} {players} me={myId()} code={v.code} {keys} {banner} {labelsOf} bind:area>
    {#snippet actions()}
      {#if isHost() && admin.on}
        <button class="btn small ghost" type="button" onclick={() => (tuneOpen = !tuneOpen)}>{t('Tune')}</button>
      {/if}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <ewo-settings-button bind:this={settingsButton} onclick={() => (settingsOpen = true)}></ewo-settings-button>
    {/snippet}

    {#if tuneOpen && isHost() && admin.on}
      <div class="drawer panel">
        <Tuner feel={v.settings.feel} editable profiles={online.profiles}
          onPatch={(patch) => settings({ feel: { ...v.settings.feel, ...patch } })}
          onProfile={(name) => settings({ profile: name })}
          onSave={(name) => saveProfile({ ...v.settings.feel, name })} />
        <button class="btn small" type="button" onclick={() => (tuneOpen = false)}>{t('Close')}</button>
      </div>
    {/if}

    <div class="portrait">
      <strong>{t('Turn your phone')}</strong>
      <span>{t('The field needs the wide side.')}</span>
    </div>
  </Arena>
{:else}
  <div class="waiting">
    <b>{banner?.big ?? t('Round {n}', { n: 1 })}</b>
    <small>{t('Get ready')}</small>
  </div>
{/if}

<Settings
  open={settingsOpen}
  onclose={() => {
    settingsOpen = false;
    settingsButton?.focus();
  }}
  game={{ host: isHost(), hostName, onend: (signal) => stopGame(signal), onleave: leaveRoom }}
/>

<style>
  .drawer {
    position: absolute;
    right: max(12px, env(safe-area-inset-right));
    top: 16px;
    bottom: 16px;
    width: min(520px, calc(100vw - 32px));
    overflow: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    touch-action: auto;
    user-select: auto;
    z-index: 5;
  }
  .waiting {
    position: fixed;
    inset: 0;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 8px;
    background: var(--ground);
  }
  .waiting b {
    font: 800 clamp(28px, 6vw, 54px) / 1.05 var(--display);
    font-stretch: 125%;
  }
  .waiting small {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .portrait {
    display: none;
  }
  @media (pointer: coarse) and (orientation: portrait) {
    .portrait {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
      gap: 6px;
      text-align: center;
      background: var(--ground);
      padding: 24px;
      z-index: 10;
    }
    .portrait strong {
      font-size: 26px;
      font-weight: 800;
      font-stretch: 125%;
    }
    .portrait span {
      color: var(--muted);
    }
  }
</style>
