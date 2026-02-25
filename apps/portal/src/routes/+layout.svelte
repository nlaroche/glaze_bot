<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { getAuthState, initializeAuth } from '$lib/stores/auth.svelte';
  import NightSkyBackground from '$lib/components/NightSkyBackground.svelte';
  import SidebarIcon from '$lib/components/SidebarIcon.svelte';

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

  const navItems: { href: string; label: string; icon: 'home' | 'pack' | 'collection' | 'admin' }[] = [
    { href: '/', label: 'Home', icon: 'home' },
    { href: '/pack', label: 'Packs', icon: 'pack' },
    { href: '/collection', label: 'Collection', icon: 'collection' },
    { href: '/settings', label: 'Admin', icon: 'admin' },
  ];

  function isActive(href: string): boolean {
    if (href === '/') return $page.url.pathname === '/';
    return $page.url.pathname.startsWith(href);
  }
</script>

<NightSkyBackground />

{#if auth.loading}
  <div class="loading-screen">
    <p>Loading...</p>
  </div>
{:else if !auth.isAuthenticated}
  <div class="app-shell">
    {@render children()}
  </div>
{:else}
  <div class="app-shell">
    <nav class="sidebar" data-testid="portal-sidebar">
      <div class="sidebar-brand">
        <span class="brand-title">GlazeBot</span>
        <span class="brand-tagline">Admin Portal</span>
      </div>
      <div class="nav-items">
        {#each navItems as item}
          <a
            href={item.href}
            class="nav-link"
            class:active={isActive(item.href)}
            data-testid="nav-{item.label.toLowerCase()}"
            title={item.label}
          >
            <span class="nav-icon">
              <SidebarIcon name={item.icon} size={20} />
            </span>
            <span class="nav-label">{item.label}</span>
          </a>
        {/each}
      </div>
      <div class="nav-bottom">
        <button
          class="nav-link logout-link"
          onclick={() => import('@glazebot/supabase-client').then(m => m.signOut())}
          title="Sign out"
        >
          <span class="nav-icon">
            <SidebarIcon name="logout" size={20} />
          </span>
          <span class="nav-label">Sign Out</span>
        </button>
      </div>
    </nav>
    <main class="content">
      {@render children()}
    </main>
  </div>
{/if}

<style>
  .loading-screen {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    color: var(--color-text-secondary);
    font-family: 'Satoshi', system-ui, sans-serif;
  }

  .app-shell {
    position: relative;
    z-index: 1;
    display: flex;
    height: 100vh;
    overflow: hidden;
  }

  /* ─── Sidebar ─── */
  .sidebar {
    width: 180px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    padding: 0;
    background: rgba(10, 22, 42, 0.35);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-right: 1px solid var(--color-border);
  }

  .sidebar-brand {
    display: flex;
    flex-direction: column;
    padding: 16px 16px 14px;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 4px;
  }

  .brand-title {
    font-family: 'Michroma', sans-serif;
    font-size: 0.8rem;
    font-weight: 400;
    color: #c0c8d4;
    letter-spacing: 1px;
  }

  .brand-tagline {
    font-family: 'Michroma', sans-serif;
    font-size: 0.5rem;
    font-weight: 400;
    color: var(--color-text-muted);
    letter-spacing: 1.5px;
    margin-top: 2px;
  }

  .nav-items {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 8px;
  }

  .nav-bottom {
    margin-top: auto;
    padding: 8px;
    border-top: 1px solid var(--color-border);
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 8px;
    color: var(--color-text-muted);
    text-decoration: none;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    border: none;
    background: none;
    font-family: inherit;
    width: 100%;
  }

  .nav-link:hover {
    background: rgba(59, 151, 151, 0.12);
    color: var(--color-text-primary);
  }

  .nav-link.active {
    background: rgba(59, 151, 151, 0.2);
    color: var(--color-teal);
  }

  .nav-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .nav-label {
    white-space: nowrap;
  }

  .logout-link:hover {
    background: rgba(248, 113, 113, 0.12);
    color: #f87171;
  }

  /* ─── Content ─── */
  .content {
    flex: 1;
    overflow-y: auto;
    background: transparent;
  }
</style>
