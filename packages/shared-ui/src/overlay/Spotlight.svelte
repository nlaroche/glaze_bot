<script lang="ts">
  import { onMount } from 'svelte';
  import { motion } from '../motion/index.js';

  interface Props {
    open: boolean;
    onclose: () => void;
    children: any;
  }

  let { open, onclose, children }: Props = $props();

  let visible = $state(false);
  let animating = $state(false);

  $effect(() => {
    if (open) {
      visible = true;
      animating = true;
    } else if (visible) {
      animating = false;
      const t = setTimeout(() => { visible = false; }, 120);
      return () => clearTimeout(t);
    }
  });

  function handleBackdropMousedown() {
    onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onclose();
    }
  }

  let backdropEl: HTMLDivElement | undefined = $state();

  onMount(() => {
    backdropEl?.focus();
  });
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="spotlight-backdrop"
    class:entering={animating}
    onmousedown={handleBackdropMousedown}
    onkeydown={handleKeydown}
    bind:this={backdropEl}
    tabindex={0}
    role="dialog"
    aria-modal="true"
  >
    <!-- stopPropagation prevents mousedown inside content from bubbling to backdrop -->
    <div class="spotlight-content" class:entering={animating} onmousedown={(e) => e.stopPropagation()} use:motion={{ type: 'scale-in', fast: true }}>
      {@render children()}
    </div>
  </div>
{/if}

<style>
  .spotlight-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0);
    backdrop-filter: blur(0px);
    -webkit-backdrop-filter: blur(0px);
    transition:
      background 0.12s ease,
      backdrop-filter 0.12s ease,
      -webkit-backdrop-filter 0.12s ease;
    outline: none;
  }

  .spotlight-backdrop.entering {
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
  }

  .spotlight-content {
    transition: opacity 0.1s ease, transform 0.1s ease;
  }

  .spotlight-content:not(.entering) {
    opacity: 0;
    transform: scale(0.95);
  }
</style>
