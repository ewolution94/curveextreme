<!--
  The seal maker: Folio's emblem maker in the token theme (vendor/ewo; development/plans/emblems.md),
  arrows either side of the big seal like the other games' makers, one pair per part, top to bottom
  (colours, division, charge), and a dice for all three. In look A: thin light lines on the black,
  Ultraviolet for the part's name. From Würfle's AvatarMaker.svelte.
-->
<script lang="ts">
  import type { Avatar as AvatarValue } from '../lib/avatar';

  let { avatar, onchange }: { avatar: AvatarValue; onchange: (next: AvatarValue) => void } = $props();
</script>

<ewo-emblem-maker class="maker" theme="token" value={avatar} onchange={(e) => onchange(e.detail.value as AvatarValue)}></ewo-emblem-maker>

<style>
  .maker {
    gap: 14px;
    --ewo-emblem-maker-inset: 6%;
    --ewo-emblem-ink: var(--ground);
  }
  .maker::part(arrow) {
    padding: 0;
    border: 1.5px solid rgb(255 255 255 / 0.28);
    border-radius: 8px;
    background: var(--panel-2);
    color: var(--ink);
    -webkit-tap-highlight-color: transparent;
  }
  @media (hover: hover) {
    .maker::part(arrow):hover {
      border-color: var(--accent);
      background: rgb(176 122 255 / 0.16);
    }
  }
  .maker::part(arrow):active {
    border-color: var(--accent);
    background: rgb(176 122 255 / 0.24);
  }
  .maker::part(arrow):focus-visible,
  .maker::part(dice):focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .maker::part(stage) {
    margin-inline: 4px;
    border-radius: 50%;
    box-shadow: 0 12px 22px -12px rgb(0 0 0 / 0.9);
  }
  .maker::part(tag) {
    z-index: 2;
    padding: 5px 10px 4px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--accent-ink);
    font: 700 12px/1 var(--body);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .maker::part(legend) {
    margin: 2px 0 0;
    font-size: 12px;
    color: var(--muted);
  }
  .maker::part(dice) {
    min-height: 36px;
    padding: 0 14px;
    border: 1.5px solid rgb(255 255 255 / 0.28);
    border-radius: var(--radius);
    background: transparent;
    color: var(--ink);
    font: 650 15px / 1.2 var(--body);
    -webkit-tap-highlight-color: transparent;
    transition: transform var(--ewo-dur-1) var(--ewo-ease);
  }
  @media (hover: hover) and (pointer: fine) {
    .maker::part(dice):hover {
      background: rgb(255 255 255 / 0.06);
    }
    .maker::part(dice):active {
      transform: scale(0.97);
    }
  }
</style>
