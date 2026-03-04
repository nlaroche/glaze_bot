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
    background: var(--panel-bg);
    border: 1px solid var(--panel-border);
    border-radius: var(--panel-radius);
    padding: var(--space-5);
    box-shadow: var(--panel-shadow);
  }
  .card-title {
    font-size: var(--font-xl);
    font-weight: 600;
    color: var(--color-heading);
    font-family: var(--font-brand);
    letter-spacing: -0.01em;
    margin: 0 0 var(--space-4);
  }
</style>
