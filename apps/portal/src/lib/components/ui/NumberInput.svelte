<script lang="ts">
  let {
    label = '',
    value = $bindable(0),
    min = 0,
    max = 100,
    step = 1,
    description = '',
    disabled = false,
    testid = '',
    onchange = () => {},
  } = $props();
</script>

<div class="field">
  {#if label}<label class="field-label">{label}</label>{/if}
  <input
    type="number"
    bind:value
    {min}
    {max}
    {step}
    {disabled}
    class="field-input"
    oninput={onchange}
    data-testid={testid || undefined}
  />
  {#if description}<p class="field-desc">{description}</p>{/if}
</div>

<style>
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field-label { font-size: 0.875rem; font-weight: 500; color: var(--color-text-secondary); }
  .field-input {
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--glass-border);
    border-radius: 8px;
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: 0.9375rem;
    width: 140px;
    outline: none;
    transition: border-color 0.15s;
  }
  .field-input:focus { border-color: var(--color-teal); }
  .field-input:disabled { opacity: 0.5; cursor: not-allowed; }
  .field-desc { font-size: 0.8125rem; color: var(--color-text-muted); margin: 0; }
</style>
