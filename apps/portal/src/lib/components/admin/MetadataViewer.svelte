<script lang="ts">
  import type { GenerationStep } from '@glazebot/shared-types';

  let {
    data = undefined,
  }: {
    data?: GenerationStep;
  } = $props();

  let expanded = $state(false);
</script>

{#if data}
  <div class="metadata-viewer" data-testid="metadata-viewer">
    <button
      class="toggle-btn"
      onclick={() => expanded = !expanded}
      data-testid="metadata-toggle"
    >
      <span class="chevron" class:open={expanded}>&#9656;</span>
      Show API Details
      <span class="timestamp">{new Date(data.timestamp).toLocaleString()}</span>
    </button>

    {#if expanded}
      <div class="metadata-content" data-testid="metadata-content">
        <div class="metadata-section">
          <span class="section-label">Request</span>
          <pre>{JSON.stringify(data.request, null, 2)}</pre>
        </div>
        <div class="metadata-section">
          <span class="section-label">Response</span>
          <pre>{JSON.stringify(data.response, null, 2)}</pre>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .metadata-viewer {
    margin-top: 12px;
    border-top: 1px solid var(--glass-border);
    padding-top: 8px;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-family: inherit;
    font-size: 0.75rem;
    cursor: pointer;
    padding: 4px 0;
    transition: color 0.15s;
  }

  .toggle-btn:hover {
    color: var(--color-text-secondary);
  }

  .chevron {
    display: inline-block;
    transition: transform 0.15s;
    font-size: 0.7rem;
  }

  .chevron.open {
    transform: rotate(90deg);
  }

  .timestamp {
    margin-left: auto;
    opacity: 0.6;
  }

  .metadata-content {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .metadata-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .section-label {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--color-text-muted);
    letter-spacing: 0.05em;
  }

  pre {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--glass-border);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 0.7rem;
    color: var(--color-text-secondary);
    overflow-x: auto;
    max-height: 200px;
    overflow-y: auto;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
  }
</style>
