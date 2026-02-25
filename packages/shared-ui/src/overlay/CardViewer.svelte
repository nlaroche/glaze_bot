<script lang="ts">
  import type { GachaCharacter } from '@glazebot/shared-types';
  import Spotlight from './Spotlight.svelte';
  import CharacterCard from '../gacha/CharacterCard.svelte';

  interface Props {
    character: GachaCharacter | null;
    image?: string;
    onclose: () => void;
  }

  let { character, image, onclose }: Props = $props();

  const open = $derived(character !== null);
</script>

<Spotlight {open} {onclose}>
  {#if character}
    <div class="viewer">
      <CharacterCard
        {character}
        flipped={true}
        {image}
      />
    </div>
  {/if}
</Spotlight>

<style>
  .viewer {
    /* Scale up the card for dramatic presentation */
    transform: scale(1.15);
    pointer-events: auto;
  }
</style>
