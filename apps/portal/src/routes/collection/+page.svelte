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
    padding: var(--space-5) var(--space-7) var(--space-12);
    gap: var(--space-6);
    overflow-y: auto;

    /* Override shared-ui CSS vars for portal styling */
    --glass-bg: rgba(10, 22, 42, 0.5);
    --glass-border: rgba(255, 255, 255, 0.06);
    --color-pink: #c0c8d4;
    --color-navy: rgba(8, 14, 28, 0.82);
  }

  h2 {
    font-family: 'Michroma', sans-serif;
    font-size: var(--font-xl);
    font-weight: 400;
    color: var(--color-heading);
    letter-spacing: 1px;
    margin: 0 0 var(--space-3);
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
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    border-color: var(--white-a6);
  }

  .party-section :global(.picker) {
    background: rgba(10, 22, 42, 0.5);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    border-color: var(--white-a6);
  }

  /* Gradient save button */
  .party-section :global(.save-btn) {
    background: linear-gradient(180deg, #449999 0%, #327272 100%);
    box-shadow:
      inset 0 1px 0 var(--white-a15),
      0 1px 3px var(--black-a30);
    border-radius: var(--radius-lg);
  }

  .party-section :global(.save-btn:hover:not(:disabled)) {
    background: linear-gradient(180deg, #4daaaa 0%, #3a8080 100%);
  }

  /* Glass search and filter inputs */
  .collection-section :global(.search),
  .collection-section :global(.filter-select) {
    background: var(--input-bg);
    border-color: var(--input-border);
  }

  .collection-section :global(.search:focus),
  .collection-section :global(.filter-select:focus) {
    border-color: var(--input-focus-border);
    background: var(--input-focus-bg);
  }

  /* Glass character detail modal */
  .page :global(.modal) {
    background: rgba(8, 14, 28, 0.82);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-color: var(--white-a8);
    box-shadow:
      0 0 60px var(--teal-a5),
      0 8px 32px var(--black-a40);
  }

  /* Gradient party button in detail modal */
  .page :global(.party-btn) {
    background: linear-gradient(180deg, #449999 0%, #327272 100%);
    box-shadow:
      inset 0 1px 0 var(--white-a15),
      0 1px 3px var(--black-a30);
  }

  .page :global(.party-btn:hover) {
    background: linear-gradient(180deg, #4daaaa 0%, #3a8080 100%);
  }

  /* Cancel button glass style */
  .party-section :global(.cancel-btn) {
    border-color: var(--white-a8);
  }
</style>
