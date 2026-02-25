<script lang="ts">
  import type { GachaCharacter } from '@glazebot/shared-types';
  import { CollectionGrid, CharacterDetail, PartyManager } from '@glazebot/shared-ui';

  let selectedCharacter: GachaCharacter | null = $state(null);
</script>

<div class="page">
  <div class="party-section">
    <PartyManager />
  </div>

  <div class="collection-section">
    <h2>Collection</h2>
    <CollectionGrid onselect={(char) => selectedCharacter = char} />
  </div>

  {#if selectedCharacter}
    <CharacterDetail
      character={selectedCharacter}
      onclose={() => selectedCharacter = null}
    />
  {/if}
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 24px;
    gap: 24px;
    overflow-y: auto;
  }

  h2 {
    font-size: 1.4rem;
    color: var(--color-pink);
    margin: 0 0 12px;
  }

  .party-section {
    flex-shrink: 0;
  }

  .collection-section {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
</style>
