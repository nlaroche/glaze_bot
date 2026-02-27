<script lang="ts">
  import type { HighlightRectCommand } from '@glazebot/shared-types';
  import { onMount } from 'svelte';

  let { command }: { command: HighlightRectCommand } = $props();

  let x = $derived(command.origin.x * 100);
  let y = $derived(command.origin.y * 100);
  let w = $derived(command.width * 100);
  let h = $derived(command.height * 100);
  let color = $derived(command.color || '#FFD700');
  let fillOpacity = $derived(command.fill_opacity ?? 0.15);

  let rectEl: SVGRectElement | undefined = $state();

  onMount(() => {
    if (!rectEl) return;
    // Draw the rectangle border like a pen tracing the perimeter
    const perimeter = rectEl.getTotalLength?.() || 400;
    rectEl.style.strokeDasharray = `${perimeter}`;
    rectEl.style.strokeDashoffset = `${perimeter}`;
    rectEl.animate(
      [
        { strokeDashoffset: `${perimeter}` },
        { strokeDashoffset: '0' },
      ],
      { duration: 500, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
    );
  });
</script>

<!-- Fill rect (fades in after stroke draws) -->
<rect
  x="{x}%"
  y="{y}%"
  width="{w}%"
  height="{h}%"
  fill={color}
  fill-opacity={fillOpacity}
  rx="4"
  stroke="none"
  class="fill-rect"
/>
<!-- Stroke rect (draws in) -->
<rect
  bind:this={rectEl}
  x="{x}%"
  y="{y}%"
  width="{w}%"
  height="{h}%"
  stroke={color}
  stroke-width="2"
  fill="none"
  rx="4"
  stroke-linecap="round"
/>

<style>
  .fill-rect {
    animation: fill-fade 0.3s ease-out 0.45s both;
  }
  @keyframes fill-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
