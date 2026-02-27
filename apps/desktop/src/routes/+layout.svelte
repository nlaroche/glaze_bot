<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import Titlebar from '$lib/components/Titlebar.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import AuthScreen from '$lib/components/AuthScreen.svelte';
  import NightSkyBackground from '$lib/components/NightSkyBackground.svelte';
  import { getAuthState, initializeAuth } from '$lib/stores/auth.svelte';

  let { children } = $props();
  const auth = getAuthState();

  const isOverlay = $derived(page.url.pathname.startsWith('/overlay'));
  const isTrayMenu = $derived(page.url.pathname.startsWith('/tray-menu'));

  // Map routes to scene indices for parallax camera shift
  const sceneIndex = $derived((() => {
    const path = page.url.pathname;
    if (path === '/') return 0;
    if (path.startsWith('/pack')) return 1;
    if (path.startsWith('/collection')) return 2;
    if (path.startsWith('/account')) return 3;
    if (path.startsWith('/settings')) return 4;
    return 0;
  })());

  onMount(() => {
    if (!isOverlay && !isTrayMenu) {
      initializeAuth();
    }
  });
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
</svelte:head>

{#if isOverlay || isTrayMenu}
  {@render children()}
{:else}
  <NightSkyBackground {sceneIndex} />
  <div class="app-shell">
    <Titlebar />
    {#if auth.loading}
      <div class="loading-screen">
        <p>Loading...</p>
      </div>
    {:else if !auth.isAuthenticated}
      <AuthScreen />
    {:else}
      <div class="body">
        <Sidebar />
        <main class="content">
          {@render children()}
        </main>
      </div>
    {/if}
  </div>
{/if}

<style>
  .loading-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: var(--color-text-secondary);
  }

  .app-shell {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    background: transparent;
  }

  .body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-6);
    border-radius: 0;
    border-top: none;
  }
</style>
