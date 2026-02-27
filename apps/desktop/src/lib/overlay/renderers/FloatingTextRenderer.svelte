<script lang="ts">
  import type { FloatingTextCommand } from '@glazebot/shared-types';

  let { command }: { command: FloatingTextCommand } = $props();

  let color = $derived(command.color || '#FFFFFF');
  let fontSize = $derived(command.font_size || 48);
  let animation = $derived(command.animation || 'rise');
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

<div
  class="floating-text anim-{animation}"
  style="{positionStyle} color: {color}; font-size: {fontSize}px; animation-duration: {durationMs}ms;"
>
  {command.text}
</div>

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
  .anim-rise {
    animation-name: float-rise;
  }
  .anim-shake {
    animation-name: float-shake;
  }
  .anim-pulse {
    animation-name: float-pulse;
  }
  .anim-slam {
    animation-name: float-slam;
  }

  @keyframes float-rise {
    0% { opacity: 0; transform: translateY(20px); }
    15% { opacity: 1; transform: translateY(0); }
    80% { opacity: 1; }
    100% { opacity: 0; transform: translateY(-40px); }
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
  @keyframes float-slam {
    0% { opacity: 0; transform: scale(3); }
    15% { opacity: 1; transform: scale(1); }
    20% { transform: scale(1.1); }
    25% { transform: scale(1); }
    80% { opacity: 1; }
    100% { opacity: 0; }
  }
</style>
