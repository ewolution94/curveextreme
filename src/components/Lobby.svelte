<!--
  The room before a game, the family's way (Würfle's Lobby.svelte): the code, its link and QR code;
  who's in, with their seals, colours and teams (tap yourself to change yours); and the host's
  settings: free for all or teams, the mode, the target, the powerups (Custom), the feel (Tune). On a
  computer two columns: the room and its people left, the game right.
-->
<script lang="ts">
  import { online, myId, isHost, updateMe, settings, startGame, saveProfile, type Member } from '../lib/online.svelte';
  import { progress } from '../lib/progress';
  import { MODES, MODE_KEYS } from '../../shared/modes.mjs';
  import { POWERUPS, POWERUP_KINDS } from '../../shared/powerups.mjs';
  import { targetFor } from '../../shared/engine.mjs';
  import type { Avatar as AvatarValue } from '../lib/avatar';
  import { t } from '../lib/i18n.svelte';
  import { waitAt } from '../lib/waits';
  import Avatar from './Avatar.svelte';
  import AvatarMaker from './AvatarMaker.svelte';
  import ColourPicker from './ColourPicker.svelte';
  import GuideRow from './GuideRow.svelte';
  import PowerupDisc from './PowerupDisc.svelte';
  import Qr from './Qr.svelte';
  import Tuner from './Tuner.svelte';

  const MAX = 10;
  const v = $derived(online.view!);
  const s = $derived(v.settings);
  const host = $derived(isHost());
  const hostName = $derived(v.members.find((m) => m.id === v.host)?.name ?? '');
  const here = $derived(v.members.filter((m) => m.connected));
  const seated = $derived(here.slice(0, MAX));
  const watching = $derived(here.slice(MAX));
  const me = $derived(v.members.find((m) => m.id === myId()));
  const taken = $derived(new Set(v.members.filter((m) => m.id !== myId()).map((m) => m.colour)));
  const link = $derived(`${location.origin}/${v.code}`);
  const mode = $derived((MODES as any)[s.mode] ?? MODES.basic);
  const xp = progress().xp;

  let copied = $state(false);
  let error = $state('');
  let youOpen = $state(false);
  let youShown = $state(false);
  let name = $state('');
  $effect(() => {
    if (youOpen) youShown = true;
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      copied = true;
      setTimeout(() => (copied = false), 1600);
    } catch {
      // The link is on the page to select by hand.
    }
  }

  function openYou() {
    name = me?.name ?? '';
    youOpen = true;
  }

  function togglePowerup(kind: string) {
    const list = new Set(s.powerups);
    if (list.has(kind)) list.delete(kind);
    else list.add(kind);
    settings({ powerups: [...list] });
  }

  async function start(event: Event) {
    error = '';
    try {
      await waitAt(event, (signal) => startGame(signal), t('Starting …'));
    } catch {
      error = t('That didn’t work. Try again.');
    }
  }
</script>

{#snippet playerRow(m: Member)}
  {@const mine = m.id === myId()}
  <svelte:element
    this={mine ? 'button' : 'div'}
    class="player"
    class:me={mine}
    type={mine ? 'button' : undefined}
    onclick={mine ? openYou : undefined}
    role={mine ? undefined : 'listitem'}
  >
    <Avatar avatar={m.avatar} size={32} />
    <i class="swatch" style:background={m.colour}></i>
    <span class="name">{m.name}</span>
    {#if mine}<small>{t('You')}</small>{/if}
    {#if m.id === v.host}<small>{t('Host')}</small>{/if}
    {#if s.type === 'teams'}<small class="team">{t('Team {n}', { n: m.team + 1 })}</small>{/if}
  </svelte:element>
{/snippet}

<div class="lobby">
  <div class="col">
    <section class="sheet roomcard">
      <span class="label">{t('Room code')}</span>
      <div class="coderow">
        <span class="code">{v.code}</span>
        <button class="btn small" type="button" onclick={copy}>{copied ? t('Copied') : t('Copy link')}</button>
      </div>
      <div class="share">
        <div class="qr"><Qr url={link} /></div>
        <p class="hint">{t('Invite people with the code or the QR code.')}<br /><span class="url">{link}</span></p>
      </div>
    </section>

    <section class="sheet seats">
      <div class="seathead">
        <h2 class="display">{t('In the room')}</h2>
        <span class="label num">{seated.length}/{MAX}</span>
      </div>
      <div class="chairs" role="list">
        {#each seated as m (m.id)}{@render playerRow(m)}{/each}
      </div>
      <p class="hint">{t('Tap yourself to change your seal, colour or team.')}</p>
      {#if watching.length}
        <span class="label">{t('Watching')}</span>
        <div class="chairs" role="list">
          {#each watching as m (m.id)}{@render playerRow(m)}{/each}
        </div>
      {/if}
    </section>
  </div>

  <div class="col">
    <section class="sheet setup" aria-label={t('Game')}>
      <h2 class="display">{t('The game')}</h2>
      <div class="setting">
        <span class="label">{t('Play')}</span>
        {#if host}
          <ewo-segmented stretch value={s.type} label={t('Play')} onchange={(e) => settings({ type: e.detail.value })}>
            <option value="ffa">{t('Free for all')}</option>
            <option value="teams">{t('Teams')}</option>
          </ewo-segmented>
          {#if s.type === 'teams'}
            <ewo-segmented stretch value={String(s.teams)} label={t('Teams')} onchange={(e) => settings({ teams: Number(e.detail.value) })}>
              {#each [2, 3, 4] as n (n)}<option value={String(n)}>{t('{n} teams', { n })}</option>{/each}
            </ewo-segmented>
          {/if}
        {:else}
          <b class="value">{s.type === 'teams' ? t('{n} teams', { n: s.teams }) : t('Free for all')}</b>
        {/if}
      </div>

      <div class="setting">
        <span class="label">{t('Mode')}</span>
        {#if host}
          <div class="modes" role="radiogroup" aria-label={t('Mode')}>
            {#each MODE_KEYS as key (key)}
              <button class="chip" type="button" role="radio" aria-checked={s.mode === key} onclick={() => settings({ mode: key })}>{(MODES as any)[key].name}</button>
            {/each}
          </div>
        {:else}
          <b class="value">{mode.name}</b>
        {/if}
        <span class="hint">{mode.blurb}</span>
      </div>

      <div class="setting">
        {#if s.type === 'teams'}
          <span class="label">{t('Rounds to win')}</span>
          {#if host}
            <input class="input num short" type="number" min="1" max="50" value={s.teamTarget} aria-label={t('Rounds to win')}
              onchange={(e) => settings({ teamTarget: Number((e.target as HTMLInputElement).value) })} />
          {:else}
            <b class="value num">{s.teamTarget}</b>
          {/if}
        {:else}
          <span class="label">{t('Target')}</span>
          {#if host}
            <ewo-segmented stretch value={s.target ? 'custom' : 'classic'} label={t('Target')}
              onchange={(e) => settings({ target: e.detail.value === 'classic' ? 0 : targetFor(Math.max(2, here.length)) })}>
              <option value="classic">{t('Classic ({n})', { n: targetFor(here.length) })}</option>
              <option value="custom">{t('Your own')}</option>
            </ewo-segmented>
            {#if s.target}
              <input class="input num short" type="number" min="1" max="500" value={s.target} aria-label={t('Target')}
                onchange={(e) => settings({ target: Number((e.target as HTMLInputElement).value) })} />
            {/if}
          {:else}
            <b class="value num">{s.target || targetFor(here.length)}</b>
          {/if}
          <span class="hint">{t('Classic: ten points for every other player. Two points clear wins.')}</span>
        {/if}
      </div>

      {#if s.mode === 'custom'}
        <div class="setting">
          <span class="label">{t('Powerups')}</span>
          <div class="pus">
            {#each POWERUP_KINDS as kind (kind)}
              {@const on = s.powerups.includes(kind)}
              <button class="pu" type="button" aria-pressed={on} disabled={!host} onclick={() => togglePowerup(kind)}>
                <PowerupDisc {kind} size={22} />
                <span>{(POWERUPS as any)[kind].name}</span>
              </button>
            {/each}
          </div>
          <label class="label" for="rate">{t('How often')} <span class="num">×{Number(s.rate).toFixed(1)}</span></label>
          <input id="rate" type="range" min="0.2" max="4" step="0.1" value={s.rate} disabled={!host}
            onchange={(e) => settings({ rate: Number((e.target as HTMLInputElement).value) })} />
        </div>
      {/if}

      <details class="feel">
        <summary><span class="label">{t('Feel')}</span> <span class="feelname">{s.feel.name}</span></summary>
        <Tuner feel={s.feel} editable={host} profiles={online.profiles}
          onPatch={(patch) => settings({ feel: { ...s.feel, ...patch } })}
          onProfile={(p) => settings({ profile: p })}
          onSave={(p) => saveProfile({ ...s.feel, name: p })} />
      </details>
    </section>

    <GuideRow />

    <div class="go">
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      {#if host}
        <button class="btn primary block big" type="button" disabled={!here.length} onclick={start}>{t('Start the game')}</button>
      {:else}
        <p class="hint center">{t('{name} starts the game.', { name: hostName })}</p>
      {/if}
      <p class="hint center">{t('Steer with ← → or A D. On a phone, hold the left or right half.')}</p>
    </div>
  </div>
</div>

<ewo-sheet open={youOpen} label={t('You')} oncancel={() => (youOpen = false)} onclose={() => ((youShown = false), (youOpen = false))}>
  <span slot="heading">{t('You')}</span>
  {#if youShown && me}
    <div class="menu">
      <AvatarMaker avatar={me.avatar as AvatarValue} onchange={(next) => updateMe({ avatar: next })} />
      <label class="field">
        <span class="label">{t('Your name')}</span>
        <input class="input" bind:value={name} maxlength="20" autocomplete="nickname" onchange={() => name.trim() && updateMe({ name: name.trim() })} />
      </label>
      <div class="field">
        <span class="label">{t('Your colour')}</span>
        <ColourPicker value={me.colour} {xp} {taken} onPick={(hex) => updateMe({ colour: hex })} />
      </div>
      {#if s.type === 'teams'}
        <div class="field">
          <span class="label">{t('Your team')}</span>
          <ewo-segmented stretch value={String(me.team)} label={t('Your team')} onchange={(e) => updateMe({ team: Number(e.detail.value) })}>
            {#each Array.from({ length: s.teams }, (_, i) => i) as i (i)}<option value={String(i)}>{t('Team {n}', { n: i + 1 })}</option>{/each}
          </ewo-segmented>
        </div>
      {/if}
      <button class="btn primary block" type="button" onclick={() => (youOpen = false)}>{t('Done')}</button>
    </div>
  {/if}
</ewo-sheet>

<style>
  .lobby {
    display: grid;
    gap: 16px;
    max-width: 520px;
    margin: 12px auto 0;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }
  @media (min-width: 980px) {
    .lobby {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
      align-items: start;
      max-width: 1040px;
      gap: 22px;
      margin-top: 24px;
    }
  }
  .roomcard,
  .seats,
  .setup {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px 18px 16px;
  }
  .coderow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .code {
    font: 800 44px/1 var(--display);
    font-stretch: 125%;
    letter-spacing: 0.12em;
  }
  .share {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .qr {
    flex: none;
    width: 108px;
  }
  .url {
    overflow-wrap: anywhere;
    font: 400 13.5px/1.4 var(--body);
    color: var(--ink-2);
  }
  h2 {
    font-size: 21px;
  }
  .seathead {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  .chairs {
    display: flex;
    flex-direction: column;
  }
  .player {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 6px 10px 6px 4px;
    border: 0;
    border-bottom: 1px solid var(--rule);
    background: none;
    color: var(--ink);
    font: 600 16px/1.2 var(--body);
    text-align: left;
  }
  button.player {
    cursor: pointer;
    border-radius: 8px 8px 0 0;
  }
  @media (hover: hover) {
    button.player:hover {
      background: rgb(255 255 255 / 0.05);
    }
  }
  .swatch {
    flex: none;
    width: 18px;
    height: 5px;
    border-radius: 3px;
  }
  .player .name {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .player small {
    padding: 3px 7px 2px;
    border-radius: 4px;
    background: rgb(176 122 255 / 0.14);
    font: 700 11px/1.2 var(--body);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .player small.team {
    background: rgb(255 255 255 / 0.08);
    color: var(--ink-2);
  }
  .setting {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .setting + .setting,
  .feel {
    padding-top: 12px;
    border-top: 1px solid var(--rule);
  }
  .value {
    font: 800 18px/1.2 var(--display);
    font-stretch: 118%;
  }
  .modes {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .short {
    width: 120px;
  }
  .pus {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
    gap: 6px;
  }
  .pu {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 38px;
    padding: 4px 10px 4px 6px;
    border: 1.5px solid var(--line);
    border-radius: 999px;
    background: transparent;
    color: var(--muted);
    font: 600 13px/1.15 var(--body);
    text-align: left;
    opacity: 0.6;
  }
  .pu[aria-pressed='true'] {
    border-color: var(--accent);
    background: rgb(176 122 255 / 0.12);
    color: var(--ink);
    opacity: 1;
  }
  .pu:disabled {
    cursor: default;
  }
  input[type='range'] {
    width: 100%;
    accent-color: var(--accent);
  }
  .feel summary {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 4px 0;
    cursor: pointer;
  }
  .feel[open] summary {
    margin-bottom: 10px;
  }
  .feelname {
    color: var(--ink-2);
    font-weight: 600;
  }
  .go {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .big {
    min-height: 54px;
    font-size: 17px;
  }
  .center {
    text-align: center;
  }
  .menu {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 8px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
</style>
