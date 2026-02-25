<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    variant = 'primary' as 'primary' | 'secondary' | 'destructive' | 'ghost',
    disabled = false,
    loading = false,
    testid = '',
    onclick = () => {},
    children,
  }: {
    variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
    disabled?: boolean;
    loading?: boolean;
    testid?: string;
    onclick?: (e: Event) => void;
    children: Snippet;
  } = $props();
</script>

<button
  class="btn btn-{variant}"
  disabled={disabled || loading}
  {onclick}
  data-testid={testid || undefined}
>
  {#if loading}
    <span class="spinner"></span>
  {/if}
  {@render children()}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 22px;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-family: inherit;
    font-size: 0.9375rem;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-primary { background: var(--color-teal); color: white; }
  .btn-primary:hover:not(:disabled) { background: #4ab0b0; }

  .btn-secondary {
    background: none;
    border: 1px solid var(--glass-border);
    color: var(--color-text-secondary);
  }
  .btn-secondary:hover:not(:disabled) { color: var(--color-text-primary); background: rgba(255,255,255,0.04); }

  .btn-destructive { background: #dc2626; color: white; }
  .btn-destructive:hover:not(:disabled) { background: #ef4444; }

  .btn-ghost { background: none; color: var(--color-text-secondary); border: none; }
  .btn-ghost:hover:not(:disabled) { color: var(--color-text-primary); background: rgba(255,255,255,0.04); }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
