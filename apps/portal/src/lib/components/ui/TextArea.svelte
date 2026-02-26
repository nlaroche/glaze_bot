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
  .field { display: flex; flex-direction: column; gap: var(--space-1-5); }
  .field-label { font-size: var(--font-base); font-weight: 500; color: var(--color-text-secondary); }
  .field-textarea {
    width: 100%;
    padding: var(--input-padding);
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: var(--input-radius);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: var(--input-font-size);
    line-height: 1.5;
    resize: vertical;
    outline: none;
    transition: border-color var(--transition-base), background var(--transition-base);
  }
  .field-textarea:focus { border-color: var(--input-focus-border); background: var(--input-focus-bg); }
  .field-textarea:disabled { opacity: 0.5; cursor: not-allowed; }
  .field-textarea.monospace { font-family: 'Courier New', monospace; font-size: var(--font-base); }
  .field-desc { font-size: var(--font-sm); color: var(--color-text-muted); margin: 0; }
</style>
