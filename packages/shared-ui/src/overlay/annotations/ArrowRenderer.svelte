<script lang="ts">
  import type { ArrowCommand } from '@glazebot/shared-types';
  import { onMount } from 'svelte';

  interface Props {
    command: ArrowCommand;
    animationSpeed?: number;
    strokeWidth?: number;
    dropShadow?: boolean;
  }

  let { command, animationSpeed = 1.0, strokeWidth = 3, dropShadow = true }: Props = $props();

  let x1 = $derived(command.from.x * 100);
  let y1 = $derived(command.from.y * 100);
  let x2 = $derived(command.to.x * 100);
  let y2 = $derived(command.to.y * 100);
  let color = $derived(command.color || '#FFD700');
  let thickness = $derived(command.thickness || strokeWidth);

  let labelX = $derived((x1 + x2) / 2);
  let labelY = $derived((y1 + y2) / 2 - 1.5);

  let angleRad = $derived(Math.atan2(y2 - y1, x2 - x1));
  let whiskerLen = $derived(thickness * 1.2);
  const SPLAY = Math.PI / 6;
  let wl_x = $derived(x2 - whiskerLen * Math.cos(angleRad - SPLAY));
  let wl_y = $derived(y2 - whiskerLen * Math.sin(angleRad - SPLAY));
  let wr_x = $derived(x2 - whiskerLen * Math.cos(angleRad + SPLAY));
  let wr_y = $derived(y2 - whiskerLen * Math.sin(angleRad + SPLAY));

  let lineEl: SVGLineElement | undefined = $state();
  let whiskerLeftEl: SVGLineElement | undefined = $state();
  let whiskerRightEl: SVGLineElement | undefined = $state();
  let showLabel = $state(false);

  const BASE_DRAW_SPEED = 0.8;
  const BASE_WHISKER_DURATION = 200;

  function drawStroke(el: SVGLineElement, duration: number): Animation {
    const len = el.getTotalLength?.() || 100;
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len}`;
    return el.animate(
      [{ strokeDashoffset: `${len}` }, { strokeDashoffset: '0' }],
      { duration, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
    );
  }

  function hideStroke(el: SVGLineElement) {
    const len = el.getTotalLength?.() || 100;
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len}`;
  }

  onMount(() => {
    if (!lineEl) return;

    // Hide whiskers immediately so they don't show during shaft draw
    if (whiskerLeftEl) hideStroke(whiskerLeftEl);
    if (whiskerRightEl) hideStroke(whiskerRightEl);

    const speed = animationSpeed;
    const drawSpeed = BASE_DRAW_SPEED / speed;
    const shaftLen = lineEl.getTotalLength?.() || 200;
    const shaftDuration = Math.max(400, Math.min(shaftLen / drawSpeed, 1000)) * speed;

    const shaftAnim = drawStroke(lineEl, shaftDuration);

    shaftAnim.onfinish = () => {
      const whiskerDur = BASE_WHISKER_DURATION * speed;
      if (whiskerLeftEl) drawStroke(whiskerLeftEl, whiskerDur);
      if (whiskerRightEl) drawStroke(whiskerRightEl, whiskerDur);
      showLabel = true;
    };
  });
</script>

<g filter={dropShadow ? 'url(#annotation-shadow)' : undefined}>
<line
  bind:this={lineEl}
  x1="{x1}%" y1="{y1}%"
  x2="{x2}%" y2="{y2}%"
  stroke={color}
  stroke-width={thickness}
  stroke-linecap="round"
/>
<line
  bind:this={whiskerLeftEl}
  x1="{x2}%" y1="{y2}%"
  x2="{wl_x}%" y2="{wl_y}%"
  stroke={color}
  stroke-width={thickness}
  stroke-linecap="round"
/>
<line
  bind:this={whiskerRightEl}
  x1="{x2}%" y1="{y2}%"
  x2="{wr_x}%" y2="{wr_y}%"
  stroke={color}
  stroke-width={thickness}
  stroke-linecap="round"
/>
</g>

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
