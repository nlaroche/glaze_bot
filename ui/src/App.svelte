<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { initialize, cleanup, ready, activeView } from "./lib/stores";
  import Sidebar from "./components/Sidebar.svelte";
  import HomeView from "./components/HomeView.svelte";
  import CharacterLibrary from "./components/CharacterLibrary.svelte";
  import SettingsPanel from "./components/SettingsPanel.svelte";
  import LogPanel from "./components/LogPanel.svelte";
  import StatusBar from "./components/StatusBar.svelte";

  onMount(() => {
    let retries = 0;
    function tryInit() {
      if ((window as any).pywebview?.api || retries > 20) {
        initialize();
      } else {
        retries++;
        setTimeout(tryInit, 100);
      }
    }
    tryInit();
  });

  onDestroy(() => { cleanup(); });
</script>

<div class="app">
  {#if $ready}
    <div class="main">
      <Sidebar />
      <div class="content">
        {#if $activeView === "home"}
          <HomeView />
        {:else if $activeView === "characters"}
          <CharacterLibrary />
        {:else if $activeView === "log"}
          <LogPanel />
        {:else if $activeView === "settings"}
          <SettingsPanel />
        {/if}
      </div>
    </div>
    <StatusBar />
  {:else}
    <div class="loading">
      <div class="spinner"></div>
      Connecting...
    </div>
  {/if}
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .main {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .content {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .loading {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--ctp-surface2);
    font-style: italic;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--ctp-surface0);
    border-top: 2px solid var(--ctp-blue);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>
