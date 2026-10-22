<script lang="ts">
  // A game in a room: the scoreboard and the field, your keys (← → or A D) and the screen's halves
  // steering your curve, banners for the round's start and its winner. The host can tune the feel
  // mid-game (from the next round) or end the game.
  import { onMount } from 'svelte';
  import { online, world, myId, isHost, steering, inputFor, aheadMs, stopGame, settings, saveProfile, leaveRoom } from '../lib/online.svelte';
  import { bindKeys, bindTouch, Steering } from '../lib/input';
  import { prefs } from '../lib/prefs.svelte';
  import { t } from '../lib/i18n.svelte';
  import Field from './Field.svelte';
  import Scoreboard from './Scoreboard.svelte';
  import Tuner from './Tuner.svelte';
  import SettingsSheet from './SettingsSheet.svelte';

  const v = $derived(online.view!);
  const colours = $derived(new Map(v.members.map((m) => [m.id, m.colour])));
  const names = $derived(new Map(v.members.map((m) => [m.id, m.name])));
  const players = $derived(v.members.filter((m) => m.playing));
  const playing = $derived(players.some((p) => p.id === myId()));
  const own = $derived(new Set(playing ? [myId()] : []));
  let tuneOpen = $state(false);
  let settingsOpen = $state(false);
  let area: HTMLDivElement;

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

  onMount(() => {
    steering.both = prefs.both;
    const keys = new Map<string, [Steering, number]>([
      ['ArrowLeft', [steering, -1]], ['KeyA', [steering, -1]],
      ['ArrowRight', [steering, 1]], ['KeyD', [steering, 1]],
    ]);
    const offKeys = bindKeys(keys);
    const offTouch = bindTouch(area, steering);
    return () => {
      offKeys();
      offTouch();
    };
  });
</script>

<div class="play" bind:this={area}>
  <div class="side">
    <Scoreboard {world} players={players.map((p) => ({ id: p.id, name: p.name, colour: p.colour, team: p.team }))} me={myId()} version={online.version} />
    <div class="tools">
      <span class="code num">{v.code}</span>
      <button class="btn small ghost" type="button" onclick={() => (settingsOpen = true)}>{t('Settings')}</button>
      {#if isHost()}
        <button class="btn small ghost" type="button" onclick={() => (tuneOpen = !tuneOpen)}>{t('Tune')}</button>
        <button class="btn small ghost" type="button" onclick={stopGame}>{t('End game')}</button>
      {:else}
        <button class="btn small ghost" type="button" onclick={leaveRoom}>{t('Leave')}</button>
      {/if}
    </div>
  </div>
  <Field {world} {own} predict={prefs.motion === 'predict'} {aheadMs} behindTicks={prefs.behind} inputFor={() => inputFor()} {colourOf} size={prefs.fieldSize}>
    {#if banner}
      <div class="banner" class:fade={world.phase === 'free'}>
        <strong>{banner.big}</strong>
        {#if banner.small}<span>{banner.small}</span>{/if}
      </div>
    {/if}
  </Field>

  {#if !playing}
    <p class="watching">{t('Watching')} · {t('You join the next game.')}</p>
  {/if}

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
</div>

<SettingsSheet bind:open={settingsOpen} />

<style>
  .play {
    position: fixed;
    inset: 0;
    display: flex;
    gap: 20px;
    padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    overflow: hidden;
  }
  .banner {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    gap: 4px;
    text-align: center;
    pointer-events: none;
    text-shadow: 0 2px 12px #000;
  }
  .banner strong {
    justify-self: center;
    max-width: 90%;
    padding: 6px 12px;
    border-radius: 8px;
    background: rgb(0 0 0 / 0.6);
    font: 800 clamp(13px, 1.6vw, 20px) / 1.15 var(--display);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .banner span {
    color: var(--muted);
  }
  .banner.fade {
    opacity: 0.35;
  }
  .side {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 12px;
    min-height: 0;
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
    max-width: 220px;
  }
  .code {
    font: 800 13px var(--display);
    letter-spacing: 0.16em;
    color: var(--muted);
    margin-right: 6px;
  }
  .watching {
    position: absolute;
    bottom: max(12px, env(safe-area-inset-bottom));
    left: 50%;
    transform: translateX(-50%);
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }
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
    }
    .portrait strong {
      font: 800 20px var(--display);
    }
    .portrait span {
      color: var(--muted);
    }
  }
  @media (max-height: 500px) {
    .play {
      gap: 10px;
      padding-top: max(8px, env(safe-area-inset-top));
      padding-bottom: max(8px, env(safe-area-inset-bottom));
    }
    .tools .btn {
      min-height: 28px;
      padding: 0 8px;
      font-size: 12px;
    }
  }
</style>
