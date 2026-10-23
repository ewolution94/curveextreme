<script lang="ts">
  // The field: four canvases (floor, trail, top, fog) at the size the settings ask for. Every
  // animation frame simulates the round up to the clock (runner.ts) and draws it. The square arena is
  // the field itself (a black box in a thin line); the other shapes are drawn on the floor canvas. "Like the original" draws one
  // unit as window height ÷ 922 px, whatever the field (a duel is a smallish square, as in the
  // reference's replays); "fill" uses all the room there is.
  import { onMount, type Snippet } from 'svelte';
  import { Renderer } from '../lib/render';
  import type { RoundRunner } from '../lib/runner';
  import type { FieldSize } from '../lib/prefs.svelte';

  type Props = {
    runner: RoundRunner;
    colourOf: (player: number) => string;
    size: FieldSize;
    /** Size the field from the parent's box minus this many px (the board beside it), and hug it. */
    reserve?: number;
    /** The field's width in CSS px, for a layout around it. */
    width?: number;
    height?: number;
    children?: Snippet;
  };
  let { runner, colourOf, size, reserve = -1, width = $bindable(0), height = $bindable(0), children }: Props = $props();

  const REFERENCE_UNITS = 922;
  let stage: HTMLDivElement;
  let floorCv: HTMLCanvasElement;
  let trailCv: HTMLCanvasElement;
  let topCv: HTMLCanvasElement;
  let fogCv: HTMLCanvasElement;
  let cssW = $state(300);
  let cssH = $state(300);
  let open = $state(false);
  let shaped = $state(false);
  const hug = $derived(reserve >= 0);

  // a crash bursts where it happened, in the curve's colour
  let renderer: Renderer | null = null;
  $effect(() => {
    const r = runner;
    return r.on((e) => {
      if (e.e !== 'die' || !renderer) return;
      const c = r.round.s.curves.find((x: any) => x.id === e.cid);
      renderer.burst(e.x, e.y, colourOf(e.p), c ? r.round.motion(c).w : 6.9, performance.now());
    });
  });

  onMount(() => {
    const ren = (renderer = new Renderer(floorCv, trailCv, topCv, fogCv));
    let laidW = 0, laidH = 0, laidBox = '';
    const coarse = matchMedia('(pointer: coarse)');

    function layout(force = false) {
      const W = runner.round.W, H = runner.round.H;
      const host = reserve >= 0 ? stage.parentElement! : stage;
      const boxW = host.clientWidth - Math.max(0, reserve), boxH = host.clientHeight;
      const key = `${boxW}x${boxH}:${size}:${coarse.matches}:${window.innerHeight}:${reserve}`;
      if (!force && key === laidBox && laidW === W && laidH === H) return;
      laidBox = key;
      laidW = W;
      laidH = H;
      let s = Math.min(boxW / W, boxH / H);
      const reference = size === 'reference' || (size === 'auto' && !coarse.matches);
      if (reference) s = Math.min(s, window.innerHeight / REFERENCE_UNITS);
      cssW = Math.max(1, Math.floor(W * s));
      cssH = Math.max(1, Math.floor(H * s));
      width = cssW;
      height = cssH;
      ren.resize(W, cssW, cssH);
    }

    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      layout();
      const T = runner.tick(now);
      ren.frame(runner, { now, T, colourOf });
      // Open Walls (blue, everyone): the edge turns dashed while it runs
      let wraps = false;
      for (const c of runner.round.s.curves) if (c.alive && c.effects.some((e: any) => e.kind === 'openWalls' || e.kind === 'greenOpenWalls')) wraps = true;
      if (wraps !== open) open = wraps;
      const isShaped = runner.round.floor.shape !== 'square';
      if (isShaped !== shaped) shaped = isShaped;
    };
    raf = requestAnimationFrame(frame);
    const ro = new ResizeObserver(() => layout(true));
    ro.observe(stage);
    if (stage.parentElement) ro.observe(stage.parentElement);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer = null;
    };
  });
</script>

<div class="stage" class:hug bind:this={stage} style:width={hug ? `${cssW}px` : null} style:height={hug ? `${cssH}px` : null}>
  <div class="field" class:open class:shaped style:width="{cssW}px" style:height="{cssH}px">
    <canvas bind:this={floorCv}></canvas>
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
  /* a shaped arena draws its own floor and edge (render.ts) */
  .field.shaped {
    background: transparent;
    outline: none;
  }
  canvas {
    position: absolute;
    inset: 0;
    display: block;
  }
</style>
