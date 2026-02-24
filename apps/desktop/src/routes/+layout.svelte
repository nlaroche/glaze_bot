<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import Titlebar from '$lib/components/Titlebar.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import AuthScreen from '$lib/components/AuthScreen.svelte';
  import { getAuthState, initializeAuth } from '$lib/stores/auth.svelte';

  let { children } = $props();
  const auth = getAuthState();

  onMount(() => {
    initializeAuth();
  });
</script>

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

<style>
  .loading-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: var(--color-text-secondary);
  }

  .app-shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    background: var(--glass-bg);
  }

  .body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    border-radius: 0;
    border-top: none;
  }
</style>
