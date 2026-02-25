<script lang="ts">
  let {
    label = '',
    value = $bindable(0),
    min = 0,
    max = 100,
    step = 1,
    suffix = '',
    disabled = false,
    testid = '',
    onchange = () => {},
  } = $props();

  function formatValue(v: number): string {
    const decimals = step < 1 ? Math.max(String(step).split('.')[1]?.length ?? 0, 2) : 0;
    return v.toFixed(decimals) + suffix;
  }
</script>

<div class="field">
  {#if label}<label class="field-label">{label}</label>{/if}
  <div class="slider-row">
    <input
      type="range"
      bind:value
      {min}
      {max}
      {step}
      {disabled}
      class="slider"
      oninput={onchange}
      data-testid={testid || undefined}
    />
    <span class="slider-value">{formatValue(value)}</span>
  </div>
</div>

<style>
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field-label { font-size: 0.875rem; font-weight: 500; color: var(--color-text-secondary); }
  .slider-row { display: flex; align-items: center; gap: 14px; }
  .slider { flex: 1; max-width: 320px; cursor: pointer; }
  .slider:disabled { opacity: 0.5; cursor: not-allowed; }
  .slider-value {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    min-width: 52px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
