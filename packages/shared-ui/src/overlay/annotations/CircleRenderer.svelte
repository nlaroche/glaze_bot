<script lang="ts">
  import type { CircleCommand } from '@glazebot/shared-types';
  import { onMount } from 'svelte';

  interface Props {
    command: CircleCommand;
    animationSpeed?: number;
    strokeWidth?: number;
    dropShadow?: boolean;
  }

  let { command, animationSpeed = 1.0, strokeWidth = 3, dropShadow = true }: Props = $props();

  let cx = $derived(command.center.x * 100);
  let cy = $derived(command.center.y * 100);
  let r = $derived(command.radius * 100);
  let color = $derived(command.color || '#FF4444');
  let thickness = $derived(command.thickness || strokeWidth);
  let fillOpacity = $derived(command.fill_opacity ?? 0);
  let labelY = $derived(cy - r - 1.5);

  let circleEl: SVGCircleElement | undefined = $state();

  onMount(() => {
    if (!circleEl) return;
    const circumference = circleEl.getTotalLength?.() || (2 * Math.PI * 50);
    circleEl.style.strokeDasharray = `${circumference}`;
    circleEl.style.strokeDashoffset = `${circumference}`;
    circleEl.animate(
      [
        { strokeDashoffset: `${circumference}` },
        { strokeDashoffset: '0' },
      ],
      { duration: 900 * animationSpeed, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
    );
  });
</script>

<g filter={dropShadow ? 'url(#annotation-shadow)' : undefined}>
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
    style="text-shadow: 0 1px 4px rgba(0,0,0,0.8); animation-delay: {0.9 * animationSpeed}s;"
  >{command.label}</text>
{/if}
</g>

<style>
  .label-text {
    animation: label-fade 0.3s ease-out both;
    animation-delay: 0.9s;
  }
  @keyframes label-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
