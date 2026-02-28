<script lang="ts">
  import { toast } from '$lib/stores/toast.svelte';
</script>

{#if toast.items.length > 0}
  <div class="toast-container" data-testid="toast-container">
    {#each toast.items as t (t.id)}
      <div
        class="toast toast-{t.type}"
        data-testid="toast-{t.type}"
        role="status"
      >
        <span class="toast-icon">
          {#if t.type === 'success'}&#10003;{:else if t.type === 'error'}&#10007;{:else}&#9432;{/if}
        </span>
        <span class="toast-message">{t.message}</span>
        <button class="toast-close" onclick={() => toast.dismiss(t.id)} aria-label="Dismiss">&times;</button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    bottom: var(--space-5);
    right: var(--space-5);
    z-index: 9999;
    display: flex;
    flex-direction: column-reverse;
    gap: var(--space-2);
    pointer-events: none;
  }

  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-lg);
    font-size: var(--font-base);
    font-weight: 500;
    color: var(--color-text-primary);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--color-border);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    min-width: 260px;
    max-width: 420px;
    animation: toast-in 0.25s ease-out;
  }

  .toast-success {
    background: rgba(45, 212, 191, 0.15);
    border-color: rgba(45, 212, 191, 0.3);
  }

  .toast-error {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.3);
  }

  .toast-info {
    background: rgba(96, 165, 250, 0.15);
    border-color: rgba(96, 165, 250, 0.3);
  }

  .toast-icon {
    flex-shrink: 0;
    font-size: var(--font-lg);
    line-height: 1;
  }

  .toast-success .toast-icon { color: var(--color-teal); }
  .toast-error .toast-icon { color: var(--color-error); }
  .toast-info .toast-icon { color: #60a5fa; }

  .toast-message {
    flex: 1;
  }

  .toast-close {
    flex-shrink: 0;
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: var(--font-lg);
    cursor: pointer;
    padding: 0;
    line-height: 1;
    transition: color var(--transition-base);
  }

  .toast-close:hover {
    color: var(--color-text-primary);
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(12px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>
