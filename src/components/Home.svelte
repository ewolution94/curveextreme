<!--
  The start, the family's way (Würfle's Home.svelte): who you are (a seal, your name and your curve's
  colour), then a room for friends (new, or by its code), the shared keyboard, your level, how to play.
  How to play opens once on a device's first visit. On a computer two columns: you on the left, the
  ways to play on the right.
-->
<script lang="ts">
  import { firstVisit } from '../../vendor/ewo/elements/guide.js';
  import type { Avatar } from '../lib/avatar';
  import { t } from '../lib/i18n.svelte';
  import { createRoom, online, updateMe } from '../lib/online.svelte';
  import { levelOf, progress } from '../lib/progress';
  import { identity } from '../lib/store';
  import { ui } from '../lib/ui.svelte';
  import { waitAt } from '../lib/waits';
  import AvatarMaker from './AvatarMaker.svelte';
  import ColourPicker from './ColourPicker.svelte';
  import GuideRow from './GuideRow.svelte';
  import StatsSheet from './StatsSheet.svelte';

  let { onjoin, onlocal }: { onjoin: (code: string) => void; onlocal: () => void } = $props();

  // A device's first visit opens how to play, once (Folio's firstVisit: never again, and never when
  // storage is unavailable).
  $effect(() => {
    if (firstVisit('curveextreme:guide')) ui.guide = true;
  });

  const me = identity();
  let name = $state(me.name);
  let avatar: Avatar = $state(me.avatar);
  let colour = $state(me.colour || '#ffe53b');
  let code = $state('');
  // why the last room ended, if it ended on its own
  const ENDED: Record<string, string> = {
    kicked: 'The host took you out of the room.',
    'no-room': 'That room is gone.',
    elsewhere: 'The room is open in another tab.',
  };
  let error = $state(ENDED[online.error] ? t(ENDED[online.error]) : '');
  let statsOpen = $state(false);
  const prog = progress();
  const lv = levelOf(prog.xp);
  const CODE = /^[A-Z]{4}$/;

  function changeAvatar(next: Avatar) {
    avatar = next;
    updateMe({ avatar: next });
  }
  function pick(hex: string) {
    colour = hex;
    updateMe({ colour: hex });
  }
  function who() {
    if (!name.trim()) {
      error = t('Your name first, please.');
      return false;
    }
    error = '';
    updateMe({ name: name.trim() });
    return true;
  }

  async function create(event: Event) {
    if (!who()) return;
    try {
      await waitAt(event, (signal) => createRoom(signal), t('Opening a room …'));
    } catch {
      error = t('That didn’t work. Try again.');
    }
  }

  function join(event: SubmitEvent) {
    event.preventDefault();
    if (CODE.test(code) && who()) onjoin(code);
  }
</script>

<div class="home">
  <section class="sheet card you">
    <h1 class="display">{t('Who’s driving?')}</h1>
    <AvatarMaker {avatar} onchange={changeAvatar} />
    <label class="field">
      <span class="label">{t('Your name')}</span>
      <input class="input" bind:value={name} onchange={() => name.trim() && updateMe({ name: name.trim() })} maxlength="20" autocomplete="nickname" placeholder={t('Name')} />
    </label>
    <div class="field">
      <span class="label">{t('Your colour')}</span>
      <ColourPicker value={colour} xp={prog.xp} onPick={pick} />
    </div>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </section>

  <div class="ways">
    <section class="sheet card">
      <h2 class="display">{t('Play together')}</h2>
      <p class="hint">{t('A room with a code: everyone on their own computer or phone, up to ten curves.')}</p>
      <button class="btn primary block" type="button" onclick={create}>{t('New room')}</button>
      <form class="joinform" onsubmit={join}>
        <span class="label">{t('Join with a room code')}</span>
        <div class="row">
          <input
            class="input code"
            bind:value={code}
            oninput={() => (code = code.toUpperCase().replace(/[^A-Z]/g, ''))}
            maxlength="4"
            autocapitalize="characters"
            autocomplete="off"
            spellcheck="false"
            placeholder="CODE"
            aria-label={t('Room code')}
          />
          <button class="btn" type="submit" disabled={!CODE.test(code)}>{t('Join')}</button>
        </div>
      </form>
    </section>

    <section class="sheet card">
      <h2 class="display">{t('One keyboard')}</h2>
      <p class="hint">{t('Two to four players on this computer, two keys each.')}</p>
      <button class="btn block" type="button" onclick={onlocal}>{t('Set up the seats')}</button>
    </section>

    <button class="sheet level" type="button" onclick={() => (statsOpen = true)}>
      <span class="lv display">{t('Level {n}', { n: lv.level })}</span>
      <span class="meter"><span style:width="{((prog.xp - lv.from) / (lv.to - lv.from)) * 100}%"></span></span>
      <small class="num">{t('{n} XP to level {next}', { n: lv.to - prog.xp, next: lv.level + 1 })} · {t('Your stats')}</small>
      <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
    </button>

    <GuideRow />
  </div>
</div>

<StatsSheet bind:open={statsOpen} />

<style>
  .home {
    display: grid;
    gap: 18px;
    max-width: 440px;
    margin: 18px auto 0;
  }
  .ways {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  @media (min-width: 900px) {
    .home {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: start;
      max-width: 920px;
      gap: 22px;
      margin-top: 28px;
    }
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 22px 20px 20px;
  }
  h1 {
    font-size: 28px;
    line-height: 1.1;
    text-align: center;
  }
  h2 {
    font-size: 21px;
    line-height: 1.1;
  }
  .field,
  .joinform {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .row {
    display: flex;
    gap: 10px;
  }
  .code {
    flex: 1;
    min-width: 0;
    font: 800 22px/1.2 var(--display);
    font-stretch: 125%;
    letter-spacing: 0.3em;
    text-transform: uppercase;
  }
  .level {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px 14px;
    align-items: center;
    width: 100%;
    padding: 14px 14px 14px 16px;
    text-align: left;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  @media (hover: hover) {
    .level:hover {
      border-color: rgb(255 255 255 / 0.3);
    }
  }
  .lv {
    font-size: 18px;
  }
  .meter {
    grid-column: 1;
    height: 6px;
    border-radius: 3px;
    background: var(--panel-2);
    overflow: hidden;
  }
  .meter span {
    display: block;
    height: 100%;
    background: var(--accent);
  }
  .level small {
    grid-column: 1;
    font-size: 13px;
    color: var(--muted);
  }
  .chev {
    grid-column: 2;
    grid-row: 1 / 4;
    width: 20px;
    height: 20px;
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
