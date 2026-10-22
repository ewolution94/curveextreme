<script lang="ts">
  // The shared keyboard: seats (name, colour, two keys each), the mode, the target and the feel,
  // then the game in the page and its standings.
  import { onDestroy } from 'svelte';
  import { BASE } from '../../shared/colours.mjs';
  import { BUILT_IN } from '../../shared/feel.mjs';
  import { MODES, MODE_KEYS } from '../../shared/modes.mjs';
  import { targetFor } from '../../shared/engine.mjs';
  import { LocalGame, type Seat } from '../lib/local.svelte';
  import { keyLabel } from '../lib/input';
  import { prefs, savePrefs } from '../lib/prefs.svelte';
  import { t } from '../lib/i18n.svelte';
  import Field from './Field.svelte';
  import Scoreboard from './Scoreboard.svelte';
  import Wordmark from './Wordmark.svelte';

  let { onExit }: { onExit: () => void } = $props();

  const NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];
  let seats = $state<Seat[]>([0, 1].map((i) => seat(i)));
  let mode = $state('basic');
  let target = $state(0);
  let profile = $state('');
  let profiles = $state<{ builtIn: any[]; saved: any[] }>({ builtIn: Object.values(BUILT_IN), saved: [] });
  let binding = $state<{ seat: number; step: 0 | 1 } | null>(null);
  let game = $state<LocalGame | null>(null);

  fetch('/api/profiles')
    .then((r) => (r.ok ? r.json() : null))
    .then((p) => p && (profiles = p))
    .catch(() => {});

  function seat(i: number): Seat {
    return { id: `seat-${i}`, name: NAMES[i], colour: BASE[[2, 5, 0, 3][i]].hex, keys: [...(prefs.seatKeys[i] ?? ['', ''])] as [string, string] };
  }

  function bindNext(e: KeyboardEvent) {
    if (!binding) return;
    e.preventDefault();
    if (e.code === 'Escape') {
      binding = null;
      return;
    }
    const s = seats[binding.seat];
    s.keys[binding.step] = e.code;
    if (binding.step === 0) binding = { seat: binding.seat, step: 1 };
    else {
      prefs.seatKeys[binding.seat] = [...s.keys] as [string, string];
      savePrefs();
      binding = null;
    }
  }

  function begin() {
    const all = [...profiles.builtIn, ...profiles.saved];
    const feel = profile ? all.find((p) => p.name === profile) : undefined;
    const g = new LocalGame($state.snapshot(seats) as Seat[], { mode, feel, target });
    game = g;
    g.start();
  }
  function end() {
    game?.stop();
    game = null;
  }
  onDestroy(end);

  const colourOf = (pid: string) => seats.find((s) => s.id === pid)?.colour ?? '#888';
  const conflict = $derived.by(() => {
    const codes = seats.flatMap((s) => s.keys);
    return new Set(codes).size !== codes.length || codes.some((c) => !c);
  });
</script>

<svelte:window onkeydown={bindNext} />

{#if game && !game.state.over}
  <div class="play">
    <Scoreboard world={game.world} players={seats.map((s) => ({ ...s, team: 0 }))} me={null} version={game.state.version} />
    <Field world={game.world} own={new Set(seats.map((s) => s.id))} predict={prefs.motion === 'predict'} aheadMs={() => 0} behindTicks={0}
      inputFor={(pid) => game!.inputFor(pid)} {colourOf} size={prefs.fieldSize} />
    <div class="corner"><button class="btn small ghost" type="button" onclick={end}>{t('End game')}</button></div>
  </div>
{:else if game?.state.over}
  <main class="setup">
    <h1>{t('{name} wins', { name: seats.find((s) => s.id === game?.state.winner)?.name ?? '?' })}</h1>
    <ol class="panel standings">
      {#each game.state.standings as s (s.id)}
        <li><i style:background={s.colour}></i><span>{s.name}</span><strong class="num">{s.points}</strong></li>
      {/each}
    </ol>
    <div class="row">
      <button class="btn primary" type="button" onclick={() => { end(); begin(); }}>{t('Play again')}</button>
      <button class="btn ghost" type="button" onclick={end}>{t('Back')}</button>
    </div>
  </main>
{:else}
  <main class="setup">
    <header>
      <Wordmark size="small" />
      <button class="btn small ghost" type="button" onclick={onExit}>{t('Back')}</button>
    </header>
    <h1>{t('Shared keyboard')}</h1>

    <section class="panel seats">
      <h2 class="label">{t('Seats')}</h2>
      {#each seats as s, i (s.id)}
        <div class="seat">
          <i style:background={s.colour}></i>
          <input class="field-input" maxlength="16" bind:value={s.name} aria-label={t('Your name')} />
          <select class="field-input colour" bind:value={s.colour} aria-label={t('Your colour')}>
            {#each BASE as c (c.id)}<option value={c.hex} disabled={seats.some((o) => o !== s && o.colour === c.hex)}>{c.name}</option>{/each}
          </select>
          <button class="btn small keys" type="button" class:active={binding?.seat === i} onclick={() => (binding = { seat: i, step: 0 })}>
            {#if binding?.seat === i}{binding.step === 0 ? t('Press left…') : t('Press right…')}{:else}{keyLabel(s.keys[0])} {keyLabel(s.keys[1])}{/if}
          </button>
          {#if seats.length > 1}<button class="btn small ghost" type="button" aria-label={t('Remove')} onclick={() => seats.splice(i, 1)}>×</button>{/if}
        </div>
      {/each}
      {#if seats.length < 4}
        <button class="btn small" type="button" onclick={() => seats.push(seat(seats.length))}>{t('Add a seat')}</button>
      {/if}
    </section>

    <section class="panel opts">
      <label class="label" for="lmode">{t('Mode')}</label>
      <select id="lmode" class="field-input" bind:value={mode}>
        {#each MODE_KEYS as k (k)}<option value={k}>{(MODES as any)[k].name}</option>{/each}
      </select>
      <label class="label" for="ltarget">{t('Target')}</label>
      <select id="ltarget" class="field-input" bind:value={target}>
        <option value={0}>{t('Classic ({n})', { n: targetFor(seats.length) })}</option>
        {#each [5, 10, 15, 20, 30] as n (n)}<option value={n}>{n}</option>{/each}
      </select>
      <label class="label" for="lprofile">{t('Feel')}</label>
      <select id="lprofile" class="field-input" bind:value={profile}>
        <option value="">{BUILT_IN[MODES[mode as keyof typeof MODES].feel as keyof typeof BUILT_IN].name}</option>
        {#each [...profiles.builtIn, ...profiles.saved] as p (p.name)}<option value={p.name}>{p.name}</option>{/each}
      </select>
    </section>

    <button class="btn primary big" type="button" disabled={conflict} onclick={begin}>{t('Start')}</button>
  </main>
{/if}

<style>
  .setup {
    max-width: 640px;
    margin: 0 auto;
    padding: max(24px, env(safe-area-inset-top)) 16px 32px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h1 {
    font-size: 26px;
  }
  .panel {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .seat {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .seat i {
    width: 8px;
    height: 32px;
    border-radius: 2px;
    flex: none;
  }
  .seat input {
    flex: 1;
    min-width: 0;
  }
  .colour {
    width: 120px;
  }
  .keys {
    min-width: 110px;
    font-variant-numeric: tabular-nums;
  }
  .keys.active {
    border-color: var(--accent);
    color: var(--accent);
  }
  .big {
    min-height: 54px;
    font-size: 17px;
  }
  .row {
    display: flex;
    gap: 10px;
  }
  .standings {
    list-style: none;
    margin: 0;
  }
  .standings li {
    display: grid;
    grid-template-columns: 8px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    min-height: 36px;
  }
  .standings i {
    width: 8px;
    height: 22px;
    border-radius: 2px;
  }
  .play {
    position: fixed;
    inset: 0;
    display: flex;
    gap: 20px;
    padding: 16px;
    user-select: none;
  }
  .corner {
    position: absolute;
    top: 10px;
    right: 12px;
  }
</style>
