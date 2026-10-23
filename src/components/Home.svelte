<script lang="ts">
  // Home: your name and colour, a new room or one with a code, the shared keyboard; your level.
  import { online, createRoom, joinRoom, updateMe } from '../lib/online.svelte';
  import { identity } from '../lib/store';
  import { progress, levelOf } from '../lib/progress';
  import { t } from '../lib/i18n.svelte';
  import ColourPicker from './ColourPicker.svelte';
  import SettingsSheet from './SettingsSheet.svelte';
  import StatsSheet from './StatsSheet.svelte';
  import Wordmark from './Wordmark.svelte';

  let { onLocal }: { onLocal: () => void } = $props();
  const me = identity();
  let name = $state(me.name);
  let colour = $state(me.colour || '#ffe53b');
  let code = $state('');
  let settingsOpen = $state(false);
  let statsOpen = $state(false);
  const prog = progress();
  const lv = levelOf(prog.xp);

  function rename() {
    updateMe({ name: name.trim() });
  }
  function pick(hex: string) {
    colour = hex;
    updateMe({ colour: hex });
  }
  const errors: Record<string, string> = { 'no-room': 'No room with that code.', full: 'The room is full.' };
</script>

<main class="home">
  <header>
    <Wordmark />
    <p class="tag">{t('Steer a line that never stops. Slip through its gaps, outlast everyone.')}</p>
  </header>

  <section class="panel me">
    <label class="label" for="name">{t('Your name')}</label>
    <input id="name" class="field-input" maxlength="20" autocomplete="nickname" bind:value={name} onchange={rename} placeholder="Player" />
    <span class="label">{t('Your colour')}</span>
    <ColourPicker value={colour} xp={prog.xp} onPick={pick} />
  </section>

  <section class="actions">
    <button class="btn primary big" type="button" onclick={() => { rename(); createRoom(); }} disabled={!online.open}>{t('New room')}</button>
    <form class="join" onsubmit={(e) => { e.preventDefault(); rename(); joinRoom(code); }}>
      <input class="field-input code" aria-label={t('Room code')} placeholder={t('Room code')} maxlength="4" autocapitalize="characters" autocomplete="off" spellcheck="false"
        bind:value={code} oninput={() => (code = code.toUpperCase().replace(/[^A-Z]/g, ''))} />
      <button class="btn" type="submit" disabled={code.length !== 4 || !online.open}>{t('Join')}</button>
    </form>
    {#if online.error && errors[online.error]}<p class="error">{t(errors[online.error])}</p>{/if}
    {#if !online.open}<p class="muted">{t('Connecting…')}</p>{/if}
    <button class="btn ghost" type="button" onclick={onLocal}>
      {t('Shared keyboard')} <span class="muted small">{t('Two to four players on this computer.')}</span>
    </button>
  </section>

  <footer class="foot">
    <button class="level" type="button" onclick={() => (statsOpen = true)}>
      <span class="lv">{t('Level {n}', { n: lv.level })}</span>
      <span class="bar"><span style:width="{((prog.xp - lv.from) / (lv.to - lv.from)) * 100}%"></span></span>
      <span class="muted small num">{t('{n} XP to level {next}', { n: lv.to - prog.xp, next: lv.level + 1 })}</span>
    </button>
    <button class="btn small ghost" type="button" onclick={() => (settingsOpen = true)}>{t('Settings')}</button>
  </footer>
</main>

<SettingsSheet bind:open={settingsOpen} />
<StatsSheet bind:open={statsOpen} />

<style>
  .home {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    gap: 22px;
    max-width: 520px;
    margin: 0 auto;
    padding: max(32px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
  }
  header {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .tag {
    margin: 0;
    color: var(--muted);
    max-width: 38ch;
  }
  .me {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .big {
    min-height: 54px;
    font-size: 17px;
  }
  .join {
    display: flex;
    gap: 8px;
  }
  .code {
    flex: 1;
    min-width: 0;
    font: 800 18px var(--display);
    letter-spacing: 0.3em;
    text-transform: uppercase;
  }
  .ghost {
    flex-wrap: wrap;
    justify-content: flex-start;
  }
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 12.5px;
    font-weight: 400;
  }
  .error {
    margin: 0;
    color: var(--danger);
  }
  .foot {
    margin-top: auto;
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }
  .level {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 4px;
    text-align: left;
    border: 0;
    background: none;
    padding: 0;
    cursor: pointer;
  }
  .lv {
    font: 800 14px var(--display);
  }
  .bar {
    height: 6px;
    border-radius: 3px;
    background: var(--panel-2);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
  }
</style>
