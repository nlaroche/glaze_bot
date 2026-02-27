<script lang="ts">
  import type { VisualCommand } from '@glazebot/shared-types';
  import { getActiveVisuals } from './primitiveRegistry';

  // SVG renderers
  import ArrowRenderer from './renderers/ArrowRenderer.svelte';
  import CircleRenderer from './renderers/CircleRenderer.svelte';
  import HighlightRectRenderer from './renderers/HighlightRectRenderer.svelte';
  import FreehandPathRenderer from './renderers/FreehandPathRenderer.svelte';

  // HTML renderers
  import StatComparisonRenderer from './renderers/StatComparisonRenderer.svelte';
  import InfoTableRenderer from './renderers/InfoTableRenderer.svelte';
  import FloatingTextRenderer from './renderers/FloatingTextRenderer.svelte';
  import StampRenderer from './renderers/StampRenderer.svelte';

  // Canvas renderers
  import EmoteBurstRenderer from './renderers/EmoteBurstRenderer.svelte';
  import ScreenFlashRenderer from './renderers/ScreenFlashRenderer.svelte';

  let visuals = $derived(getActiveVisuals());

  const SVG_PRIMITIVES = new Set(['arrow', 'circle', 'highlight_rect']);
  const HTML_PRIMITIVES = new Set(['stat_comparison', 'info_table', 'floating_text', 'stamp']);
  const CANVAS_PRIMITIVES = new Set(['emote_burst', 'screen_flash']);

  let svgVisuals = $derived(visuals.filter((v) => SVG_PRIMITIVES.has(v.primitive)));
  let htmlVisuals = $derived(visuals.filter((v) => HTML_PRIMITIVES.has(v.primitive)));
  let canvasVisuals = $derived(visuals.filter((v) => CANVAS_PRIMITIVES.has(v.primitive)));
</script>

{#if visuals.length > 0}
  <!-- SVG Layer -->
  {#if svgVisuals.length > 0}
    <svg class="visual-svg-layer">
      {#each svgVisuals as cmd (cmd.id)}
        {#if cmd.primitive === 'arrow'}
          <ArrowRenderer command={cmd as any} />
        {:else if cmd.primitive === 'circle'}
          <CircleRenderer command={cmd as any} />
        {:else if cmd.primitive === 'highlight_rect'}
          <HighlightRectRenderer command={cmd as any} />
        {/if}
      {/each}
    </svg>
  {/if}

  <!-- Freehand paths get their own SVG (viewBox-based) -->
  {#each visuals.filter((v) => v.primitive === 'freehand_path') as cmd (cmd.id)}
    <FreehandPathRenderer command={cmd as any} />
  {/each}

  <!-- HTML Layer -->
  {#if htmlVisuals.length > 0}
    <div class="visual-html-layer">
      {#each htmlVisuals as cmd (cmd.id)}
        {#if cmd.primitive === 'stat_comparison'}
          <StatComparisonRenderer command={cmd as any} />
        {:else if cmd.primitive === 'info_table'}
          <InfoTableRenderer command={cmd as any} />
        {:else if cmd.primitive === 'floating_text'}
          <FloatingTextRenderer command={cmd as any} />
        {:else if cmd.primitive === 'stamp'}
          <StampRenderer command={cmd as any} />
        {/if}
      {/each}
    </div>
  {/if}

  <!-- Canvas Layer -->
  {#each canvasVisuals as cmd (cmd.id)}
    {#if cmd.primitive === 'emote_burst'}
      <EmoteBurstRenderer command={cmd as any} />
    {:else if cmd.primitive === 'screen_flash'}
      <ScreenFlashRenderer command={cmd as any} />
    {/if}
  {/each}
{/if}

<style>
  .visual-svg-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
  }
  .visual-html-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
</style>
