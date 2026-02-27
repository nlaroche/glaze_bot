<script lang="ts">
  import type { FreehandPathCommand } from '@glazebot/shared-types';
  import { onMount } from 'svelte';

  let { command }: { command: FreehandPathCommand } = $props();

  let color = $derived(command.color || '#FF4444');
  let thickness = $derived(command.thickness || 3);

  // Use viewBox 0 0 1000 1000 and scale points for resolution independence
  let scaledPath = $derived(() => {
    const pts = command.points;
    if (pts.length < 2) return '';
    const parts = [`M ${pts[0].x * 1000} ${pts[0].y * 1000}`];
    for (let i = 1; i < pts.length; i++) {
      parts.push(`L ${pts[i].x * 1000} ${pts[i].y * 1000}`);
    }
    if (command.close_path) parts.push('Z');
    return parts.join(' ');
  });

  let pathEl: SVGPathElement | undefined = $state();

  onMount(() => {
    if (!pathEl) return;
    const len = pathEl.getTotalLength?.() || 500;
    pathEl.style.strokeDasharray = `${len}`;
    pathEl.style.strokeDashoffset = `${len}`;
    pathEl.animate(
      [
        { strokeDashoffset: `${len}` },
        { strokeDashoffset: '0' },
      ],
      { duration: 600, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
    );
  });
</script>

<svg viewBox="0 0 1000 1000" class="freehand-svg">
  <path
    bind:this={pathEl}
    d={scaledPath()}
    stroke={color}
    stroke-width={thickness}
    fill={command.close_path ? color : 'none'}
    fill-opacity={command.close_path ? 0.15 : 0}
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>

<style>
  .freehand-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
</style>
