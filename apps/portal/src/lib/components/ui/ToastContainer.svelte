<script lang="ts">
  import { toast } from '$lib/stores/toast.svelte';
</script>

{#if toast.items.length > 0}
  <div class="toast-container" data-testid="toast-container">
    {#each toast.items as t (t.id)}
      <div
        class="toast toast-{t.type}"
        class:dismissing={t.dismissing}
        data-testid="toast-{t.type}"
        role="status"
      >
        <span class="toast-icon">
          {#if t.type === 'success'}
            <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
          {:else if t.type === 'error'}
            <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
          {:else}
            <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
          {/if}
        </span>
        <span class="toast-message">{t.message}</span>
        <button class="toast-close" onclick={() => toast.dismiss(t.id)} aria-label="Dismiss">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    top: var(--space-5);
    right: var(--space-5);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    pointer-events: none;
  }

  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
    border-radius: var(--radius-xl);
    font-size: var(--font-base);
    font-weight: 500;
    color: var(--color-text-primary);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow:
      0 10px 40px rgba(0, 0, 0, 0.35),
      0 2px 8px rgba(0, 0, 0, 0.2);
    min-width: 300px;
    max-width: 460px;
    animation: toast-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  .toast.dismissing {
    animation: toast-out 0.3s cubic-bezier(0.4, 0, 1, 1) forwards;
  }

  /* ── Success — muted green that complements the teal/pink theme ── */
  .toast-success {
    background: rgba(34, 197, 94, 0.12);
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .toast-success .toast-icon {
    color: #22c55e;
    filter: drop-shadow(0 0 6px rgba(34, 197, 94, 0.4));
  }

  /* ── Error — warm pink-red from the brand palette ── */
  .toast-error {
    background: rgba(244, 63, 94, 0.12);
    border: 1px solid rgba(244, 63, 94, 0.3);
  }

  .toast-error .toast-icon {
    color: #f43f5e;
    filter: drop-shadow(0 0 6px rgba(244, 63, 94, 0.4));
  }

  /* ── Info — cyan that bridges teal and blue ── */
  .toast-info {
    background: rgba(34, 211, 238, 0.12);
    border: 1px solid rgba(34, 211, 238, 0.3);
  }

  .toast-info .toast-icon {
    color: #22d3ee;
    filter: drop-shadow(0 0 6px rgba(34, 211, 238, 0.4));
  }

  .toast-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    line-height: 1;
  }

  .toast-message {
    flex: 1;
    line-height: 1.4;
  }

  .toast-close {
    flex-shrink: 0;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.35);
    cursor: pointer;
    padding: var(--space-1);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    transition: color 0.15s, background 0.15s;
  }

  .toast-close:hover {
    color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.08);
  }

  /* ── Slide in from right ── */
  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateX(60px) scale(0.92);
    }
    to {
      opacity: 1;
      transform: translateX(0) scale(1);
    }
  }

  /* ── Slide out to right ── */
  @keyframes toast-out {
    from {
      opacity: 1;
      transform: translateX(0) scale(1);
    }
    to {
      opacity: 0;
      transform: translateX(80px) scale(0.9);
    }
  }
</style>
