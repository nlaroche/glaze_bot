<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { getCurrentWebview } from '@tauri-apps/api/webview';

  let visible = $state(false);

  async function handleAction(action: string) {
    await invoke('tray_menu_action', { action });
  }

  async function closeMenu() {
    await invoke('close_tray_menu');
  }

  onMount(() => {
    // Fade in
    requestAnimationFrame(() => {
      visible = true;
    });

    // Close on blur (click outside)
    const onBlur = () => {
      closeMenu();
    };
    window.addEventListener('blur', onBlur);

    // Also listen for Escape key
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', onKeydown);

    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('keydown', onKeydown);
    };
  });
</script>

<div class="tray-menu" class:visible>
  <div class="header">
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal, #3B9797)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
      <line x1="9" y1="9" x2="9.01" y2="9"></line>
      <line x1="15" y1="9" x2="15.01" y2="9"></line>
    </svg>
    <span class="brand">GlazeBot</span>
  </div>

  <div class="separator"></div>

  <button class="menu-item" onclick={() => handleAction('show')}>
    <svg class="item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="9" y1="3" x2="9" y2="21"></line>
    </svg>
    <span>Show GlazeBot</span>
  </button>

  <button class="menu-item quit" onclick={() => handleAction('quit')}>
    <svg class="item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
      <line x1="12" y1="2" x2="12" y2="12"></line>
    </svg>
    <span>Quit</span>
  </button>

  <div class="separator"></div>

  <div class="footer">v0.0.1</div>
</div>

<style>
  :global(html),
  :global(body) {
    margin: 0;
    padding: 0;
    background: transparent !important;
    background-color: transparent !important;
    overflow: hidden;
  }

  .tray-menu {
    font-family: var(--font-brand, 'Plus Jakarta Sans', sans-serif);
    width: 200px;
    margin: 12px;
    padding: var(--space-2, 8px) 0;
    background: var(--color-navy, #0a0e18);
    border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.06));
    border-radius: var(--radius-xl, 10px);
    box-shadow:
      0 0 20px rgba(59, 151, 151, 0.15),
      0 8px 32px rgba(0, 0, 0, 0.5);
    opacity: 0;
    transform: scale(0.95) translateY(4px);
    transition: opacity 0.15s ease-out, transform 0.15s ease-out;
    user-select: none;
  }

  .tray-menu.visible {
    opacity: 1;
    transform: scale(1) translateY(0);
  }

  .header {
    display: flex;
    align-items: center;
    gap: var(--space-2, 8px);
    padding: var(--space-2, 8px) var(--space-3, 12px);
  }

  .icon {
    width: 18px;
    height: 18px;
    border-radius: var(--radius-sm, 4px);
  }

  .brand {
    font-size: var(--font-sm, 0.8rem);
    font-weight: 700;
    color: var(--color-pink, #FDB5CE);
    letter-spacing: 0.02em;
  }

  .separator {
    height: 1px;
    margin: var(--space-1, 4px) var(--space-3, 12px);
    background: var(--teal-a10, rgba(59, 151, 151, 0.1));
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: var(--space-2, 8px);
    width: calc(100% - var(--space-2, 8px) * 2);
    margin: 0 var(--space-1, 4px);
    padding: var(--space-2, 8px) var(--space-3, 12px);
    background: transparent;
    border: none;
    border-radius: var(--radius-md, 6px);
    color: var(--color-text-primary, #E8ECF1);
    font-family: inherit;
    font-size: var(--font-base, 0.875rem);
    cursor: pointer;
    transition: background 0.12s ease;
  }

  .menu-item:hover {
    background: var(--teal-a10, rgba(59, 151, 151, 0.1));
  }

  .menu-item:active {
    background: var(--teal-a20, rgba(59, 151, 151, 0.2));
  }

  .menu-item.quit:hover {
    background: rgba(239, 68, 68, 0.12);
  }

  .menu-item.quit:active {
    background: rgba(239, 68, 68, 0.2);
  }

  .item-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    opacity: 0.7;
  }

  .menu-item:hover .item-icon {
    opacity: 1;
  }

  .footer {
    padding: var(--space-1, 4px) var(--space-3, 12px);
    font-size: var(--font-xs, 0.7rem);
    color: var(--color-text-muted, #6B7788);
    text-align: center;
  }
</style>
