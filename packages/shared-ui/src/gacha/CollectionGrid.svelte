<script lang="ts">
  import type { GachaCharacter, CharacterRarity } from '@glazebot/shared-types';
  import { getCollection } from '@glazebot/supabase-client';
  import CharacterCard from './CharacterCard.svelte';

  interface Props {
    onselect?: (character: GachaCharacter) => void;
  }

  let { onselect }: Props = $props();

  let characters: GachaCharacter[] = $state([]);
  let loading: boolean = $state(true);
  let filterRarity: CharacterRarity | 'all' = $state('all');
  let searchQuery: string = $state('');
  let sortBy: 'newest' | 'rarity' | 'name' = $state('newest');

  const rarityOrder: Record<CharacterRarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

  const filtered = $derived.by(() => {
    let result = characters;

    if (filterRarity !== 'all') {
      result = result.filter(c => c.rarity === filterRarity);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(q));
    }

    if (sortBy === 'rarity') {
      result = [...result].sort((a, b) => rarityOrder[b.rarity] - rarityOrder[a.rarity]);
    } else if (sortBy === 'name') {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    }
    // 'newest' is already the default order from the query

    return result;
  });

  $effect(() => {
    loadCollection();
  });

  async function loadCollection() {
    loading = true;
    try {
      characters = await getCollection();
    } catch {
      // Empty collection
    } finally {
      loading = false;
    }
  }
</script>

<div class="collection" data-testid="collection-grid">
  <div class="controls" data-testid="collection-controls">
    <input
      type="text"
      class="search"
      placeholder="Search characters..."
      bind:value={searchQuery}
      data-testid="collection-search"
    />
    <div class="filters">
      <select class="filter-select" bind:value={filterRarity} data-testid="rarity-filter">
        <option value="all">All Rarities</option>
        <option value="common">Common</option>
        <option value="rare">Rare</option>
        <option value="epic">Epic</option>
        <option value="legendary">Legendary</option>
      </select>
      <select class="filter-select" bind:value={sortBy} data-testid="sort-select">
        <option value="newest">Newest</option>
        <option value="rarity">Rarity</option>
        <option value="name">Name</option>
      </select>
    </div>
  </div>

  {#if loading}
    <p class="status" data-testid="collection-loading">Loading collection...</p>
  {:else if filtered.length === 0}
    <p class="status" data-testid="collection-empty">
      {characters.length === 0 ? 'No characters yet. Open some packs!' : 'No matches found.'}
    </p>
  {:else}
    <div class="grid" data-testid="collection-card-grid">
      {#each filtered as char (char.id)}
        <CharacterCard
          character={char}
          flipped={true}
          onclick={() => onselect?.(char)}
        />
      {/each}
    </div>
  {/if}
</div>

<style>
  .collection {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
  }

  .controls {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  }

  .search {
    flex: 1;
    min-width: 200px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--glass-border);
    border-radius: 8px;
    color: var(--color-text-primary);
    font-size: 0.85rem;
    font-family: inherit;
    outline: none;
  }

  .search:focus {
    border-color: var(--color-teal);
  }

  .search::placeholder {
    color: var(--color-text-muted);
  }

  .filters {
    display: flex;
    gap: 8px;
  }

  .filter-select {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--glass-border);
    border-radius: 8px;
    color: var(--color-text-primary);
    font-size: 0.85rem;
    font-family: inherit;
    outline: none;
    cursor: pointer;
  }

  .filter-select option {
    background: var(--color-navy);
  }

  .status {
    text-align: center;
    color: var(--color-text-muted);
    padding: 40px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
    overflow-y: auto;
    padding: 4px;
    justify-items: center;
  }
</style>
