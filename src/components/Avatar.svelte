<!--
  A player's seal from their three numbers, drawn by Folio's token emblem (src/lib/avatar.ts), as in
  the newest games; ringed in the arena's black.
-->
<script lang="ts">
  import type { Avatar } from '../lib/avatar';

  let { avatar, size = 40, ring = true }: { avatar: Avatar; size?: number; ring?: boolean } = $props();
</script>

<ewo-emblem class="av" theme="token" value={avatar} {size} {ring}></ewo-emblem>

<style>
  .av {
    flex: none;
    --ewo-emblem-ink: var(--ground);
    --ewo-emblem-paper: var(--ink);
  }
</style>
