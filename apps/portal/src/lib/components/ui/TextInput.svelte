<script lang="ts">
  let {
    label = '',
    value = $bindable(''),
    placeholder = '',
    description = '',
    disabled = false,
    testid = '',
  } = $props();
</script>

<div class="field">
  {#if label}<label class="field-label">{label}</label>{/if}
  <input
    type="text"
    bind:value
    {placeholder}
    {disabled}
    class="field-input"
    data-testid={testid || undefined}
  />
  {#if description}<p class="field-desc">{description}</p>{/if}
</div>

<style>
  .field { display: flex; flex-direction: column; gap: var(--space-1-5); }
  .field-label { font-size: var(--font-base); font-weight: 500; color: var(--color-text-secondary); }
  .field-input {
    padding: var(--input-padding);
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: var(--input-radius);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: var(--input-font-size);
    outline: none;
    transition: border-color var(--transition-base), background var(--transition-base);
  }
  .field-input:focus { border-color: var(--input-focus-border); background: var(--input-focus-bg); }
  .field-input:disabled { opacity: 0.5; cursor: not-allowed; }
  .field-desc { font-size: var(--font-sm); color: var(--color-text-muted); margin: 0; }
</style>
