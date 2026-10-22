<script lang="ts">
  let { size = 'big' }: { size?: 'big' | 'small' } = $props();
</script>

<div class="mark {size}" aria-label="CurveExtreme">
  <svg viewBox="0 0 120 40" aria-hidden="true">
    <path d="M4 34 C 22 34, 26 6, 52 6 S 84 30, 104 20" fill="none" stroke="var(--accent)" stroke-width="5" />
    <path d="M60 14 l 0 0" stroke="#000" stroke-width="7" />
    <circle cx="104" cy="20" r="3.4" fill="var(--accent)" />
  </svg>
  <span class="word"><span>Curve</span><span class="x">Extreme</span></span>
</div>

<style>
  .mark {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  svg {
    width: 72px;
    height: auto;
    flex: none;
  }
  .word {
    display: flex;
    flex-direction: column;
    font: 800 30px/0.95 var(--display);
    text-transform: uppercase;
    letter-spacing: 0.01em;
  }
  .x {
    color: var(--accent);
  }
  .small svg {
    width: 40px;
  }
  .small .word {
    font-size: 15px;
    flex-direction: row;
    gap: 0.35em;
  }
</style>
