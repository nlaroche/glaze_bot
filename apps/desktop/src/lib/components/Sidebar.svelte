<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { signOut } from '@glazebot/supabase-client';
  import SidebarIcon from './SidebarIcon.svelte';

  const navItems: { name: 'home' | 'user' | 'settings' | 'pack' | 'collection'; path: string; label: string }[] = [
    { name: 'home', path: '/', label: 'Home' },
    { name: 'pack', path: '/pack', label: 'Open Packs' },
    { name: 'collection', path: '/collection', label: 'Collection' },
    { name: 'user', path: '/account', label: 'Account' },
  ];

  function isActive(path: string): boolean {
    if (path === '/') return page.url.pathname === '/';
    return page.url.pathname.startsWith(path);
  }

  async function handleSignOut() {
    await signOut();
  }
</script>

<nav>
  <div class="nav-items">
    {#each navItems as item}
      <button
        class="icon-btn"
        class:active={isActive(item.path)}
        onclick={() => goto(item.path)}
        aria-label={item.label}
        title={item.label}
      >
        <SidebarIcon name={item.name} />
      </button>
    {/each}
  </div>
  <div class="bottom-items">
    <button
      class="icon-btn"
      class:active={isActive('/settings')}
      onclick={() => goto('/settings')}
      aria-label="Settings"
      title="Settings"
    >
      <SidebarIcon name="settings" />
    </button>
    <button
      class="icon-btn logout-btn"
      onclick={handleSignOut}
      aria-label="Sign out"
      title="Sign out"
    >
      <SidebarIcon name="logout" />
    </button>
  </div>
</nav>

<style>
  nav {
    display: flex;
    flex-direction: column;
    width: var(--sidebar-width);
    min-width: var(--sidebar-width);
    padding: var(--space-2) 0;
    background: var(--color-chrome);
  }

  .nav-items {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .bottom-items {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-bottom: var(--space-2);
  }

  .icon-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 44px;
    border: none;
    border-radius: 0;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: color var(--transition-slow) ease;
  }

  /* Left-edge indicator line */
  .icon-btn::before {
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

  .icon-btn:hover {
    color: var(--color-text-primary);
  }

  .icon-btn:hover::before {
    height: 20px;
  }

  .icon-btn.active {
    color: var(--color-teal);
  }

  .icon-btn.active::before {
    height: 32px;
  }

  .logout-btn:hover {
    color: var(--color-error);
  }

  .logout-btn:hover::before {
    background: var(--color-error);
  }
</style>
