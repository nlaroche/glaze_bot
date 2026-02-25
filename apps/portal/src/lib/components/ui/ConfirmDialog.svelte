<script lang="ts">
  import Button from './Button.svelte';

  let {
    open = false,
    title = 'Confirm',
    message = 'Are you sure?',
    confirmLabel = 'Confirm',
    variant = 'destructive' as 'destructive' | 'primary',
    onconfirm,
    oncancel,
  }: {
    open: boolean;
    title?: string;
    message?: string;
    confirmLabel?: string;
    variant?: 'destructive' | 'primary';
    onconfirm: () => void;
    oncancel: () => void;
  } = $props();
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="backdrop" onclick={oncancel} data-testid="confirm-dialog-backdrop">
    <div class="dialog" onclick={(e) => e.stopPropagation()} data-testid="confirm-dialog">
      <h3 class="dialog-title">{title}</h3>
      <p class="dialog-message">{message}</p>
      <div class="dialog-actions">
        <Button variant="secondary" onclick={oncancel} testid="confirm-cancel">Cancel</Button>
        <Button variant={variant} onclick={onconfirm} testid="confirm-ok">{confirmLabel}</Button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .dialog {
    background: rgba(8, 14, 28, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.07);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 14px;
    padding: 24px;
    min-width: 340px;
    max-width: 440px;
    animation: slideUp 0.15s ease;
    box-shadow:
      0 0 60px rgba(59, 151, 151, 0.06),
      0 8px 32px rgba(0, 0, 0, 0.4);
  }

  @keyframes slideUp {
    from { transform: translateY(8px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .dialog-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--color-text-primary);
    margin-bottom: 8px;
  }

  .dialog-message {
    font-size: 0.9375rem;
    color: var(--color-text-secondary);
    margin-bottom: 20px;
    line-height: 1.5;
  }

  .dialog-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
</style>
