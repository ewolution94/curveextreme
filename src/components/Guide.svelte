<!--
  How to play, as full-screen pages: Folio's <ewo-guide> brings the frame (swipe, the dots, Back and
  Next, Done); each page has a small picture drawn like the field: thin lines on the black, the
  curves in their colours, the real powerup discs. Opens once on a device's first visit (Home), and
  from the start page, the room and Settings. From Würfle's Guide.svelte.
-->
<script lang="ts">
  import { t } from '../lib/i18n.svelte';
  import { ui } from '../lib/ui.svelte';
  import PowerupDisc from './PowerupDisc.svelte';

  const close = () => (ui.guide = false);
  const pages = [
    { title: 'Steer', text: 'Your line never stops. ← → or A D turn it; on a phone held sideways, hold the left or the right half of the screen.' },
    { title: 'Stay clear', text: 'Touch a line or the wall and your round is over, your own line too. At the start you see where you’re heading for a moment before the lines begin.' },
    { title: 'Slip through', text: 'Every line leaves short gaps now and then. Drive through one to get out of a tight spot.' },
    { title: 'Powerups', text: 'Drive over a disc to take it. Green ones are for you, red ones hit everyone else, blue ones change the field for all.' },
    { title: 'Win', text: 'When a curve crashes, everyone still driving gets a point. First to the target, two points clear, wins the game.' },
  ];
</script>

<ewo-guide
  open={ui.guide}
  label={t('How to play')}
  next-label={t('Next')}
  back-label={t('Back')}
  skip-label={t('Skip')}
  done-label={t('Let’s go')}
  oncancel={close}
  onclose={close}
>
  {#each pages as page, n (n)}
    <section class="page">
      <div class="art" aria-hidden="true">
        {#if n === 0}
          <svg viewBox="0 0 240 130">
            <path class="c" style:stroke="#ffe53b" d="M20 110 C 60 110 70 40 120 40 S 190 90 214 52" />
            <circle style:fill="#ffe53b" cx="214" cy="52" r="5.5" />
          </svg>
          <div class="keys"><kbd>←</kbd><kbd>→</kbd><span>·</span><kbd>A</kbd><kbd>D</kbd></div>
        {:else if n === 1}
          <svg viewBox="0 0 240 150">
            <rect class="wall" x="6" y="6" width="228" height="138" />
            <path class="c" style:stroke="#3f8cff" d="M30 120 C 70 120 90 30 150 30 S 214 70 214 120" />
            <path class="c" style:stroke="#ff4a3d" d="M40 40 C 80 50 110 80 128 72" />
            <circle style:fill="#ff4a3d" cx="128" cy="72" r="5.5" />
            <g class="burst" transform="translate(140 66)">
              <path d="M0 -14 L3 -4 L13 -6 L5 2 L11 11 L0 6 L-9 12 L-5 2 L-13 -5 L-3 -4 Z" />
            </g>
          </svg>
        {:else if n === 2}
          <svg viewBox="0 0 240 130">
            <path class="c" style:stroke="#2fcf6e" d="M10 70 H 104 M 128 70 H 230" />
            <path class="c" style:stroke="#ff5fc1" d="M116 124 C 116 100 116 40 140 18" />
            <circle style:fill="#ff5fc1" cx="140" cy="18" r="5.5" />
          </svg>
        {:else if n === 3}
          <div class="discs">
            <span><PowerupDisc kind="greenSpeed" size={52} /><small>{t('You')}</small></span>
            <span><PowerupDisc kind="redTurtle" size={52} /><small>{t('The others')}</small></span>
            <span><PowerupDisc kind="eraser" size={52} /><small>{t('Everyone')}</small></span>
          </div>
        {:else}
          <div class="board">
            <span class="target">20</span>
            <ol>
              <li><i style:background="#ffe53b"></i>Mia<b>18</b><em>+1</em></li>
              <li><i style:background="#3f8cff"></i>Jonas<b>15</b><em>+1</em></li>
              <li class="out"><i style:background="#ff4a3d"></i>Lea<b>12</b></li>
            </ol>
          </div>
        {/if}
      </div>
      <h2 class="display">{t(page.title)}</h2>
      <p>{t(page.text)}</p>
    </section>
  {/each}
</ewo-guide>

<style>
  ewo-guide {
    --ewo-guide-bg: var(--ground);
    --ewo-guide-fg: var(--ink);
    --ewo-guide-fg-2: var(--ink-2);
    --ewo-guide-accent: var(--accent);
    --ewo-guide-accent-ink: var(--accent-ink);
    --ewo-guide-dot: rgb(255 255 255 / 0.28);
    --ewo-guide-dot-on: var(--accent);
  }
  ewo-guide::part(next) {
    border-radius: var(--radius);
    font: 700 16px/1 var(--body);
  }
  .page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 12px 28px 8px;
    text-align: center;
  }
  h2 {
    margin: 8px 0 0;
    font-size: 28px;
  }
  p {
    margin: 0;
    max-width: 38ch;
    font-size: 16px;
    line-height: 1.5;
    color: var(--ink-2);
  }
  .art {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    width: min(320px, 100%);
    min-height: 170px;
  }
  svg {
    width: 100%;
    height: auto;
    overflow: visible;
  }
  .c {
    fill: none;
    stroke-width: 6;
    stroke-linecap: butt;
  }
  .wall {
    fill: none;
    stroke: var(--edge);
    stroke-width: 1.5;
  }
  .burst path {
    fill: var(--ink);
  }
  .keys {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--muted);
  }
  kbd {
    display: grid;
    place-items: center;
    min-width: 38px;
    height: 38px;
    padding: 0 8px;
    border: 1.5px solid rgb(255 255 255 / 0.28);
    border-bottom-width: 3px;
    border-radius: 8px;
    font: 700 16px/1 var(--body);
    color: var(--ink);
  }
  .discs {
    display: flex;
    gap: 22px;
  }
  .discs span {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .discs small {
    font: 600 12px/1.2 var(--body);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .board {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 220px;
    text-align: left;
  }
  .target {
    font: 800 44px/1 var(--display);
    font-stretch: 125%;
    color: transparent;
    -webkit-text-stroke: 1.5px var(--ink);
  }
  ol {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  li {
    display: flex;
    align-items: center;
    gap: 10px;
    font: 600 16px/1 var(--body);
  }
  li i {
    width: 18px;
    height: 5px;
    border-radius: 3px;
  }
  li b {
    margin-left: auto;
    font: 800 20px/1 var(--display);
    font-stretch: 125%;
  }
  li em {
    font: 700 12px/1 var(--body);
    font-style: normal;
    color: var(--accent);
  }
  li.out {
    opacity: 0.4;
  }
</style>
