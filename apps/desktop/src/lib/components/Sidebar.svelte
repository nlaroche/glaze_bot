<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { signOut } from '@glazebot/supabase-client';
  import SidebarIcon from './SidebarIcon.svelte';

  const navItems: { name: 'home' | 'user' | 'settings'; path: string; label: string }[] = [
    { name: 'home', path: '/', label: 'Home' },
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
    align-items: center;
    width: var(--sidebar-width);
    min-width: var(--sidebar-width);
    padding: 8px 0;
    background: var(--color-chrome);
  }

  .nav-items {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .bottom-items {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    margin-bottom: 8px;
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .icon-btn:hover {
    border-radius: 12px;
    background: rgba(59, 151, 151, 0.2);
    color: var(--color-text-primary);
  }

  .icon-btn.active {
    border-radius: 12px;
    background: var(--color-teal);
    color: white;
  }

  .logout-btn:hover {
    background: rgba(248, 113, 113, 0.2);
    color: #f87171;
  }
</style>
