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
    padding: 2px 8px;
    border-radius: 4px;
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
    background: rgba(59, 151, 151, 0.2);
    color: var(--rarity-rare);
  }

  .rarity-epic {
    background: rgba(176, 106, 255, 0.2);
    color: var(--rarity-epic);
  }

  .rarity-legendary {
    background: rgba(255, 215, 0, 0.2);
    color: var(--rarity-legendary);
  }
</style>
