<!--
  The shared keyboard: seats (a seal, a name, a colour, two keys each), the mode, the target and the
  feel, then the game in the page and its standings. In the family's panels, like the room.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { BASE } from '../../shared/colours.mjs';
  import { BUILT_IN } from '../../shared/feel.mjs';
  import { MODES, MODE_KEYS } from '../../shared/modes.mjs';
  import { targetFor } from '../../shared/engine.mjs';
  import { LocalGame, type Seat } from '../lib/local.svelte';
  import { keyLabel } from '../lib/input';
  import { prefs, savePrefs } from '../lib/prefs.svelte';
  import { randomAvatar, type Avatar as AvatarValue } from '../lib/avatar';
  import { identity } from '../lib/store';
  import { t } from '../lib/i18n.svelte';
  import Arena from './Arena.svelte';
  import Avatar from './Avatar.svelte';
  import Settings from './Settings.svelte';

  let { onExit, playing = $bindable(false) }: { onExit: () => void; playing?: boolean } = $props();

  type LocalSeat = Seat & { avatar: AvatarValue };
  const NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];
  const me = identity();
  let seats = $state<LocalSeat[]>([0, 1].map((i) => seat(i)));
  let mode = $state('basic');
  let target = $state(0);
  let profile = $state('');
  let profiles = $state<{ builtIn: any[]; saved: any[] }>({ builtIn: Object.values(BUILT_IN), saved: [] });
  let binding = $state<{ seat: number; step: 0 | 1 } | null>(null);
  let game = $state<LocalGame | null>(null);
  let settingsOpen = $state(false);
  let settingsButton: HTMLElement | undefined = $state();

  $effect(() => {
    playing = Boolean(game && !game.state.over);
  });

  fetch('/api/profiles')
    .then((r) => (r.ok ? r.json() : null))
    .then((p) => p && (profiles = p))
    .catch(() => {});

  function seat(i: number): LocalSeat {
    // The first seat is this device's player.
    return {
      id: `seat-${i}`,
      name: i === 0 && me.name ? me.name : t(NAMES[i]),
      colour: BASE[[2, 5, 0, 3][i]].hex,
      avatar: i === 0 ? me.avatar : randomAvatar(),
      keys: [...(prefs.seatKeys[i] ?? ['', ''])] as [string, string],
    };
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

  const seatOf = (pid: string | null) => seats.find((s) => s.id === pid);
  const runner = $derived.by(() => {
    void game?.state.version;
    return game?.runner ?? null;
  });
  const localBanner = $derived.by(() => {
    if (!game) return null;
    void game.state.version;
    const r = game.runner;
    if (!r) return null;
    const phase = r.round.phase;
    if (phase === 'still' || phase === 'free') return { big: t('Round {n}', { n: r.no }), small: t('Get ready') };
    if (phase === 'linger' || phase === 'done') {
      const w = r.round.s.winner;
      const name = w === null ? undefined : seats[w]?.name;
      return { big: name ? t('{name} takes the round', { name }) : t('Nobody takes the round'), small: '' };
    }
    return null;
  });
  const conflict = $derived.by(() => {
    const codes = seats.flatMap((s) => s.keys);
    return new Set(codes).size !== codes.length || codes.some((c) => !c);
  });
  const winner = $derived(seatOf(game?.state.winner ?? null));
</script>

<svelte:window onkeydown={bindNext} />

{#if game && !game.state.over && runner}
  <Arena {runner} version={game.state.version} players={seats.map((s) => ({ ...s, team: 0 }))} me={null}
    keys={seats.map((s) => `${s.name} ${keyLabel(s.keys[0])} ${keyLabel(s.keys[1])}`).join(' · ')} banner={localBanner}>
    {#snippet actions()}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <ewo-settings-button bind:this={settingsButton} onclick={() => (settingsOpen = true)}></ewo-settings-button>
    {/snippet}
  </Arena>
  <Settings
    open={settingsOpen}
    onclose={() => {
      settingsOpen = false;
      settingsButton?.focus();
    }}
    onendlocal={end}
  />
{:else if game?.state.over}
  <div class="final">
    <section class="sheet head win">
      {#if winner}<Avatar avatar={winner.avatar} size={64} />{/if}
      <h1 class="display">{t('{name} wins', { name: winner?.name ?? '?' })}</h1>
      <ol class="standings">
        {#each game.state.standings as s, i (s.id)}
          {@const st = seatOf(s.id)}
          <li>
            <span class="place num">{i + 1}</span>
            {#if st}<Avatar avatar={st.avatar} size={26} ring={false} />{/if}
            <i class="swatch" style:background={s.colour}></i>
            <span class="name">{s.name}</span>
            <b class="pts num">{s.points}</b>
          </li>
        {/each}
      </ol>
    </section>
    <div class="actions">
      <button class="btn primary block big" type="button" onclick={() => { end(); begin(); }}>{t('Play again')}</button>
      <button class="btn quiet" type="button" onclick={end}>{t('Back to the seats')}</button>
    </div>
  </div>
{:else}
  <div class="setup">
    <section class="sheet card">
      <div class="head">
        <h1 class="display">{t('One keyboard')}</h1>
        <span class="label num">{seats.length}/4</span>
      </div>
      {#each seats as s, i (s.id)}
        <div class="seat">
          <button class="av" type="button" aria-label={t('Another seal')} onclick={() => (s.avatar = randomAvatar())}><Avatar avatar={s.avatar} size={36} /></button>
          <input class="input" maxlength="16" bind:value={s.name} aria-label={t('Name')} />
          <select class="field-input colour" bind:value={s.colour} aria-label={t('Colour')} style:--c={s.colour}>
            {#each BASE as c (c.id)}<option value={c.hex} disabled={seats.some((o) => o !== s && o.colour === c.hex)}>{t(c.name)}</option>{/each}
          </select>
          <button class="btn small keys" type="button" class:active={binding?.seat === i} onclick={() => (binding = { seat: i, step: 0 })}>
            {#if binding?.seat === i}{binding.step === 0 ? t('Press left…') : t('Press right…')}{:else}{keyLabel(s.keys[0])} {keyLabel(s.keys[1])}{/if}
          </button>
          {#if seats.length > 1}<button class="btn small quiet remove" type="button" aria-label={t('Remove')} onclick={() => seats.splice(i, 1)}>×</button>{/if}
        </div>
      {/each}
      <div class="row">
        {#if seats.length < 4}
          <button class="btn small" type="button" onclick={() => seats.push(seat(seats.length))}>{t('Add a seat')}</button>
        {/if}
      </div>
      <p class="hint">{t('Tap a seal for another one, the keys to set new ones.')}</p>
    </section>

    <section class="sheet card">
      <h2 class="display">{t('The game')}</h2>
      <div class="setting">
        <span class="label">{t('Mode')}</span>
        <div class="modes" role="radiogroup" aria-label={t('Mode')}>
          {#each MODE_KEYS as key (key)}
            <button class="chip" type="button" role="radio" aria-checked={mode === key} onclick={() => (mode = key)}>{(MODES as any)[key].name}</button>
          {/each}
        </div>
        <span class="hint">{(MODES as any)[mode].blurb}</span>
      </div>
      <div class="setting">
        <span class="label">{t('Target')}</span>
        <ewo-segmented stretch value={String(target)} label={t('Target')} onchange={(e) => (target = Number(e.detail.value))}>
          <option value="0">{t('Classic ({n})', { n: targetFor(seats.length) })}</option>
          {#each [5, 10, 20, 30] as n (n)}<option value={String(n)}>{n}</option>{/each}
        </ewo-segmented>
      </div>
      <div class="setting">
        <label class="label" for="lprofile">{t('Feel')}</label>
        <select id="lprofile" class="field-input" bind:value={profile}>
          <option value="">{BUILT_IN[MODES[mode as keyof typeof MODES].feel as keyof typeof BUILT_IN].name}</option>
          {#each [...profiles.builtIn, ...profiles.saved] as p (p.name)}<option value={p.name}>{p.name}</option>{/each}
        </select>
      </div>
    </section>

    <div class="go">
      <button class="btn primary block big" type="button" disabled={conflict} onclick={begin}>{t('Start the game')}</button>
      {#if conflict}<p class="hint center">{t('Every seat needs two keys of its own.')}</p>{/if}
      <button class="btn quiet" type="button" onclick={onExit}>{t('Back')}</button>
    </div>
  </div>
{/if}

<style>
  .setup,
  .final {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 620px;
    margin: 18px auto 0;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px 18px 18px;
  }
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  h1 {
    font-size: 26px;
  }
  h2 {
    font-size: 21px;
  }
  .seat {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .seat .input {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    font-size: 16px;
  }
  .av {
    display: flex;
    flex: none;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
  }
  .colour {
    width: 116px;
    min-height: 44px;
    border-left: 6px solid var(--c);
  }
  .keys {
    min-width: 104px;
    min-height: 44px;
    font-variant-numeric: tabular-nums;
  }
  .keys.active {
    border-color: var(--accent);
    color: var(--accent);
  }
  .remove {
    padding: 0 10px;
    font-size: 20px;
  }
  .row {
    display: flex;
    gap: 8px;
  }
  .setting {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .setting + .setting {
    padding-top: 12px;
    border-top: 1px solid var(--rule);
  }
  .modes {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .go,
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
  .head + .seat {
    margin-top: 4px;
  }
  .final .win {
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 26px 18px 14px;
    text-align: center;
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
    font-weight: 600;
  }
  .pts {
    font: 800 20px/1 var(--display);
    font-stretch: 125%;
  }
  @media (max-width: 520px) {
    .seat {
      flex-wrap: wrap;
    }
    .seat .input {
      flex: 1 1 calc(100% - 52px);
    }
    .colour {
      flex: 1;
    }
  }
</style>
