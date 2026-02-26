<script lang="ts">
  let {
    variant = 'default' as 'default' | 'warning' | 'success' | 'common' | 'rare' | 'epic' | 'legendary',
    testid = '',
    text = '',
  } = $props();
</script>

<span class="badge badge-{variant}" data-testid={testid || undefined}>{text}</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    font-size: var(--font-sm);
    font-weight: 600;
    padding: var(--space-1) var(--space-2-5);
    border-radius: var(--radius-md);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .badge-default { background: var(--teal-a20); color: var(--color-teal); }
  .badge-warning { background: var(--error-a20); color: var(--color-error); }
  .badge-success { background: rgba(74, 222, 128, 0.2); color: var(--color-success); }
  .badge-common { background: var(--rarity-common-bg); color: var(--rarity-common); }
  .badge-rare { background: var(--rarity-rare-bg); color: var(--rarity-rare); }
  .badge-epic { background: var(--rarity-epic-bg); color: var(--rarity-epic); }
  .badge-legendary { background: var(--rarity-legendary-bg); color: var(--rarity-legendary); }
</style>
