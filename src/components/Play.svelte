<script lang="ts">
  // A game in a room, in look A's arena (Arena.svelte): your keys (← → or A D) and the screen's halves
  // steer your curve, banners for the round's start and its winner. The host can tune the feel
  // mid-game (from the next round) or end the game.
  import { onMount } from 'svelte';
  import { online, world, myId, isHost, steering, inputFor, aheadMs, stopGame, settings, saveProfile, leaveRoom } from '../lib/online.svelte';
  import { bindKeys, bindTouch, Steering } from '../lib/input';
  import { prefs } from '../lib/prefs.svelte';
  import { t } from '../lib/i18n.svelte';
  import Arena from './Arena.svelte';
  import Tuner from './Tuner.svelte';
  import Settings from './Settings.svelte';

  const v = $derived(online.view!);
  const colours = $derived(new Map(v.members.map((m) => [m.id, m.colour])));
  const names = $derived(new Map(v.members.map((m) => [m.id, m.name])));
  const players = $derived(v.members.filter((m) => m.playing).map((p) => ({ id: p.id, name: p.name, colour: p.colour, team: p.team, avatar: p.avatar })));
  const playing = $derived(players.some((p) => p.id === myId()));
  const own = $derived(new Set(playing ? [myId()] : []));
  let tuneOpen = $state(false);
  let settingsOpen = $state(false);
  let settingsButton: HTMLElement | undefined = $state();
  const hostName = $derived(v.members.find((m) => m.id === v.host)?.name ?? '');
  let area = $state<HTMLDivElement>();

  const colourOf = (pid: string) => colours.get(pid) ?? '#888';
  const banner = $derived.by(() => {
    void online.version;
    if (world.phase === 'still' || world.phase === 'free') return { big: t('Round {n}', { n: world.no }), small: playing ? t('Get ready') : t('Watching') };
    if (world.phase === 'linger' || world.phase === 'done') {
      const w = world.winner;
      if (w === null || w === undefined) return { big: t('Nobody takes the round'), small: '' };
      if (world.type === 'teams') return { big: t('Team {n} takes the round', { n: Number(w) + 1 }), small: '' };
      return { big: t('{name} takes the round', { name: names.get(w) ?? '?' }), small: '' };
    }
    return null;
  });
  const keys = $derived(playing ? `${t('{name} steers with', { name: names.get(myId()) ?? '' })} ← → · A D` : `${t('Watching')} · ${t('You join the next game.')}`);

  onMount(() => {
    steering.both = prefs.both;
    const map = new Map<string, [Steering, number]>([
      ['ArrowLeft', [steering, -1]], ['KeyA', [steering, -1]],
      ['ArrowRight', [steering, 1]], ['KeyD', [steering, 1]],
    ]);
    const offKeys = bindKeys(map);
    let offTouch = () => {};
    queueMicrotask(() => {
      if (area) offTouch = bindTouch(area, steering);
    });
    return () => {
      offKeys();
      offTouch();
    };
  });
</script>

<Arena {world} version={online.version} {players} me={myId()} {own} {aheadMs} behindTicks={prefs.behind} inputFor={() => inputFor()} {colourOf}
  code={v.code} {keys} {banner} bind:area>
  {#snippet actions()}
    {#if isHost()}
      <button class="btn small ghost" type="button" onclick={() => (tuneOpen = !tuneOpen)}>{t('Tune')}</button>
    {/if}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <ewo-settings-button bind:this={settingsButton} onclick={() => (settingsOpen = true)}></ewo-settings-button>
  {/snippet}

  {#if tuneOpen && isHost()}
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
