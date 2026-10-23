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
    /** Size the field from the parent's box minus this many px (the board beside it), and hug it. */
    reserve?: number;
    /** The field's width in CSS px, for a layout around it. */
    width?: number;
    height?: number;
    children?: Snippet;
  };
  let { world, own, predict, aheadMs, behindTicks, inputFor, colourOf, size, reserve = -1, width = $bindable(0), height = $bindable(0), children }: Props = $props();

  const REFERENCE_UNITS = 922;
  let stage: HTMLDivElement;
  let trailCv: HTMLCanvasElement;
  let topCv: HTMLCanvasElement;
  let fogCv: HTMLCanvasElement;
  let cssW = $state(300);
  let cssH = $state(300);
  let open = $state(false);
  const hug = $derived(reserve >= 0);

  onMount(() => {
    const renderer = new Renderer(trailCv, topCv, fogCv);
    let laidW = 0, laidH = 0, laidBox = '';
    const coarse = matchMedia('(pointer: coarse)');

    function layout(force = false) {
      const host = reserve >= 0 ? stage.parentElement! : stage;
      const boxW = host.clientWidth - Math.max(0, reserve), boxH = host.clientHeight;
      const key = `${boxW}x${boxH}:${size}:${coarse.matches}:${window.innerHeight}:${reserve}`;
      if (!force && key === laidBox && laidW === world.W && laidH === world.H) return;
      laidBox = key;
      laidW = world.W;
      laidH = world.H;
      let s = Math.min(boxW / world.W, boxH / world.H);
      const reference = size === 'reference' || (size === 'auto' && !coarse.matches);
      if (reference) s = Math.min(s, window.innerHeight / REFERENCE_UNITS);
      cssW = Math.max(1, Math.floor(world.W * s));
      width = cssW;
      height = cssH;
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
      // Open Walls (blue, everyone): the edge turns dashed while it runs
      let wraps = false;
      for (const c of world.curves.values()) if (c.alive && c.m.fx?.some(([kind]) => kind === 'openWalls')) wraps = true;
      if (wraps !== open) open = wraps;
    };
    raf = requestAnimationFrame(frame);
    const ro = new ResizeObserver(() => layout(true));
    ro.observe(stage);
    if (stage.parentElement) ro.observe(stage.parentElement);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      off();
    };
  });
</script>

<div class="stage" class:hug bind:this={stage} style:width={hug ? `${cssW}px` : null} style:height={hug ? `${cssH}px` : null}>
  <div class="field" class:open style:width="{cssW}px" style:height="{cssH}px">
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
  .stage.hug {
    flex: none;
    align-self: center;
  }
  .field {
    position: relative;
    background: #000;
    outline: 1.5px solid var(--edge, #e9e9ea);
    container-type: inline-size;
  }
  .field.open {
    outline-style: dashed;
    outline-color: #7fa9ff;
  }
  canvas {
    position: absolute;
    inset: 0;
    display: block;
  }
</style>
