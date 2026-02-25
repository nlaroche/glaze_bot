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
    gap: 8px;
    padding: 10px 22px;
    border: 1px solid transparent;
    border-radius: 7px;
    font-weight: 600;
    font-family: inherit;
    font-size: 0.9375rem;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    line-height: 1;
  }
  .btn:active:not(:disabled) { transform: translateY(0.5px); }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn-primary {
    background: linear-gradient(180deg, #449999 0%, #327272 100%);
    border-color: rgba(59, 151, 151, 0.4);
    color: #fff;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.12),
      0 1px 2px rgba(0, 0, 0, 0.3);
  }
  .btn-primary:hover:not(:disabled) {
    background: linear-gradient(180deg, #4daaaa 0%, #3a8484 100%);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.15),
      0 2px 6px rgba(59, 151, 151, 0.3);
  }

  .btn-secondary {
    background: linear-gradient(180deg, var(--color-surface-overlay) 0%, var(--color-surface-raised) 100%);
    border-color: var(--color-border);
    color: var(--color-text-primary);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.04),
      0 1px 2px rgba(0, 0, 0, 0.3);
  }
  .btn-secondary:hover:not(:disabled) {
    background: linear-gradient(180deg, #1e2740 0%, #1a2035 100%);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .btn-destructive {
    background: linear-gradient(180deg, #9b3030 0%, #7a2424 100%);
    border-color: rgba(200, 50, 50, 0.3);
    color: #fca5a5;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 1px 2px rgba(0, 0, 0, 0.3);
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
    background: rgba(255, 255, 255, 0.04);
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
