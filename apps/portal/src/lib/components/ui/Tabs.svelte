<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    tabs = [] as { id: string; label: string }[],
    activeTab = $bindable(''),
    testid = '',
    children,
  }: {
    tabs: { id: string; label: string }[];
    activeTab: string;
    testid?: string;
    children: Snippet;
  } = $props();
</script>

<div class="tabs-container" data-testid={testid || undefined}>
  <div class="tab-bar" role="tablist">
    {#each tabs as tab}
      <button
        role="tab"
        class="tab-trigger"
        class:active={activeTab === tab.id}
        aria-selected={activeTab === tab.id}
        onclick={() => activeTab = tab.id}
        data-testid={testid ? `${testid}-${tab.id}` : undefined}
      >
        {tab.label}
      </button>
    {/each}
  </div>
  <div class="tab-content">
    {@render children()}
  </div>
</div>

<style>
  .tabs-container { display: flex; flex-direction: column; gap: 0; }
  .tab-bar {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--glass-border);
    margin-bottom: 20px;
  }
  .tab-trigger {
    padding: 10px 20px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--color-text-muted);
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }
  .tab-trigger:hover { color: var(--color-text-secondary); }
  .tab-trigger.active {
    color: var(--color-teal);
    border-bottom-color: var(--color-teal);
  }
</style>
