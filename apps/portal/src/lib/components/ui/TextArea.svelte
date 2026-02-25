<script lang="ts">
  let {
    label = '',
    value = $bindable(''),
    placeholder = '',
    rows = 4,
    description = '',
    disabled = false,
    monospace = false,
    testid = '',
    onchange = () => {},
  } = $props();
</script>

<div class="field">
  {#if label}<label class="field-label">{label}</label>{/if}
  <textarea
    bind:value
    {placeholder}
    {rows}
    {disabled}
    class="field-textarea"
    class:monospace
    oninput={onchange}
    data-testid={testid || undefined}
  ></textarea>
  {#if description}<p class="field-desc">{description}</p>{/if}
</div>

<style>
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field-label { font-size: 0.875rem; font-weight: 500; color: var(--color-text-secondary); }
  .field-textarea {
    width: 100%;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--glass-border);
    border-radius: 8px;
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: 0.9375rem;
    line-height: 1.5;
    resize: vertical;
    outline: none;
    transition: border-color 0.15s;
  }
  .field-textarea:focus { border-color: var(--color-teal); }
  .field-textarea:disabled { opacity: 0.5; cursor: not-allowed; }
  .field-textarea.monospace { font-family: 'Courier New', monospace; font-size: 0.875rem; }
  .field-desc { font-size: 0.8125rem; color: var(--color-text-muted); margin: 0; }
</style>
