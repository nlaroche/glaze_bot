<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    id = '',
    activeTab = '',
    children,
  }: {
    id: string;
    activeTab: string;
    children: Snippet;
  } = $props();
</script>

{#if activeTab === id}
  <div class="tab-panel" role="tabpanel">
    {@render children()}
  </div>
{/if}

<style>
  .tab-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
</style>
