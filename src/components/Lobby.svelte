<script lang="ts">
  // The room before a game: the code to share, who's in (your name, colour, team), and the host's
  // settings: free-for-all or teams, the mode, the target, the powerups (Custom), the feel (Tune).
  import { online, myId, isHost, updateMe, settings, startGame, leaveRoom, saveProfile } from '../lib/online.svelte';
  import { progress } from '../lib/progress';
  import { identity } from '../lib/store';
  import { MODES, MODE_KEYS } from '../../shared/modes.mjs';
  import { POWERUPS, POWERUP_KINDS } from '../../shared/powerups.mjs';
  import { targetFor } from '../../shared/engine.mjs';
  import { DISC } from '../lib/icons';
  import { t } from '../lib/i18n.svelte';
  import ColourPicker from './ColourPicker.svelte';
  import Tuner from './Tuner.svelte';
  import Wordmark from './Wordmark.svelte';
  import SettingsSheet from './SettingsSheet.svelte';

  const v = $derived(online.view!);
  const s = $derived(v.settings);
  const host = $derived(isHost());
  const me = $derived(v.members.find((m) => m.id === myId()));
  const taken = $derived(new Set(v.members.filter((m) => m.id !== myId()).map((m) => m.colour)));
  const xp = progress().xp;
  let name = $state(identity().name);
  let copied = $state(false);
  let settingsOpen = $state(false);
  const players = $derived(v.members.filter((m) => m.connected).length);

  async function copy() {
    const url = `${location.origin}/${v.code}`;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      prompt?.('', url);
    }
  }
  function togglePowerup(kind: string) {
    const list = new Set(s.powerups);
    if (list.has(kind)) list.delete(kind);
    else list.add(kind);
    settings({ powerups: [...list] });
  }
</script>

<main class="lobby">
  <header>
    <Wordmark size="small" />
    <div class="code">
      <span class="label">{t('Room code')}</span>
      <strong class="num">{v.code}</strong>
      <button class="btn small" type="button" onclick={copy}>{copied ? t('Copied') : t('Copy link')}</button>
    </div>
    <div class="tools">
      <button class="btn small ghost" type="button" onclick={() => (settingsOpen = true)}>{t('Settings')}</button>
      <button class="btn small ghost" type="button" onclick={leaveRoom}>{t('Leave')}</button>
    </div>
  </header>

  <div class="grid">
    <section class="panel players">
      <h2 class="label">{t('Players')} <span class="num">{players}/10</span></h2>
      <ul>
        {#each v.members as m (m.id)}
          <li class:away={!m.connected}>
            <i style:background={m.colour}></i>
            <span class="name">{m.name}</span>
            {#if m.id === myId()}<span class="tag">{t('You')}</span>{/if}
            {#if m.id === v.host}<span class="tag host">{t('Host')}</span>{/if}
            {#if s.type === 'teams'}<span class="team num">{t('Team {n}', { n: m.team + 1 })}</span>{/if}
          </li>
        {/each}
      </ul>
      <div class="mine">
        <input class="field-input" maxlength="20" aria-label={t('Your name')} bind:value={name} onchange={() => updateMe({ name: name.trim() })} />
        {#if s.type === 'teams'}
          <select class="field-input" aria-label={t('Teams')} value={me?.team ?? 0} onchange={(e) => updateMe({ team: Number((e.target as HTMLSelectElement).value) })}>
            {#each Array.from({ length: s.teams }, (_, i) => i) as i (i)}<option value={i}>{t('Team {n}', { n: i + 1 })}</option>{/each}
          </select>
        {/if}
      </div>
      <ColourPicker value={me?.colour ?? ''} {xp} {taken} onPick={(hex) => updateMe({ colour: hex })} />
    </section>

    <section class="panel game">
      <h2 class="label">{t('Game')}</h2>
      <fieldset disabled={!host}>
        <div class="row">
          <div class="seg" role="radiogroup" aria-label={t('Game')}>
            <button type="button" role="radio" aria-checked={s.type === 'ffa'} onclick={() => settings({ type: 'ffa' })}>{t('Free for all')}</button>
            <button type="button" role="radio" aria-checked={s.type === 'teams'} onclick={() => settings({ type: 'teams' })}>{t('Teams')}</button>
          </div>
          {#if s.type === 'teams'}
            <select class="field-input" aria-label={t('Teams of')} value={s.teams} onchange={(e) => settings({ teams: Number((e.target as HTMLSelectElement).value) })}>
              {#each [2, 3, 4] as n (n)}<option value={n}>{n} {t('Teams')}</option>{/each}
            </select>
          {/if}
        </div>

        <label class="label" for="mode">{t('Mode')}</label>
        <select id="mode" class="field-input" value={s.mode} onchange={(e) => settings({ mode: (e.target as HTMLSelectElement).value })}>
          {#each MODE_KEYS as key (key)}<option value={key}>{(MODES as any)[key].name}</option>{/each}
        </select>
        <p class="blurb">{MODES[s.mode as keyof typeof MODES]?.blurb}</p>

        {#if s.type === 'teams'}
          <label class="label" for="tt">{t('Rounds to win')}</label>
          <input id="tt" class="field-input num" type="number" min="1" max="50" value={s.teamTarget} onchange={(e) => settings({ teamTarget: Number((e.target as HTMLInputElement).value) })} />
        {:else}
          <label class="label" for="target">{t('Target')}</label>
          <div class="row">
            <select id="target" class="field-input" value={s.target ? 'custom' : 'classic'} onchange={(e) => settings({ target: (e.target as HTMLSelectElement).value === 'classic' ? 0 : targetFor(players) })}>
              <option value="classic">{t('Classic ({n})', { n: targetFor(players) })}</option>
              <option value="custom">…</option>
            </select>
            {#if s.target}
              <input class="field-input num small" type="number" min="1" max="500" value={s.target} onchange={(e) => settings({ target: Number((e.target as HTMLInputElement).value) })} />
            {/if}
          </div>
        {/if}

        {#if s.mode === 'custom'}
          <span class="label">{t('Powerups')}</span>
          <div class="pus">
            {#each POWERUP_KINDS as kind (kind)}
              {@const p = (POWERUPS as any)[kind]}
              <label class="pu">
                <input type="checkbox" checked={s.powerups.includes(kind)} onchange={() => togglePowerup(kind)} />
                <i style:background={DISC[p.colour]}></i>{p.name}
              </label>
            {/each}
          </div>
          <label class="label" for="rate">{t('How often')} <span class="num">×{Number(s.rate).toFixed(1)}</span></label>
          <input id="rate" type="range" min="0.2" max="4" step="0.1" value={s.rate} onchange={(e) => settings({ rate: Number((e.target as HTMLInputElement).value) })} />
        {/if}
      </fieldset>

      <details class="feel">
        <summary><span class="label">{t('Feel')}</span> <span class="muted">{s.feel.name}</span></summary>
        <Tuner feel={s.feel} editable={host} profiles={online.profiles}
          onPatch={(patch) => settings({ feel: { ...s.feel, ...patch } })}
          onProfile={(name) => settings({ profile: name })}
          onSave={(name) => saveProfile({ ...s.feel, name })} />
      </details>
    </section>
  </div>

  <footer>
    {#if host}
      <button class="btn primary big" type="button" onclick={startGame} disabled={!players}>{t('Start')}</button>
    {:else}
      <p class="muted">{t('Waiting for the host to start.')}</p>
    {/if}
    <p class="muted small">{t('Steer with ← → or A D. On a phone, hold the left or right half.')} {t('Everyone alive scores when someone crashes.')}</p>
  </footer>
</main>

<SettingsSheet bind:open={settingsOpen} />

<style>
  .lobby {
    max-width: 1100px;
    margin: 0 auto;
    padding: max(20px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }
  .code {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-left: auto;
  }
  .code strong {
    font: 800 28px/1 var(--display);
    letter-spacing: 0.18em;
    color: var(--accent);
  }
  .tools {
    display: flex;
    gap: 6px;
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
    gap: 16px;
    align-items: start;
  }
  .panel {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  h2.label {
    display: flex;
    justify-content: space-between;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  li {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 32px;
  }
  li.away {
    opacity: 0.45;
  }
  li i {
    width: 8px;
    height: 22px;
    border-radius: 2px;
    flex: none;
  }
  .name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tag {
    font-size: 11px;
    padding: 2px 7px;
    border-radius: 999px;
    background: var(--panel-2);
    color: var(--muted);
  }
  .tag.host {
    color: var(--accent);
  }
  .team {
    margin-left: auto;
    color: var(--muted);
    font-size: 13px;
  }
  .mine {
    display: flex;
    gap: 8px;
  }
  .mine input {
    flex: 1;
    min-width: 0;
  }
  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }
  .row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .row select {
    flex: 1;
    min-width: 140px;
  }
  input.small {
    width: 90px;
  }
  .seg {
    display: flex;
    gap: 4px;
    padding: 3px;
    border: 1px solid var(--rule);
    border-radius: 10px;
    background: var(--ground);
  }
  .seg button {
    min-height: 36px;
    padding: 0 14px;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }
  .seg button[aria-checked='true'] {
    background: var(--panel-2);
    color: var(--ink);
    box-shadow: inset 0 0 0 1px var(--rule);
  }
  .blurb {
    margin: -4px 0 0;
    color: var(--muted);
    font-size: 13px;
  }
  .pus {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 4px 12px;
  }
  .pu {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    min-height: 28px;
  }
  .pu i {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex: none;
  }
  .feel summary {
    cursor: pointer;
    display: flex;
    gap: 10px;
    align-items: baseline;
    padding: 6px 0;
  }
  .feel[open] summary {
    margin-bottom: 8px;
  }
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 12.5px;
  }
  footer {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
  .big {
    min-height: 54px;
    min-width: 220px;
    font-size: 17px;
  }
  @media (max-width: 760px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
    .code {
      margin-left: 0;
    }
  }
</style>
