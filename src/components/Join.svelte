<!--
  Arriving at a room's link this device wasn't in: who you are (your seal and name), then into the
  room. A room that isn't there (or is full) says so before anything is typed. From Würfle's.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Avatar } from '../lib/avatar';
  import { t } from '../lib/i18n.svelte';
  import { joinRoom, peekRoom, updateMe } from '../lib/online.svelte';
  import { identity } from '../lib/store';
  import { waitAt } from '../lib/waits';
  import AvatarMaker from './AvatarMaker.svelte';

  let { code, onback }: { code: string; onback: () => void } = $props();

  const me = identity();
  let name = $state(me.name);
  let avatar: Avatar = $state(me.avatar);
  let error = $state('');
  let missing = $state(false);

  onMount(() => {
    const ready = new AbortController();
    const timer = setTimeout(() => ready.abort(), 15_000);
    peekRoom(code, ready.signal).then(
      (room) => {
        if (!room.exists) missing = true;
        else if (room.full) error = t('The room is full.');
      },
      () => {},
    );
    return () => {
      clearTimeout(timer);
      ready.abort();
    };
  });

  function changeAvatar(next: Avatar) {
    avatar = next;
    updateMe({ avatar: next });
  }

  async function join(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) {
      error = t('Your name first, please.');
      return;
    }
    error = '';
    updateMe({ name: name.trim(), avatar });
    try {
      await waitAt(event, (signal) => joinRoom(code, signal), t('Joining the room …'));
    } catch (e) {
      const why = (e as { code?: string }).code;
      if (why === 'no-room') missing = true;
      else error = why === 'full' ? t('The room is full.') : t('That didn’t work. Try again.');
    }
  }
</script>

<div class="join">
  {#if missing}
    <div class="sheet gone">
      <p>{t('No room with that code.')}</p>
      <button class="btn" type="button" onclick={onback}>{t('Home')}</button>
    </div>
  {:else}
    <form class="sheet card" onsubmit={join}>
      <span class="file"><span class="label">{t('Room code')}</span> <b>{code}</b></span>
      <h1 class="display">{t('Who’s driving?')}</h1>
      <AvatarMaker {avatar} onchange={changeAvatar} />
      <label class="field">
        <span class="label">{t('Your name')}</span>
        <input class="input" bind:value={name} maxlength="20" autocomplete="nickname" placeholder={t('Name')} />
      </label>
      <button class="btn primary block" type="submit">{t('Join the room')}</button>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    </form>
    <button class="btn quiet back" type="button" onclick={onback}>{t('Back')}</button>
  {/if}
</div>

<style>
  .join {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 440px;
    margin: 14px auto 0;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 26px 22px 22px;
  }
  .file {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 8px;
  }
  .file b {
    font: 800 20px/1 var(--display);
    font-stretch: 125%;
    letter-spacing: 0.16em;
  }
  h1 {
    font-size: 28px;
    line-height: 1.1;
    text-align: center;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .back {
    align-self: center;
  }
  .gone {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 28px 18px;
    text-align: center;
  }
  .gone p {
    margin: 0;
  }
</style>
