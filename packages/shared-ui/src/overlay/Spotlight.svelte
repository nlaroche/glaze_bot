<script lang="ts">
  import { onMount } from 'svelte';

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
      // Trigger enter animation next frame
      requestAnimationFrame(() => { animating = true; });
    } else if (visible) {
      animating = false;
      // Wait for exit animation
      const t = setTimeout(() => { visible = false; }, 350);
      return () => clearTimeout(t);
    }
  });

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onclose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onclose();
    }
  }

  let backdropEl: HTMLDivElement | undefined = $state();

  onMount(() => {
    // Focus trap
    backdropEl?.focus();
  });
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="spotlight-backdrop"
    class:entering={animating}
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    bind:this={backdropEl}
    tabindex={0}
    role="dialog"
    aria-modal="true"
  >
    <div class="spotlight-content" class:entering={animating}>
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
    /* Start state */
    background: rgba(0, 0, 0, 0);
    backdrop-filter: blur(0px);
    -webkit-backdrop-filter: blur(0px);
    transition:
      background 0.35s ease,
      backdrop-filter 0.35s ease,
      -webkit-backdrop-filter 0.35s ease;
    outline: none;
  }

  .spotlight-backdrop.entering {
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
  }

  .spotlight-content {
    transform: scale(0.85);
    opacity: 0;
    transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease;
  }

  .spotlight-content.entering {
    transform: scale(1);
    opacity: 1;
  }
</style>
