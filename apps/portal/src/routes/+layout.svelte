<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { getAuthState, initializeAuth } from '$lib/stores/auth.svelte';
  import NightSkyBackground from '$lib/components/NightSkyBackground.svelte';
  import SidebarIcon from '$lib/components/SidebarIcon.svelte';
  import ToastContainer from '$lib/components/ui/ToastContainer.svelte';

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

  type NavIcon = 'home' | 'billing' | 'admin' | 'logs' | 'logout';

  const mainNav: { href: string; label: string; icon: NavIcon }[] = [
    { href: '/', label: 'Home', icon: 'home' },
    { href: '/billing', label: 'Billing', icon: 'billing' },
  ];

  const adminNav: { href: string; label: string; icon: NavIcon }[] = [
    { href: '/settings', label: 'Admin', icon: 'admin' },
    { href: '/logs', label: 'Logs', icon: 'logs' },
  ];

  function isActive(href: string): boolean {
    if (href === '/') return $page.url.pathname === '/';
    return $page.url.pathname.startsWith(href);
  }
</script>

<NightSkyBackground />
<ToastContainer />

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
      </div>

      <div class="nav-items">
        {#each mainNav as item}
          <a
            href={item.href}
            class="nav-link"
            class:active={isActive(item.href)}
            data-testid="nav-{item.label.toLowerCase()}"
          >
            <span class="nav-icon">
              <SidebarIcon name={item.icon} size={22} />
            </span>
            <span class="nav-label">{item.label}</span>
          </a>
        {/each}
      </div>

      {#if auth.isAdmin}
        <div class="nav-section">
          <span class="nav-section-label">Admin</span>
          <div class="nav-items">
            {#each adminNav as item}
              <a
                href={item.href}
                class="nav-link"
                class:active={isActive(item.href)}
                data-testid="nav-{item.label.toLowerCase()}"
              >
                <span class="nav-icon">
                  <SidebarIcon name={item.icon} size={22} />
                </span>
                <span class="nav-label">{item.label}</span>
              </a>
            {/each}
          </div>
        </div>
      {/if}

      <div class="nav-bottom">
        <button
          class="nav-link logout-link"
          onclick={() => import('@glazebot/supabase-client').then(m => m.signOut())}
        >
          <span class="nav-icon">
            <SidebarIcon name="logout" size={22} />
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
    width: 230px;
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
    align-items: center;
    padding: var(--space-6) var(--space-5);
    border-bottom: 1px solid var(--color-border);
  }

  .brand-title {
    font-family: var(--font-brand);
    font-size: var(--font-3xl);
    font-weight: 400;
    color: var(--color-pink);
    letter-spacing: 2.5px;
  }

  /* ─── Nav Items ─── */
  .nav-items {
    display: flex;
    flex-direction: column;
    gap: var(--space-0-5);
    padding: var(--space-3) var(--space-3);
  }

  .nav-section {
    padding-top: var(--space-3);
    border-top: 1px solid var(--color-border);
    margin: var(--space-2) var(--space-3) 0;
  }

  .nav-section-label {
    display: block;
    font-size: var(--font-sm);
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    padding: 0 var(--space-4) var(--space-2);
  }

  .nav-section .nav-items {
    padding: 0;
  }

  .nav-link {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-radius: 0;
    color: var(--color-text-secondary);
    text-decoration: none;
    font-size: var(--font-md);
    font-weight: 500;
    cursor: pointer;
    transition: color var(--transition-slow) ease;
    border: none;
    background: none;
    font-family: inherit;
    width: 100%;
  }

  /* Left-edge indicator line */
  .nav-link::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    width: 3px;
    height: 0;
    border-radius: 0 2px 2px 0;
    background: var(--color-teal);
    transform: translateY(-50%);
    transition: height var(--transition-slow) ease;
  }

  .nav-link:hover {
    color: var(--color-text-primary);
  }

  .nav-link:hover::before {
    height: 20px;
  }

  .nav-link.active {
    color: var(--color-teal);
  }

  .nav-link.active::before {
    height: 28px;
  }

  .nav-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    flex-shrink: 0;
  }

  .nav-label {
    white-space: nowrap;
  }

  /* ─── Bottom ─── */
  .nav-bottom {
    margin-top: auto;
    padding: var(--space-3);
    border-top: 1px solid var(--color-border);
  }

  .logout-link:hover {
    color: var(--color-error);
  }

  .logout-link:hover::before {
    background: var(--color-error);
  }

  /* ─── Content ─── */
  .content {
    flex: 1;
    overflow-y: auto;
    background: transparent;
  }
</style>
