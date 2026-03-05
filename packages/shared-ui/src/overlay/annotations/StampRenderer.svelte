<script lang="ts">
  import type { StampCommand, StampIcon } from '@glazebot/shared-types';
  import { motion } from '../../motion/index.js';

  interface Props {
    command: StampCommand;
    animationSpeed?: number;
  }

  let { command, animationSpeed = 1.0 }: Props = $props();

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
  let popDuration = $derived(0.6 * animationSpeed);
</script>

<div
  class="stamp"
  style="
    left: {left}%;
    top: {top}%;
    font-size: {size}px;
    transform: translate(-50%, -50%) rotate({rotation}deg);
  "
  use:motion={'pop'}
>
  {icon}
</div>

<style>
  .stamp {
    position: absolute;
    pointer-events: none;
    line-height: 1;
    filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.5));
  }
</style>
