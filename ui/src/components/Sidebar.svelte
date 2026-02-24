<script lang="ts">
  import { activeView } from "../lib/stores";
  import type { View } from "../lib/stores";
  import Tooltip from "./Tooltip.svelte";

  const navItems: { id: View; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "characters", label: "Characters" },
    { id: "log", label: "Activity Log" },
  ];

  const bottomItems: { id: View; label: string }[] = [
    { id: "settings", label: "Settings" },
  ];
</script>

<nav class="sidebar">
  <div class="top">
    <Tooltip text="Glaze Bot" position="bottom">
      <div class="brand">G</div>
    </Tooltip>
    {#each navItems as item (item.id)}
      <Tooltip text={item.label}>
        <button
          class="nav-btn"
          class:active={$activeView === item.id}
          onclick={() => activeView.set(item.id)}
        >
          {#if item.id === "home"}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          {:else if item.id === "characters"}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          {:else if item.id === "log"}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          {/if}
        </button>
      </Tooltip>
    {/each}
  </div>
  <div class="bottom">
    <div class="divider"></div>
    {#each bottomItems as item (item.id)}
      <Tooltip text={item.label}>
        <button
          class="nav-btn"
          class:active={$activeView === item.id}
          onclick={() => activeView.set(item.id)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      </Tooltip>
    {/each}
  </div>
</nav>

<style>
  .sidebar {
    width: 56px;
    height: 100%;
    background: var(--ctp-mantle);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    flex-shrink: 0;
    border-right: 1px solid var(--ctp-surface0);
    padding: 8px 0;
  }

  .top, .bottom {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .brand {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: linear-gradient(135deg, var(--ctp-blue), var(--ctp-mauve));
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ctp-base);
    font-weight: 900;
    font-size: 18px;
    margin-bottom: 8px;
  }

  .divider {
    width: 28px;
    height: 1px;
    background: var(--ctp-surface0);
    margin-bottom: 4px;
  }

  .nav-btn {
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--ctp-overlay0);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s;
    padding: 0;
  }

  .nav-btn svg {
    width: 20px;
    height: 20px;
  }

  .nav-btn:hover {
    background: var(--ctp-surface0);
    color: var(--ctp-text);
  }

  .nav-btn.active {
    background: rgba(137, 180, 250, 0.15);
    color: var(--ctp-blue);
  }
</style>
