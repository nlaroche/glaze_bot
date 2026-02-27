<script lang="ts">
  import type { ArrowCommand } from '@glazebot/shared-types';
  import { onMount } from 'svelte';

  let { command }: { command: ArrowCommand } = $props();

  let x1 = $derived(command.from.x * 100);
  let y1 = $derived(command.from.y * 100);
  let x2 = $derived(command.to.x * 100);
  let y2 = $derived(command.to.y * 100);
  let color = $derived(command.color || '#FFD700');
  let thickness = $derived(command.thickness || 3);

  let labelX = $derived((x1 + x2) / 2);
  let labelY = $derived((y1 + y2) / 2 - 1.5);

  // Angle of the main line in radians
  let angleRad = $derived(Math.atan2(y2 - y1, x2 - x1));

  // Arrowhead whisker length (in % units, matching the line coords)
  let whiskerLen = $derived(thickness * 1.2);
  // Whisker splay angle (30 degrees off the shaft)
  const SPLAY = Math.PI / 6;

  // Left whisker endpoint (branches back-left from the tip)
  let wl_x = $derived(x2 - whiskerLen * Math.cos(angleRad - SPLAY));
  let wl_y = $derived(y2 - whiskerLen * Math.sin(angleRad - SPLAY));
  // Right whisker endpoint (branches back-right from the tip)
  let wr_x = $derived(x2 - whiskerLen * Math.cos(angleRad + SPLAY));
  let wr_y = $derived(y2 - whiskerLen * Math.sin(angleRad + SPLAY));

  let lineEl: SVGLineElement | undefined = $state();
  let whiskerLeftEl: SVGLineElement | undefined = $state();
  let whiskerRightEl: SVGLineElement | undefined = $state();
  let showLabel = $state(false);

  const DRAW_SPEED = 1.5;
  const WHISKER_DURATION = 100;

  function drawStroke(el: SVGLineElement, duration: number): Animation {
    const len = el.getTotalLength?.() || 100;
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len}`;
    return el.animate(
      [{ strokeDashoffset: `${len}` }, { strokeDashoffset: '0' }],
      { duration, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
    );
  }

  onMount(() => {
    if (!lineEl) return;
    const shaftLen = lineEl.getTotalLength?.() || 200;
    const shaftDuration = Math.max(150, Math.min(shaftLen / DRAW_SPEED, 600));

    const shaftAnim = drawStroke(lineEl, shaftDuration);

    shaftAnim.onfinish = () => {
      if (whiskerLeftEl) drawStroke(whiskerLeftEl, WHISKER_DURATION);
      if (whiskerRightEl) drawStroke(whiskerRightEl, WHISKER_DURATION);
      showLabel = true;
    };
  });
</script>

<!-- Main shaft -->
<line
  bind:this={lineEl}
  x1="{x1}%" y1="{y1}%"
  x2="{x2}%" y2="{y2}%"
  stroke={color}
  stroke-width={thickness}
  stroke-linecap="round"
/>

<!-- Left whisker -->
<line
  bind:this={whiskerLeftEl}
  x1="{x2}%" y1="{y2}%"
  x2="{wl_x}%" y2="{wl_y}%"
  stroke={color}
  stroke-width={thickness}
  stroke-linecap="round"
/>

<!-- Right whisker -->
<line
  bind:this={whiskerRightEl}
  x1="{x2}%" y1="{y2}%"
  x2="{wr_x}%" y2="{wr_y}%"
  stroke={color}
  stroke-width={thickness}
  stroke-linecap="round"
/>

{#if command.label && showLabel}
  <text
    x="{labelX}%"
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
    animation: label-fade 0.3s ease-out both;
  }
  @keyframes label-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
