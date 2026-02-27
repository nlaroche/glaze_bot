<script lang="ts">
  import type { CircleCommand } from '@glazebot/shared-types';
  import { onMount } from 'svelte';

  let { command }: { command: CircleCommand } = $props();

  let cx = $derived(command.center.x * 100);
  let cy = $derived(command.center.y * 100);
  let r = $derived(command.radius * 100);
  let color = $derived(command.color || '#FF4444');
  let thickness = $derived(command.thickness || 3);
  let fillOpacity = $derived(command.fill_opacity ?? 0);
  let labelY = $derived(cy - r - 1.5);

  let circleEl: SVGCircleElement | undefined = $state();

  onMount(() => {
    if (!circleEl) return;
    // Draw the circle like a pen tracing the circumference
    const circumference = circleEl.getTotalLength?.() || (2 * Math.PI * 50);
    circleEl.style.strokeDasharray = `${circumference}`;
    circleEl.style.strokeDashoffset = `${circumference}`;
    circleEl.animate(
      [
        { strokeDashoffset: `${circumference}` },
        { strokeDashoffset: '0' },
      ],
      { duration: 500, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
    );
  });
</script>

<circle
  bind:this={circleEl}
  cx="{cx}%"
  cy="{cy}%"
  r="{r}%"
  stroke={color}
  stroke-width={thickness}
  fill={fillOpacity > 0 ? color : 'none'}
  fill-opacity={fillOpacity}
  stroke-linecap="round"
/>
{#if command.label}
  <text
    x="{cx}%"
    y="{labelY}%"
    fill={color}
    font-size="14"
    font-weight="bold"
    text-anchor="middle"
    class="label-text"
    style="text-shadow: 0 1px 4px rgba(0,0,0,0.8);"
  >{command.label}</text>
{/if}

<style>
  .label-text {
    animation: label-fade 0.3s ease-out 0.5s both;
  }
  @keyframes label-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
