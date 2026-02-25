<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { GenerationStep } from '@glazebot/shared-types';
  import MetadataViewer from './MetadataViewer.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  type StepStatus = 'idle' | 'running' | 'done' | 'error';

  let {
    step,
    title,
    status = 'idle',
    onrun,
    metadata = undefined,
    error = '',
    children,
  }: {
    step: number;
    title: string;
    status?: StepStatus;
    onrun?: () => void;
    metadata?: GenerationStep;
    error?: string;
    children: Snippet;
  } = $props();

  let collapsed = $state(false);

  const statusConfig: Record<StepStatus, { label: string; cls: string }> = {
    idle: { label: 'Idle', cls: 'badge-idle' },
    running: { label: 'Running...', cls: 'badge-running' },
    done: { label: 'Done', cls: 'badge-done' },
    error: { label: 'Error', cls: 'badge-error' },
  };
</script>

<div class="pipeline-step" class:collapsed data-testid="pipeline-step-{step}">
  <div class="step-header">
    <button class="collapse-toggle" onclick={() => collapsed = !collapsed}>
      <span class="chevron" class:open={!collapsed}>&#9656;</span>
    </button>
    <span class="step-number">{step}</span>
    <span class="step-title">{title}</span>
    <span class="badge {statusConfig[status].cls}" data-testid="step-status-{step}">
      {statusConfig[status].label}
    </span>
    {#if onrun}
      <Button
        variant={status === 'done' ? 'secondary' : 'primary'}
        loading={status === 'running'}
        onclick={onrun}
        testid="step-run-{step}"
      >
        {status === 'done' ? 'Re-run' : 'Run'}
      </Button>
    {/if}
  </div>

  {#if !collapsed}
    <div class="step-content">
      {@render children()}
      {#if error}
        <p class="step-error" data-testid="step-error-{step}">{error}</p>
      {/if}
      <MetadataViewer data={metadata} />
    </div>
  {/if}
</div>

<style>
  .pipeline-step {
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    overflow: hidden;
    transition: border-color 0.15s;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.03),
      0 1px 3px rgba(0, 0, 0, 0.4),
      0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .step-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-bottom: 1px solid transparent;
  }

  .pipeline-step:not(.collapsed) .step-header {
    border-bottom-color: var(--color-border);
  }

  .collapse-toggle {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 0;
    font-size: 0.8rem;
    line-height: 1;
  }

  .chevron {
    display: inline-block;
    transition: transform 0.15s;
  }

  .chevron.open {
    transform: rotate(90deg);
  }

  .step-number {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-text-secondary);
    font-size: 0.8125rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .step-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text-primary);
    flex: 1;
  }

  .badge {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 10px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .badge-idle {
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-text-muted);
  }

  .badge-running {
    background: rgba(59, 151, 151, 0.15);
    color: var(--color-teal);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .badge-done {
    background: rgba(74, 222, 128, 0.15);
    color: #4ade80;
  }

  .badge-error {
    background: rgba(248, 113, 113, 0.15);
    color: #f87171;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .step-content {
    padding: 16px;
  }

  .step-error {
    color: #f87171;
    font-size: 0.8125rem;
    margin-top: 8px;
  }
</style>
