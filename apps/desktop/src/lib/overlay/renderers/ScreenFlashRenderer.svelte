<script lang="ts">
  import type { ScreenFlashCommand } from '@glazebot/shared-types';

  let { command }: { command: ScreenFlashCommand } = $props();

  let color = $derived(command.color || '#FF0000');
  let intensity = $derived(command.intensity || 0.3);
  let durationMs = $derived(command.duration_ms || 500);
</script>

<div
  class="screen-flash"
  style="background: {color}; opacity: {intensity}; animation-duration: {durationMs}ms;"
></div>

<style>
  .screen-flash {
    position: absolute;
    inset: 0;
    pointer-events: none;
    animation: flash-pulse ease-out forwards;
  }
  @keyframes flash-pulse {
    0% { opacity: var(--intensity, 0.3); }
    30% { opacity: var(--intensity, 0.3); }
    100% { opacity: 0; }
  }
</style>
