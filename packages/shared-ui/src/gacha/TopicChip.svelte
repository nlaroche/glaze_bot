<script lang="ts">
  import type { CharacterRarity } from '@glazebot/shared-types';

  interface Props {
    label: string;
    weight: number;
    maxWeight: number;
    rarity?: CharacterRarity;
    isCustom?: boolean;
  }

  let { label, weight, maxWeight, rarity = 'common', isCustom = false }: Props = $props();

  let fillPct = $derived(maxWeight > 0 ? (weight / maxWeight) * 100 : 0);
</script>

<div class="topic-chip" data-testid="topic-chip">
  <span class="chip-label">{label}</span>
  {#if isCustom}
    <span class="unique-badge">Unique</span>
  {/if}
  <div class="weight-bar">
    <div
      class="weight-fill rarity-{rarity}"
      style="width: {fillPct}%"
    ></div>
  </div>
  <span class="weight-value">{weight}</span>
</div>

<style>
  .topic-chip {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    padding: var(--space-1, 0.25rem) 0;
  }

  .chip-label {
    font-size: var(--font-base, 0.875rem);
    color: var(--color-text-primary, #e2e8f0);
    min-width: 120px;
    flex-shrink: 0;
  }

  .unique-badge {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 1px 6px;
    border-radius: var(--radius-sm, 4px);
    background: var(--gold-a20, rgba(255, 215, 0, 0.2));
    color: var(--rarity-legendary, #ffd700);
    flex-shrink: 0;
  }

  .weight-bar {
    flex: 1;
    height: 6px;
    background: var(--white-a8, rgba(255, 255, 255, 0.08));
    border-radius: var(--radius-xs, 2px);
    overflow: hidden;
    min-width: 60px;
  }

  .weight-fill {
    height: 100%;
    border-radius: var(--radius-xs, 2px);
    transition: width 0.3s ease;
  }

  .weight-fill.rarity-common { background: var(--rarity-common, #a0aec0); }
  .weight-fill.rarity-rare { background: var(--rarity-rare, #3b9797); }
  .weight-fill.rarity-epic { background: var(--rarity-epic, #b06aff); }
  .weight-fill.rarity-legendary { background: var(--rarity-legendary, #ffd700); }

  .weight-value {
    font-size: var(--font-base, 0.875rem);
    color: var(--color-text-primary, #e2e8f0);
    font-variant-numeric: tabular-nums;
    min-width: 28px;
    text-align: right;
    flex-shrink: 0;
  }
</style>
