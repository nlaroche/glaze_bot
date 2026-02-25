<script lang="ts">
  import type { GachaCharacter } from '@glazebot/shared-types';
  import { CollectionGrid, CharacterDetail, PartyManager } from '@glazebot/shared-ui';

  let selectedCharacter: GachaCharacter | null = $state(null);
</script>

<div class="page" data-testid="collection-page">
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
    height: 100vh;
    padding: 20px 28px 48px;
    gap: 24px;
    overflow-y: auto;

    /* Override shared-ui CSS vars for portal styling */
    --glass-bg: rgba(10, 22, 42, 0.5);
    --glass-border: rgba(255, 255, 255, 0.06);
    --color-pink: #c0c8d4;
    --color-navy: rgba(8, 14, 28, 0.82);
  }

  h2 {
    font-family: 'Michroma', sans-serif;
    font-size: 1.1rem;
    font-weight: 400;
    color: #c0c8d4;
    letter-spacing: 1px;
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

  /* Override shared-ui PartyManager h2 */
  .party-section :global(h2) {
    font-family: 'Michroma', sans-serif;
    font-size: 1.1rem;
    font-weight: 400;
    letter-spacing: 1px;
  }

  /* Glass surfaces for party slots and picker */
  .party-section :global(.slot) {
    background: rgba(10, 22, 42, 0.5);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-color: rgba(255, 255, 255, 0.06);
  }

  .party-section :global(.picker) {
    background: rgba(10, 22, 42, 0.5);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-color: rgba(255, 255, 255, 0.06);
  }

  /* Gradient save button */
  .party-section :global(.save-btn) {
    background: linear-gradient(180deg, #449999 0%, #327272 100%);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.15),
      0 1px 3px rgba(0, 0, 0, 0.3);
    border-radius: 8px;
  }

  .party-section :global(.save-btn:hover:not(:disabled)) {
    background: linear-gradient(180deg, #4daaaa 0%, #3a8080 100%);
  }

  /* Glass search and filter inputs */
  .collection-section :global(.search),
  .collection-section :global(.filter-select) {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.07);
  }

  .collection-section :global(.search:focus),
  .collection-section :global(.filter-select:focus) {
    border-color: var(--color-teal);
    background: rgba(59, 151, 151, 0.05);
  }

  /* Glass character detail modal */
  .page :global(.modal) {
    background: rgba(8, 14, 28, 0.82);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-color: rgba(255, 255, 255, 0.07);
    box-shadow:
      0 0 60px rgba(59, 151, 151, 0.06),
      0 8px 32px rgba(0, 0, 0, 0.4);
  }

  /* Gradient party button in detail modal */
  .page :global(.party-btn) {
    background: linear-gradient(180deg, #449999 0%, #327272 100%);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.15),
      0 1px 3px rgba(0, 0, 0, 0.3);
  }

  .page :global(.party-btn:hover) {
    background: linear-gradient(180deg, #4daaaa 0%, #3a8080 100%);
  }

  /* Cancel button glass style */
  .party-section :global(.cancel-btn) {
    border-color: rgba(255, 255, 255, 0.07);
  }
</style>
