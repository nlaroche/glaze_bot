<script lang="ts">
  let {
    label = '',
    value = $bindable(''),
    options = [] as { value: string; label: string }[],
    description = '',
    disabled = false,
    testid = '',
    onchange = () => {},
  } = $props();
</script>

<div class="field">
  {#if label}<label class="field-label">{label}</label>{/if}
  <select
    bind:value
    {disabled}
    class="field-select"
    onchange={onchange}
    data-testid={testid || undefined}
  >
    {#each options as opt}
      <option value={opt.value}>{opt.label}</option>
    {/each}
  </select>
  {#if description}<p class="field-desc">{description}</p>{/if}
</div>

<style>
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field-label { font-size: 0.875rem; font-weight: 500; color: var(--color-text-secondary); }
  .field-select {
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 8px;
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: 0.9375rem;
    width: fit-content;
    min-width: 180px;
    outline: none;
    transition: border-color 0.15s, background 0.15s;
    cursor: pointer;
  }
  .field-select:focus { border-color: var(--color-teal); background: rgba(59, 151, 151, 0.05); }
  .field-select:disabled { opacity: 0.5; cursor: not-allowed; }
  .field-select option { background: var(--color-navy); }
  .field-desc { font-size: 0.8125rem; color: var(--color-text-muted); margin: 0; }
</style>
