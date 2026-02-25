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
    font-size: 0.8125rem;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .badge-default { background: rgba(59, 151, 151, 0.2); color: var(--color-teal); }
  .badge-warning { background: rgba(248, 113, 113, 0.2); color: #f87171; }
  .badge-success { background: rgba(74, 222, 128, 0.2); color: #4ade80; }
  .badge-common { background: rgba(160, 174, 192, 0.15); color: var(--rarity-common); }
  .badge-rare { background: rgba(59, 151, 151, 0.15); color: var(--rarity-rare); }
  .badge-epic { background: rgba(176, 106, 255, 0.15); color: var(--rarity-epic); }
  .badge-legendary { background: rgba(255, 215, 0, 0.15); color: var(--rarity-legendary); }
</style>
