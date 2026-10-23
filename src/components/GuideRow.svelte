<!--
  "How to play" as a row of its own, in the panels' look (Würfle's GuideRow.svelte): the curve mark,
  the title, what's inside, a chevron. On the start page, in the room and at the top of Settings.
-->
<script lang="ts">
  import { t } from '../lib/i18n.svelte';
  import { ui } from '../lib/ui.svelte';

  let { before }: { before?: () => void } = $props();
</script>

<button
  class="sheet guide-row"
  type="button"
  onclick={() => {
    before?.();
    ui.guide = true;
  }}
>
  <svg class="mark" viewBox="0 0 32 32" aria-hidden="true">
    <rect x="1" y="1" width="30" height="30" rx="8" />
    <path d="M23.5 9.5 C19 5.5 9 6.5 8 15 C7.2 22 14 26.5 20 24.5" />
    <circle cx="22.4" cy="23.6" r="2.3" />
  </svg>
  <span class="text"><b>{t('How to play')}</b><small>{t('Steering, gaps, powerups: the game in five steps')}</small></span>
  <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
</button>

<style>
  .guide-row {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    min-height: 68px;
    padding: 12px 14px 12px 16px;
    text-align: left;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: transform var(--ewo-dur-1) var(--ewo-ease), border-color var(--ewo-dur-1) var(--ewo-ease);
  }
  @media (hover: hover) {
    .guide-row:hover {
      border-color: rgb(255 255 255 / 0.3);
    }
  }
  .guide-row:active {
    transform: translateY(1px);
  }
  .mark {
    flex: none;
    width: 36px;
    height: 36px;
  }
  .mark rect {
    fill: var(--ground);
    stroke: var(--line);
  }
  .mark path {
    fill: none;
    stroke: var(--ink);
    stroke-width: 3.2;
    stroke-linecap: round;
    stroke-dasharray: 22 3.5 40;
  }
  .mark circle {
    fill: var(--accent);
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }
  .text b {
    font: 800 18px/1.15 var(--display);
    font-stretch: 118%;
    color: var(--ink);
  }
  .text small {
    font: 500 14px/1.3 var(--body);
    color: var(--muted);
  }
  .chev {
    flex: none;
    width: 20px;
    height: 20px;
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
