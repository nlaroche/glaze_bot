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
    background: var(--panel-bg);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    border: 1px solid var(--panel-border);
    border-radius: var(--radius-xl);
    overflow: hidden;
    transition: border-color 0.15s;
    box-shadow: var(--panel-shadow);
  }

  .step-header {
    display: flex;
    align-items: center;
    gap: var(--space-2-5);
    padding: var(--space-3) var(--space-4);
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
    font-size: var(--font-xs);
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
    background: var(--white-a6);
    color: var(--color-text-secondary);
    font-size: var(--font-xs);
    font-weight: 700;
    flex-shrink: 0;
  }

  .step-title {
    font-size: var(--font-base);
    font-weight: 600;
    color: var(--color-text-primary);
    flex: 1;
  }

  .badge {
    font-size: var(--font-brand-sm);
    font-weight: 600;
    padding: var(--space-0-5) var(--space-2-5);
    border-radius: var(--radius-xl);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .badge-idle {
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-text-muted);
  }

  .badge-running {
    background: var(--teal-a15);
    color: var(--color-teal);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .badge-done {
    background: var(--start-a15);
    color: var(--color-success);
  }

  .badge-error {
    background: var(--error-a15);
    color: var(--color-error);
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .step-content {
    padding: var(--space-4);
  }

  .step-error {
    color: var(--color-error);
    font-size: var(--font-xs);
    margin-top: var(--space-2);
  }
</style>
