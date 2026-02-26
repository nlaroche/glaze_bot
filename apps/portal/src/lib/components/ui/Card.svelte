<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title = '',
    testid = '',
    children,
  }: {
    title?: string;
    testid?: string;
    children: Snippet;
  } = $props();
</script>

<div class="card" data-testid={testid || undefined}>
  {#if title}<h3 class="card-title">{title}</h3>{/if}
  {@render children()}
</div>

<style>
  .card {
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: var(--panel-radius);
    padding: var(--space-5);
    backdrop-filter: blur(var(--glass-blur));
  }
  .card-title {
    font-size: var(--font-md);
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0 0 var(--space-4);
  }
</style>
