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

  let fillPercent = $derived(((value - min) / (max - min)) * 100);
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
      style="--fill: {fillPercent}%;"
      oninput={onchange}
      data-testid={testid || undefined}
    />
    <span class="slider-value">{formatValue(value)}</span>
  </div>
</div>

<style>
  .field { display: flex; flex-direction: column; gap: var(--space-1-5); }
  .field-label { font-size: var(--font-base); font-weight: 500; color: var(--color-text-secondary); }
  .slider-row { display: flex; align-items: center; gap: var(--space-3-5); }

  /* ── Custom Slider ── */
  .slider {
    flex: 1;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
    height: 6px;
    border-radius: 3px;
    outline: none;
    background: linear-gradient(
      to right,
      var(--color-accent) 0%,
      var(--color-accent) var(--fill, 50%),
      var(--white-a10) var(--fill, 50%),
      var(--white-a10) 100%
    );
    transition: background var(--transition-fast);
  }
  .slider:hover {
    background: linear-gradient(
      to right,
      var(--color-accent-light) 0%,
      var(--color-accent-light) var(--fill, 50%),
      var(--white-a15) var(--fill, 50%),
      var(--white-a15) 100%
    );
  }
  .slider:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* WebKit (Chrome, Edge, Safari) thumb */
  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: linear-gradient(180deg, var(--color-accent-light) 0%, var(--color-accent) 100%);
    border: 2px solid var(--white-a20);
    box-shadow:
      0 1px 3px var(--black-a40),
      0 0 0 0 transparent;
    cursor: pointer;
    transition: box-shadow var(--transition-base), transform var(--transition-base);
  }
  .slider::-webkit-slider-thumb:hover {
    transform: scale(1.15);
    box-shadow:
      0 1px 4px var(--black-a50),
      0 0 0 4px var(--accent-a15);
  }
  .slider:active::-webkit-slider-thumb {
    transform: scale(1.05);
    box-shadow:
      0 1px 2px var(--black-a50),
      0 0 0 6px var(--accent-a20);
  }
  .slider:focus-visible::-webkit-slider-thumb {
    box-shadow:
      0 1px 3px var(--black-a40),
      0 0 0 3px var(--accent-a30);
  }

  /* Firefox thumb */
  .slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: linear-gradient(180deg, var(--color-accent-light) 0%, var(--color-accent) 100%);
    border: 2px solid var(--white-a20);
    box-shadow: 0 1px 3px var(--black-a40);
    cursor: pointer;
    transition: box-shadow var(--transition-base), transform var(--transition-base);
  }
  .slider::-moz-range-thumb:hover {
    box-shadow:
      0 1px 4px var(--black-a50),
      0 0 0 4px var(--accent-a15);
  }

  /* Firefox track */
  .slider::-moz-range-track {
    height: 6px;
    border-radius: 3px;
    background: var(--white-a10);
  }
  .slider::-moz-range-progress {
    height: 6px;
    border-radius: 3px;
    background: var(--color-accent);
  }

  .slider-value {
    font-size: var(--font-base);
    color: var(--color-text-primary);
    min-width: 52px;
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: 500;
  }
</style>
