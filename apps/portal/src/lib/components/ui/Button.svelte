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
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-2-5) 22px;
    border: 1px solid transparent;
    border-radius: 7px;
    font-weight: 600;
    font-family: inherit;
    font-size: var(--font-md);
    cursor: pointer;
    transition: all var(--transition-base) ease;
    white-space: nowrap;
    line-height: 1;
  }
  .btn:active:not(:disabled) { transform: translateY(0.5px); }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn-primary {
    background: linear-gradient(180deg, #449999 0%, #327272 100%);
    border-color: var(--teal-a40);
    color: #fff;
    box-shadow:
      inset 0 1px 0 var(--white-a12),
      0 1px 2px var(--black-a30);
  }
  .btn-primary:hover:not(:disabled) {
    background: linear-gradient(180deg, #4daaaa 0%, #3a8484 100%);
    box-shadow:
      inset 0 1px 0 var(--white-a15),
      0 2px 6px var(--teal-a30);
  }

  .btn-secondary {
    background: linear-gradient(180deg, var(--color-surface-overlay) 0%, var(--color-surface-raised) 100%);
    border-color: var(--color-border);
    color: var(--color-text-primary);
    box-shadow:
      inset 0 1px 0 var(--white-a4),
      0 1px 2px var(--black-a30);
  }
  .btn-secondary:hover:not(:disabled) {
    background: linear-gradient(180deg, #1e2740 0%, #1a2035 100%);
    border-color: var(--white-a10);
  }

  .btn-destructive {
    background: linear-gradient(180deg, #9b3030 0%, #7a2424 100%);
    border-color: rgba(200, 50, 50, 0.3);
    color: var(--color-error-soft);
    box-shadow:
      inset 0 1px 0 var(--white-a8),
      0 1px 2px var(--black-a30);
  }
  .btn-destructive:hover:not(:disabled) {
    background: linear-gradient(180deg, #b33636 0%, #8a2a2a 100%);
  }

  .btn-ghost {
    background: transparent;
    border-color: transparent;
    color: var(--color-text-secondary);
  }
  .btn-ghost:hover:not(:disabled) {
    background: var(--white-a4);
    color: var(--color-text-primary);
  }

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
