<script lang="ts">
  import type { StampCommand, StampIcon } from '@glazebot/shared-types';

  let { command }: { command: StampCommand } = $props();

  const ICON_MAP: Record<StampIcon, string> = {
    checkmark: '\u2705',
    crossmark: '\u274C',
    question: '\u2753',
    exclamation: '\u2757',
    crown: '\uD83D\uDC51',
    trophy: '\uD83C\uDFC6',
    target: '\uD83C\uDFAF',
    sword: '\u2694\uFE0F',
    shield: '\uD83D\uDEE1\uFE0F',
    potion: '\uD83E\uDDEA',
  };

  let left = $derived(command.position.x * 100);
  let top = $derived(command.position.y * 100);
  let size = $derived(command.size || 48);
  let rotation = $derived(command.rotation || 0);
  let icon = $derived(ICON_MAP[command.icon] || '\u2753');
</script>

<div
  class="stamp"
  style="
    left: {left}%;
    top: {top}%;
    font-size: {size}px;
    transform: translate(-50%, -50%) rotate({rotation}deg);
  "
>
  {icon}
</div>

<style>
  .stamp {
    position: absolute;
    pointer-events: none;
    animation: stamp-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    line-height: 1;
    filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.5));
  }
  @keyframes stamp-pop {
    0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
    60% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
    100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  }
</style>
