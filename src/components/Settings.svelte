<!--
  Settings, the family's way (plans/settings-alignment.md; Würfle's Settings.svelte): Folio's
  ewo-sheet, opened from the band's or the arena's ewo-settings-button. During a game (`game` given)
  it opens with "This game" first: the host can end it for everyone, anyone can leave, each after a
  second tap that says what it does (development/plans/end-game.md); at the shared keyboard the game
  can be ended. Then General: the language and the sounds. Then the field's size on this device.
  CurveExtreme is dark only, so there's no theme.
-->
<script lang="ts">
  import GuideRow from './GuideRow.svelte';
  import { themeShift } from '../../vendor/ewo/elements/theme-shift.js';
  import { i18n, setLanguage, systemLang, t, type LangChoice } from '../lib/i18n.svelte';
  import { prefs, savePrefs, type FieldSize } from '../lib/prefs.svelte';
  import { sfx, unlockAudio } from '../lib/sound';
  import { admin, lock, unlock } from '../lib/admin.svelte';
  import { waitAt } from '../lib/waits';

  type Game = {
    host: boolean;
    hostName: string;
    /** The host: end the game for everyone (back to the room). */
    onend?: (signal: AbortSignal) => Promise<unknown>;
    onleave: () => void;
  };
  let {
    open,
    onclose,
    game = null,
    onendlocal,
  }: {
    open: boolean;
    onclose: () => void;
    game?: Game | null;
    /** The shared keyboard: end the game in the page. */
    onendlocal?: () => void;
  } = $props();

  let sure: 'end' | 'leave' | 'local' | null = $state(null);
  let error = $state('');
  let code = $state('');
  let codeWrong = $state(false);
  $effect(() => {
    if (!open) {
      sure = null;
      error = '';
      code = '';
      codeWrong = false;
    }
  });

  function tryCode(event: SubmitEvent) {
    event.preventDefault();
    codeWrong = !unlock(code);
    if (!codeWrong) code = '';
  }

  async function end(from: Event) {
    error = '';
    try {
      await waitAt(from, (signal) => game!.onend!(signal), t('Ending the game …'));
      onclose();
    } catch {
      error = t('That didn’t work. Try again.');
    }
  }

  let shown = $state(false);
  $effect(() => {
    if (open) shown = true;
  });
  function closed() {
    shown = false;
    onclose();
  }

  function pickLanguage(next: LangChoice) {
    if (next === i18n.choice) return;
    const shows = next === 'system' ? systemLang() : next;
    if (shows === i18n.lang) setLanguage(next);
    else themeShift(() => setLanguage(next));
  }

  function set<K extends 'fieldSize' | 'sound'>(key: K, value: (typeof prefs)[K]) {
    prefs[key] = value;
    savePrefs();
  }
</script>

<ewo-sheet {open} label={t('Settings')} oncancel={onclose} onclose={closed}>
  <span slot="heading">{t('Settings')}</span>
  {#if shown}
    <div class="guide"><GuideRow before={onclose} /></div>
    {#if game || onendlocal}
      <section class="game">
        <h3 class="label">{t('This game')}</h3>
        {#if sure === 'end'}
          <p class="sure">{t('End the game for everyone?')}</p>
          <div class="pair">
            <button class="btn danger-fill" type="button" onclick={end}>{t('Yes, end it')}</button>
            <button class="btn" type="button" onclick={() => (sure = null)}>{t('Keep playing')}</button>
          </div>
        {:else if sure === 'leave'}
          <p class="sure">{game?.host ? t('Leave the room? Your curve stops, and someone else becomes the host.') : t('Leave the room? Your curve stops.')}</p>
          <div class="pair">
            <button class="btn danger-fill" type="button" onclick={() => game?.onleave()}>{t('Yes, leave')}</button>
            <button class="btn" type="button" onclick={() => (sure = null)}>{t('Keep playing')}</button>
          </div>
        {:else if sure === 'local'}
          <p class="sure">{t('End the game at this keyboard?')}</p>
          <div class="pair">
            <button class="btn danger-fill" type="button" onclick={() => (onclose(), onendlocal?.())}>{t('Yes, end it')}</button>
            <button class="btn" type="button" onclick={() => (sure = null)}>{t('Keep playing')}</button>
          </div>
        {:else if onendlocal}
          <button class="btn" type="button" onclick={() => (sure = 'local')}>{t('End the game')}</button>
        {:else if game}
          <div class="pair">
            {#if game.host && game.onend}
              <button class="btn" type="button" onclick={() => (sure = 'end')}>{t('End the game')}</button>
            {/if}
            <button class="btn quiet" type="button" onclick={() => (sure = 'leave')}>{t('Leave the room')}</button>
          </div>
          {#if !game.host}<p class="hint">{t('{name} can end the game.', { name: game.hostName })}</p>{/if}
        {/if}
        {#if error}<p class="error" role="alert">{error}</p>{/if}
      </section>
    {/if}
    <section>
      <h3 class="label">{t('General')}</h3>
      <div class="row">
        <span class="name">{t('Language')}</span>
        <ewo-segmented stretch value={i18n.choice} label={t('Language')} onchange={(e) => pickLanguage(e.detail.value as LangChoice)}>
          <option value="system">{t('System')}</option>
          <option value="de">Deutsch</option>
          <option value="en">English</option>
        </ewo-segmented>
      </div>
      <div class="row">
        <span class="name">{t('Sounds')}</span>
        <ewo-switch
          checked={prefs.sound}
          aria-label={t('Sounds')}
          onchange={(e) => {
            set('sound', e.detail.checked);
            if (e.detail.checked) {
              unlockAudio();
              sfx.go();
            }
          }}
        ></ewo-switch>
      </div>
    </section>
    <section>
      <h3 class="label">{t('On this device')}</h3>
      <div class="row">
        <span class="name">{t('Field size')}<small>{t('Original keeps the reference’s scale, so the field may not fill the screen.')}</small></span>
        <ewo-segmented stretch value={prefs.fieldSize} label={t('Field size')} onchange={(e) => set('fieldSize', e.detail.value as FieldSize)}>
          <option value="fill">{t('Fill')}</option>
          <option value="reference">{t('Original')}</option>
          <option value="auto">{t('Auto')}</option>
        </ewo-segmented>
      </div>
    </section>
    <section class="admin">
      <h3 class="label">{t('Admin')}</h3>
      {#if admin.on}
        <div class="row">
          <span class="name">{t('Admin tools are on')}<small>{t('The Tune panel and the feel in the room show on this device.')}</small></span>
          <button class="btn small" type="button" onclick={lock}>{t('Turn off')}</button>
        </div>
      {:else}
        <form class="code" onsubmit={tryCode}>
          <input class="input" bind:value={code} oninput={() => (codeWrong = false)} placeholder={t('Admin code')} aria-label={t('Admin code')} autocomplete="off" autocapitalize="off" spellcheck="false" />
          <button class="btn small" type="submit" disabled={!code.trim()}>{t('Unlock')}</button>
        </form>
        {#if codeWrong}<p class="error" role="alert">{t('That’s not the code.')}</p>{/if}
      {/if}
    </section>
  {/if}
</ewo-sheet>

<style>
  .guide {
    margin-bottom: 22px;
  }
  section {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 8px;
  }
  section + section {
    padding-top: 20px;
    border-top: 1px solid var(--line);
  }
  h3 {
    margin: 0;
  }
  .game {
    padding-bottom: 16px;
    margin-bottom: 4px;
    border-bottom: 1.5px solid var(--line);
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .name {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
    font-size: 15px;
  }
  .name small {
    font-size: 12.5px;
    line-height: 1.35;
    color: var(--muted);
  }
  ewo-segmented {
    flex: none;
    width: min(300px, 62%);
  }
  .code {
    display: flex;
    gap: 8px;
  }
  .code .input {
    flex: 1;
    min-width: 0;
    min-height: 40px;
    font-size: 16px;
  }
  @media (max-width: 480px) {
    .row:has(ewo-segmented) {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
    }
    ewo-segmented {
      width: 100%;
    }
  }
</style>
