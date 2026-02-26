<script lang="ts">
  import { CharacterCard } from '@glazebot/shared-ui';
  import type { GachaCharacter } from '@glazebot/shared-types';
  import { getCollection } from '@glazebot/supabase-client';
  import { onMount } from 'svelte';

  let characters: GachaCharacter[] = $state([]);
  let loading = $state(true);
  let error = $state('');

  let flippedStates = $state<Record<string, boolean>>({});

  function toggleFlip(id: string) {
    flippedStates[id] = !flippedStates[id];
  }

  onMount(async () => {
    try {
      characters = await getCollection();
      // Start all cards flipped (showing front)
      for (const c of characters) {
        flippedStates[c.id] = true;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load collection';
    } finally {
      loading = false;
    }
  });
</script>

<div class="page">
  <h2>Collection</h2>

  {#if loading}
    <div class="empty-state">Loading collection...</div>
  {:else if error}
    <div class="empty-state error">{error}</div>
  {:else if characters.length === 0}
    <div class="empty-state">
      <p>No characters yet!</p>
      <p class="hint">Open a booster pack to start your collection.</p>
    </div>
  {:else}
    <div class="card-grid">
      {#each characters as char (char.id)}
        <CharacterCard
          character={char}
          flipped={flippedStates[char.id]}
          onflip={() => toggleFlip(char.id)}
          image={char.avatar_url}
        />
      {/each}
    </div>
  {/if}
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 24px;
    gap: 16px;
    overflow-y: auto;
  }

  h2 {
    font-size: 1.4rem;
    color: var(--color-text-primary, #e2e8f0);
    margin: 0;
  }

  .card-grid {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: var(--color-text-secondary, rgba(255, 255, 255, 0.55));
    font-size: 1.1rem;
    gap: 4px;
  }

  .empty-state.error {
    color: var(--color-error, #f87171);
  }

  .empty-state p {
    margin: 0;
  }

  .hint {
    font-size: 0.9rem;
    opacity: 0.7;
  }
</style>
