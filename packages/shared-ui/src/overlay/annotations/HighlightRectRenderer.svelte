<script lang="ts">
  import type { HighlightRectCommand } from '@glazebot/shared-types';
  import { onMount } from 'svelte';

  interface Props {
    command: HighlightRectCommand;
    animationSpeed?: number;
    strokeWidth?: number;
    dropShadow?: boolean;
  }

  let { command, animationSpeed = 1.0, strokeWidth = 3, dropShadow = true }: Props = $props();

  let x = $derived(command.origin.x * 100);
  let y = $derived(command.origin.y * 100);
  let w = $derived(command.width * 100);
  let h = $derived(command.height * 100);
  let color = $derived(command.color || '#FFD700');
  let fillOpacity = $derived(command.fill_opacity ?? 0.15);

  let rectEl: SVGRectElement | undefined = $state();

  onMount(() => {
    if (!rectEl) return;
    const perimeter = rectEl.getTotalLength?.() || 400;
    rectEl.style.strokeDasharray = `${perimeter}`;
    rectEl.style.strokeDashoffset = `${perimeter}`;
    rectEl.animate(
      [
        { strokeDashoffset: `${perimeter}` },
        { strokeDashoffset: '0' },
      ],
      { duration: 800 * animationSpeed, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
    );
  });
</script>

<g filter={dropShadow ? 'url(#annotation-shadow)' : undefined}>
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
  style="animation-delay: {0.75 * animationSpeed}s;"
/>
<rect
  bind:this={rectEl}
  x="{x}%"
  y="{y}%"
  width="{w}%"
  height="{h}%"
  stroke={color}
  stroke-width={strokeWidth}
  fill="none"
  rx="4"
  stroke-linecap="round"
/>
</g>

<style>
  .fill-rect {
    animation: fill-fade 0.3s ease-out both;
    animation-delay: 0.75s;
  }
  @keyframes fill-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
