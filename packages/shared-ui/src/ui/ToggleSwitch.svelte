<script lang="ts">
  let {
    label = '',
    checked = $bindable(false),
    disabled = false,
    onchange = () => {},
  } = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="toggle-row"
  class:disabled
  onclick={() => { if (!disabled) { checked = !checked; onchange(); } }}
>
  <div class="track" class:on={checked}>
    <div class="thumb"></div>
  </div>
  {#if label}<span class="toggle-label">{label}</span>{/if}
</div>

<style>
  .toggle-row {
    display: flex;
    align-items: center;
    gap: var(--space-2-5);
    cursor: pointer;
    user-select: none;
  }
  .toggle-row.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .track {
    position: relative;
    width: 36px;
    height: 20px;
    border-radius: 10px;
    background: var(--white-a10);
    border: 1px solid var(--white-a8);
    transition: background var(--transition-base), border-color var(--transition-base);
    flex-shrink: 0;
  }
  .track.on {
    background: var(--accent-a30);
    border-color: var(--accent-a40);
  }

  .thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--color-text-muted);
    transition: transform var(--transition-base), background var(--transition-base);
  }
  .track.on .thumb {
    transform: translateX(16px);
    background: var(--color-accent-light);
  }

  .toggle-row:hover .track:not(.on) {
    background: var(--white-a12);
  }
  .toggle-row:hover .track.on {
    background: var(--accent-a40);
  }

  .toggle-label {
    font-size: var(--font-base);
    color: var(--color-text-primary);
  }
</style>
