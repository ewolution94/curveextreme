<script lang="ts">
  // The Tune panel (the admin's, src/lib/admin.svelte.ts): every number of the feel on Folio's
  // slider, the reference as measured marked on it, a profile to start from, and Save as, so a
  // playtest's feel can be kept on the server and picked again. A dial's value goes out when it's
  // let go and reaches the game from the next round.
  import { DIALS, CHOICES, CLASSIC } from '../../shared/feel.mjs';
  import { t } from '../lib/i18n.svelte';

  type Props = {
    feel: any;
    editable: boolean;
    profiles: { builtIn: any[]; saved: any[] };
    onPatch: (patch: Record<string, number | string>) => void;
    onProfile: (name: string) => void;
    onSave: (name: string) => void;
  };
  let { feel, editable, profiles, onPatch, onProfile, onSave }: Props = $props();

  let saveName = $state('');
  /** A dial's value while it's dragged. */
  let local = $state<Record<string, number>>({});

  const value = (key: string) => local[key] ?? feel[key];
  const digits = (step: number) => (step >= 1 ? 0 : step >= 0.1 ? 1 : 2);

  function done(key: string, v: number) {
    delete local[key];
    onPatch({ [key]: v });
  }

  function reset() {
    local = {};
    onProfile(CLASSIC.name);
  }
</script>

<div class="tuner">
  <div class="row">
    <label class="label" for="profile">{t('Profile')}</label>
    <select id="profile" class="field-input" disabled={!editable} value={feel.name} onchange={(e) => onProfile((e.target as HTMLSelectElement).value)}>
      {#each profiles.builtIn as p (p.name)}<option value={p.name}>{p.name}</option>{/each}
      {#each profiles.saved as p (p.name)}<option value={p.name}>{p.name}</option>{/each}
      {#if ![...profiles.builtIn, ...profiles.saved].some((p) => p.name === feel.name)}<option value={feel.name}>{feel.name}</option>{/if}
    </select>
  </div>
  <p class="hint">{t('Applies from the next round.')}</p>
  {#each CHOICES as ch (ch.key)}
    <div class="row">
      <label class="label" for="choice-{ch.key}">{ch.label}</label>
      <select id="choice-{ch.key}" class="field-input" disabled={!editable} value={feel[ch.key] ?? (CLASSIC as any)[ch.key]}
        onchange={(e) => onPatch({ [ch.key]: (e.target as HTMLSelectElement).value } as any)}>
        {#each ch.options as o (o)}<option value={o}>{o}{o === (CLASSIC as any)[ch.key] ? ' (default)' : ''}</option>{/each}
      </select>
    </div>
  {/each}
  <div class="dials">
    {#each DIALS as d (d.key)}
      {@const v = value(d.key)}
      {@const ref = (CLASSIC as any)[d.key]}
      <div class="dial" class:off={Math.abs(v - ref) > d.step / 2}>
        <label for="dial-{d.key}">{d.label}</label>
        <output class="num">{Number(v).toFixed(digits(d.step))} {d.unit}</output>
        <ewo-slider
          id="dial-{d.key}"
          label={d.label}
          min={d.min}
          max={d.max}
          step={d.step}
          mark={ref}
          unit={d.unit}
          value={feel[d.key]}
          disabled={!editable}
          oninput={(e) => (local[d.key] = e.detail.value)}
          onchange={(e) => done(d.key, e.detail.value)}
        ></ewo-slider>
      </div>
    {/each}
  </div>
  {#if editable}
    <div class="actions">
      <button class="btn small" type="button" onclick={reset}>{t('Back to measured')}</button>
      <form class="save" onsubmit={(e) => { e.preventDefault(); if (saveName.trim()) { onSave(saveName.trim()); saveName = ''; } }}>
        <input class="field-input" placeholder={t('Save as')} bind:value={saveName} maxlength="40" />
        <button class="btn small" type="submit" disabled={!saveName.trim()}>{t('Save')}</button>
      </form>
    </div>
  {/if}
</div>

<style>
  .tuner {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .row select {
    flex: 1;
    min-width: 0;
  }
  .hint {
    margin: 0;
    color: var(--muted);
    font-size: 12.5px;
  }
  .dials {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 12px 18px;
  }
  .dial {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 2px 8px;
    align-items: baseline;
    font-size: 13px;
  }
  .dial.off output {
    color: var(--accent);
  }
  .dial ewo-slider {
    grid-column: 1 / -1;
    --ewo-slider-knob-size: 18px;
    --ewo-slider-track-height: 5px;
  }
  .actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
  }
  .save {
    display: flex;
    gap: 8px;
    flex: 1;
    min-width: 220px;
  }
  .save input {
    flex: 1;
    min-width: 0;
    min-height: 34px;
  }
</style>
