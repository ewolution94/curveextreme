<script lang="ts">
  // Look A's name: a curve driven round into a C with one gap in it and the head (Ultraviolet) at its
  // end, then "Curve" heavy and "Extreme" light, both in wide Archivo (plans/curveextreme/looks.html).
  let { size = 'big' }: { size?: 'big' | 'small' | 'stack' } = $props();

  const SW = 5.2;
  const R = 16 - SW / 2 - 0.5;
  function arc(p: number, q: number) {
    const n = Math.ceil(Math.abs(q - p) / 0.06);
    let d = '';
    for (let i = 0; i <= n; i++) {
      const t = p + ((q - p) * i) / n;
      d += `${i ? 'L' : 'M'}${(16 + Math.cos(t) * R).toFixed(2)} ${(16 + Math.sin(t) * R).toFixed(2)}`;
    }
    return d;
  }
  const a0 = -0.72, a1 = -2 * Math.PI + 0.9, g = -2.5, gap = 0.46;
  const d = arc(a0, g + gap / 2) + arc(g - gap / 2, a1);
  const hx = (16 + Math.cos(a1) * R).toFixed(2);
  const hy = (16 + Math.sin(a1) * R).toFixed(2);
</script>

<span class="wm {size}" aria-label="CurveExtreme">
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <path {d} fill="none" stroke="var(--ink)" stroke-width={SW} stroke-linejoin="round" />
    <circle cx={hx} cy={hy} r={SW / 2} fill="var(--accent)" />
  </svg>
  <span class="word"><span class="w1">Curve</span><span class="w2">Extreme</span></span>
</span>

<style>
  .wm {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    font-family: var(--display);
    font-stretch: 125%;
    font-size: 30px;
    line-height: 1;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }
  svg {
    width: 1.15em;
    height: 1.15em;
    flex: none;
    overflow: visible;
  }
  .w1 {
    font-weight: 800;
  }
  .w2 {
    font-weight: 300;
  }
  .small {
    font-size: 21px;
  }
  .stack {
    display: grid;
    gap: 6px;
    font-size: 17px;
  }
  .stack .word {
    display: grid;
  }
</style>
