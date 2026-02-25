<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { getAuthState, initializeAuth } from '$lib/stores/auth.svelte';

  let { children } = $props();
  const auth = getAuthState();

  onMount(() => {
    initializeAuth();
  });

  // Redirect unauthenticated users to /login (except if already on /login)
  $effect(() => {
    if (!auth.loading && !auth.isAuthenticated && !$page.url.pathname.startsWith('/login')) {
      goto('/login');
    }
  });

  const navItems = [
    { href: '/pack', label: 'Packs', icon: '📦' },
    { href: '/collection', label: 'Collection', icon: '🃏' },
    { href: '/settings', label: 'Settings', icon: '⚙' },
  ];
</script>

{#if auth.loading}
  <div class="loading-screen">
    <p>Loading...</p>
  </div>
{:else if !auth.isAuthenticated}
  {@render children()}
{:else}
  <div class="app-shell">
    <nav class="sidebar" data-testid="portal-sidebar">
      <div class="sidebar-brand">GB</div>
      {#each navItems as item}
        <a
          href={item.href}
          class="sidebar-link"
          class:active={$page.url.pathname === item.href}
          data-testid="nav-{item.label.toLowerCase()}"
        >
          <span class="sidebar-icon">{item.icon}</span>
          <span class="sidebar-label">{item.label}</span>
        </a>
      {/each}
    </nav>
    <main class="content">
      {@render children()}
    </main>
  </div>
{/if}

<style>
  .loading-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    color: var(--color-text-secondary);
  }

  .app-shell {
    display: flex;
    height: 100vh;
    overflow: hidden;
  }

  .sidebar {
    width: 200px;
    flex-shrink: 0;
    background: var(--glass-bg);
    border-right: 1px solid var(--glass-border);
    display: flex;
    flex-direction: column;
    padding: 16px 0;
    gap: 4px;
  }

  .sidebar-brand {
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--color-pink);
    padding: 0 16px 16px;
    border-bottom: 1px solid var(--glass-border);
    margin-bottom: 8px;
  }

  .sidebar-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    color: var(--color-text-secondary);
    text-decoration: none;
    font-size: 0.9rem;
    transition: all 0.2s;
  }

  .sidebar-link:hover {
    color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.04);
  }

  .sidebar-link.active {
    color: var(--color-pink);
    background: rgba(253, 181, 206, 0.08);
  }

  .sidebar-icon {
    font-size: 1.1rem;
  }

  .content {
    flex: 1;
    overflow-y: auto;
  }
</style>
