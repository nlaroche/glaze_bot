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
  .field { display: flex; flex-direction: column; gap: var(--space-1-5); }
  .field-label { font-size: var(--font-base); font-weight: 500; color: var(--color-text-secondary); }
  .field-select {
    padding: var(--input-padding);
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: var(--input-radius);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: var(--input-font-size);
    width: fit-content;
    min-width: 180px;
    outline: none;
    transition: border-color var(--transition-base), background var(--transition-base);
    cursor: pointer;
  }
  .field-select:focus { border-color: var(--input-focus-border); background: var(--input-focus-bg); }
  .field-select:disabled { opacity: 0.5; cursor: not-allowed; }
  .field-select option { background: var(--color-navy); }
  .field-desc { font-size: var(--font-sm); color: var(--color-text-muted); margin: 0; }
</style>
