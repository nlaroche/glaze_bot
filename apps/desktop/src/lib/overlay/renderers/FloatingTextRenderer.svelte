<script lang="ts">
  import type { FloatingTextCommand } from '@glazebot/shared-types';
  import { motion } from '@glazebot/shared-ui';

  let { command }: { command: FloatingTextCommand } = $props();

  let color = $derived(command.color || '#FFFFFF');
  let fontSize = $derived(command.font_size || 48);
  let animation = $derived(command.animation || 'rise');
  // Map rise/slam to motion types, others stay as CSS
  let motionType = $derived(
    animation === 'rise' ? 'enter-bottom' as const :
    animation === 'slam' ? 'land' as const :
    null
  );
  let durationMs = $derived(command.duration_ms || 4000);

  let positionStyle = $derived(anchorToCSS(command.position || 'center'));

  function anchorToCSS(anchor: string): string {
    const map: Record<string, string> = {
      'top-left': 'top: 10%; left: 10%;',
      'top-center': 'top: 10%; left: 50%; transform: translateX(-50%);',
      'top-right': 'top: 10%; right: 10%;',
      'center-left': 'top: 50%; left: 10%; transform: translateY(-50%);',
      'center': 'top: 50%; left: 50%; transform: translate(-50%, -50%);',
      'center-right': 'top: 50%; right: 10%; transform: translateY(-50%);',
      'bottom-left': 'bottom: 10%; left: 10%;',
      'bottom-center': 'bottom: 10%; left: 50%; transform: translateX(-50%);',
      'bottom-right': 'bottom: 10%; right: 10%;',
    };
    return map[anchor] || map['center'];
  }
</script>

{#if motionType}
  <div
    class="floating-text"
    style="{positionStyle} color: {color}; font-size: {fontSize}px;"
    use:motion={motionType}
  >
    {command.text}
  </div>
{:else}
  <div
    class="floating-text anim-{animation}"
    style="{positionStyle} color: {color}; font-size: {fontSize}px; animation-duration: {durationMs}ms;"
  >
    {command.text}
  </div>
{/if}

<style>
  .floating-text {
    position: absolute;
    font-weight: 900;
    font-family: system-ui, sans-serif;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 0, 0, 0.4);
    white-space: nowrap;
    pointer-events: none;
    animation-fill-mode: forwards;
  }
  .anim-shake {
    animation-name: float-shake;
  }
  .anim-pulse {
    animation-name: float-pulse;
  }
  @keyframes float-shake {
    0% { opacity: 0; }
    10% { opacity: 1; }
    15% { transform: translateX(-4px); }
    20% { transform: translateX(4px); }
    25% { transform: translateX(-3px); }
    30% { transform: translateX(3px); }
    35% { transform: translateX(0); }
    80% { opacity: 1; }
    100% { opacity: 0; }
  }
  @keyframes float-pulse {
    0% { opacity: 0; transform: scale(0.8); }
    10% { opacity: 1; transform: scale(1); }
    20% { transform: scale(1.1); }
    30% { transform: scale(1); }
    50% { transform: scale(1.05); }
    60% { transform: scale(1); }
    80% { opacity: 1; }
    100% { opacity: 0; }
  }
</style>
