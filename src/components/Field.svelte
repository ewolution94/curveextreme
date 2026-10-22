<script lang="ts">
  // The field: three canvases (trail, top, fog) at the size the settings ask for, drawn every frame
  // from the world. "Like the original" draws one unit as window height ÷ 922 px, whatever the field
  // (a duel is a smallish square, as in the reference's replays); "fill" uses all the room there is.
  import { onMount, type Snippet } from 'svelte';
  import { Renderer } from '../lib/render';
  import type { World } from '../lib/world';
  import type { Pending } from '../lib/predict';
  import type { FieldSize } from '../lib/prefs.svelte';

  type Props = {
    world: World;
    own: Set<string>;
    predict: boolean;
    aheadMs: () => number;
    behindTicks: number;
    inputFor: (pid: string) => { dir0: number; pending: Pending[] };
    colourOf: (pid: string) => string;
    size: FieldSize;
    children?: Snippet;
  };
  let { world, own, predict, aheadMs, behindTicks, inputFor, colourOf, size, children }: Props = $props();

  const REFERENCE_UNITS = 922;
  let stage: HTMLDivElement;
  let trailCv: HTMLCanvasElement;
  let topCv: HTMLCanvasElement;
  let fogCv: HTMLCanvasElement;
  let cssW = $state(300);
  let cssH = $state(300);

  onMount(() => {
    const renderer = new Renderer(trailCv, topCv, fogCv);
    let laidW = 0, laidH = 0, laidBox = '';
    const coarse = matchMedia('(pointer: coarse)');

    function layout(force = false) {
      const boxW = stage.clientWidth, boxH = stage.clientHeight;
      const key = `${boxW}x${boxH}:${size}:${coarse.matches}:${window.innerHeight}`;
      if (!force && key === laidBox && laidW === world.W && laidH === world.H) return;
      laidBox = key;
      laidW = world.W;
      laidH = world.H;
      let s = Math.min(boxW / world.W, boxH / world.H);
      const reference = size === 'reference' || (size === 'auto' && !coarse.matches);
      if (reference) s = Math.min(s, window.innerHeight / REFERENCE_UNITS);
      cssW = Math.max(1, Math.floor(world.W * s));
      cssH = Math.max(1, Math.floor(world.H * s));
      renderer.resize(world, cssW, cssH, colourOf);
    }

    const off = world.onEvent((ev) => {
      if (ev.e === 'die') {
        const c = world.curves.get(ev.cid);
        renderer.burst(ev.x, ev.y, colourOf(ev.pid), c?.m.w ?? 6.9, performance.now());
      }
    });

    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      layout();
      renderer.frame(world, { now, own, predict, aheadMs: aheadMs(), behindTicks, inputFor, colourOf });
    };
    raf = requestAnimationFrame(frame);
    const ro = new ResizeObserver(() => layout(true));
    ro.observe(stage);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      off();
    };
  });
</script>

<div class="stage" bind:this={stage}>
  <div class="field" style:width="{cssW}px" style:height="{cssH}px">
    <canvas bind:this={trailCv}></canvas>
    <canvas bind:this={topCv}></canvas>
    <canvas bind:this={fogCv}></canvas>
    {@render children?.()}
  </div>
</div>

<style>
  .stage {
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: grid;
    place-items: center;
  }
  .field {
    position: relative;
    background: #000;
    outline: 1.5px solid #fff;
  }
  canvas {
    position: absolute;
    inset: 0;
    display: block;
  }
</style>
