<script lang="ts">
  import type { CharacterRarity } from '@glazebot/shared-types';

  interface Props {
    rarity: CharacterRarity;
  }

  let { rarity }: Props = $props();
</script>

<span class="badge rarity-{rarity}" data-testid="rarity-badge">{rarity}</span>

<style>
  .badge {
    display: inline-block;
    padding: var(--space-0-5) var(--space-2);
    border-radius: var(--radius-sm);
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .rarity-common {
    background: rgba(160, 174, 192, 0.2);
    color: var(--rarity-common);
  }

  .rarity-rare {
    background: var(--teal-a20);
    color: var(--rarity-rare);
  }

  .rarity-epic {
    background: var(--epic-a20);
    color: var(--rarity-epic);
  }

  .rarity-legendary {
    background: var(--gold-a20);
    color: var(--rarity-legendary);
  }
</style>
