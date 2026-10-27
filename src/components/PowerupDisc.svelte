<script lang="ts">
  // One powerup's disc as the field draws it (src/lib/icons.ts), for the guide and the room's list.
  import { drawPowerup } from '../lib/icons';

  let { kind, size = 28 }: { kind: string; size?: number } = $props();
  let canvas: HTMLCanvasElement;

  $effect(() => {
    const dpr = Math.min(3, devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const g = canvas.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, canvas.width, canvas.height);
    // a little inside the edge: the faint reach ring around a diamond or hexagon sits on the radius
    drawPowerup(g, kind, canvas.width / 2, canvas.height / 2, canvas.width / 2 - Math.max(1.5, canvas.width * 0.03));
  });
</script>

<canvas bind:this={canvas} style:width="{size}px" style:height="{size}px" aria-hidden="true"></canvas>

<style>
  canvas {
    display: block;
    flex: none;
  }
</style>
