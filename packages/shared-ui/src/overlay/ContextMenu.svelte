<script lang="ts">
  import { onMount } from 'svelte';

  interface MenuItem {
    label: string;
    icon?: string;
    onclick: () => void;
    disabled?: boolean;
    separator?: boolean;
  }

  interface Props {
    x: number;
    y: number;
    items: MenuItem[];
    onclose: () => void;
  }

  let { x, y, items, onclose }: Props = $props();

  let menuEl: HTMLDivElement | undefined = $state();
  let adjustedX = $state(x);
  let adjustedY = $state(y);

  onMount(() => {
    // Adjust position if menu would overflow viewport
    if (menuEl) {
      const rect = menuEl.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        adjustedX = x - rect.width;
      }
      if (rect.bottom > window.innerHeight) {
        adjustedY = y - rect.height;
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (menuEl && !menuEl.contains(e.target as Node)) {
        onclose();
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onclose();
    }

    // Delay listener to avoid catching the triggering right-click
    requestAnimationFrame(() => {
      window.addEventListener('click', handleClickOutside);
      window.addEventListener('contextmenu', handleClickOutside);
      window.addEventListener('keydown', handleEscape);
    });

    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('contextmenu', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  });
</script>

<div
  class="context-menu"
  bind:this={menuEl}
  style="left: {adjustedX}px; top: {adjustedY}px"
  role="menu"
>
  {#each items as item}
    {#if item.separator}
      <div class="separator"></div>
    {:else}
      <button
        class="menu-item"
        class:disabled={item.disabled}
        disabled={item.disabled}
        onclick={() => { item.onclick(); onclose(); }}
        role="menuitem"
      >
        {#if item.icon}
          <span class="icon">{item.icon}</span>
        {/if}
        {item.label}
      </button>
    {/if}
  {/each}
</div>

<style>
  .context-menu {
    position: fixed;
    z-index: 2000;
    min-width: 160px;
    padding: 4px;
    border-radius: 8px;
    background: rgba(16, 22, 36, 0.95);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.5),
      0 2px 8px rgba(0, 0, 0, 0.3);
    animation: menu-in 0.12s ease-out;
  }

  @keyframes menu-in {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-4px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 12px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--color-text-primary, #e2e8f0);
    font-size: 0.82rem;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
  }

  .menu-item:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
  }

  .menu-item.disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .icon {
    font-size: 0.9rem;
    width: 18px;
    text-align: center;
  }

  .separator {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 4px 8px;
  }
</style>
