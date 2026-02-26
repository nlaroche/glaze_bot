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
  <div class="auth-shell">
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

  .auth-shell {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 100vh;
    overflow: hidden;
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
    width: 220px;
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
    padding: var(--space-5) var(--space-5) var(--space-4);
    border-bottom: 1px solid var(--color-border);
    margin-bottom: var(--space-1);
  }

  .brand-title {
    font-family: var(--font-brand);
    font-size: var(--font-xl);
    font-weight: 400;
    color: var(--color-pink);
    letter-spacing: 2px;
  }

  .brand-tagline {
    font-family: var(--font-brand);
    font-size: var(--font-xs);
    font-weight: 400;
    color: var(--color-text-muted);
    letter-spacing: 1.5px;
    margin-top: var(--space-1);
  }

  .nav-items {
    display: flex;
    flex-direction: column;
    gap: var(--space-0-5);
    padding: var(--space-1) var(--space-2);
  }

  .nav-bottom {
    margin-top: auto;
    padding: var(--space-2);
    border-top: 1px solid var(--color-border);
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: var(--space-2-5);
    padding: var(--space-2) var(--space-2-5);
    border-radius: var(--radius-lg);
    color: var(--color-text-secondary);
    text-decoration: none;
    font-size: var(--font-base);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-base);
    border: none;
    background: none;
    font-family: inherit;
    width: 100%;
  }

  .nav-link:hover {
    background: var(--teal-a12);
    color: var(--color-text-primary);
  }

  .nav-link.active {
    background: var(--teal-a20);
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
    background: var(--error-a12);
    color: var(--color-error);
  }

  /* ─── Content ─── */
  .content {
    flex: 1;
    overflow-y: auto;
    background: transparent;
  }
</style>
