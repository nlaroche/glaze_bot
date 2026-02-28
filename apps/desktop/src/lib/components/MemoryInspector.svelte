<script lang="ts">
  import type { GachaCharacter } from '@glazebot/shared-types';
  import {
    getMemories,
    deleteMemory,
    clearCharacterMemories,
    type CharacterMemory,
  } from '$lib/stores/characterMemory';

  interface Props {
    character: GachaCharacter | null;
    onclose: () => void;
  }

  let { character, onclose }: Props = $props();

  let memories = $state<CharacterMemory[]>([]);
  let loading = $state(false);

  const TYPE_LABELS: Record<string, string> = {
    game_played: 'Game',
    notable_moment: 'Moment',
    player_comment: 'Player',
    question_asked: 'Question',
    general: 'General',
  };

  const TYPE_COLORS: Record<string, string> = {
    game_played: '#22d3ee',
    notable_moment: '#f59e0b',
    player_comment: '#a78bfa',
    question_asked: '#6366f1',
    general: '#6b7280',
  };

  const RARITY_COLORS: Record<string, string> = {
    common: '#9ca3af',
    rare: '#3b82f6',
    epic: '#a855f7',
    legendary: '#f59e0b',
  };

  $effect(() => {
    if (character) {
      loadMemories();
    }
  });

  async function loadMemories() {
    if (!character) return;
    loading = true;
    try {
      memories = await getMemories(character.id, 100);
    } catch {
      memories = [];
    } finally {
      loading = false;
    }
  }

  async function handleDelete(id: string) {
    await deleteMemory(id);
    memories = memories.filter((m) => m.id !== id);
  }

  async function handleClearAll() {
    if (!character) return;
    await clearCharacterMemories(character.id);
    memories = [];
  }
</script>

{#if character}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="inspector-backdrop" onclick={onclose}>
    <div class="inspector-modal" onclick={(e) => e.stopPropagation()} data-testid="memory-inspector">
      <!-- Header -->
      <div class="inspector-header">
        <div class="header-left">
          {#if character.avatar_url}
            <img src={character.avatar_url} alt={character.name} class="header-avatar" />
          {/if}
          <div>
            <h2 class="header-name" style="color: {RARITY_COLORS[character.rarity] ?? '#9ca3af'}">{character.name}</h2>
            <span class="header-rarity">{character.rarity}</span>
          </div>
        </div>
        <button class="close-btn" onclick={onclose} data-testid="close-memory-inspector">&times;</button>
      </div>

      <!-- Body -->
      <div class="inspector-body">
        {#if loading}
          <p class="empty-state">Loading memories...</p>
        {:else if memories.length === 0}
          <p class="empty-state">No memories yet. This character hasn't built any memories from past sessions.</p>
        {:else}
          <div class="memory-list">
            {#each memories as mem (mem.id)}
              <div class="memory-item" data-testid="memory-item">
                <div class="memory-top">
                  <span class="memory-badge" style="background: {TYPE_COLORS[mem.type] ?? '#6b7280'}">
                    {TYPE_LABELS[mem.type] ?? mem.type}
                  </span>
                  <span class="memory-importance">
                    {'★'.repeat(mem.importance)}{'☆'.repeat(5 - mem.importance)}
                  </span>
                  <span class="memory-time">{new Date(mem.createdAt).toLocaleDateString()}</span>
                  <button
                    class="memory-delete"
                    onclick={() => handleDelete(mem.id)}
                    data-testid="delete-memory"
                    title="Delete memory"
                  >&times;</button>
                </div>
                <p class="memory-content">{mem.content}</p>
                {#if mem.gameName}
                  <span class="memory-game">{mem.gameName}</span>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Footer -->
      {#if memories.length > 0}
        <div class="inspector-footer">
          <button class="clear-all-btn" onclick={handleClearAll} data-testid="clear-all-memories">
            Clear All Memories ({memories.length})
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .inspector-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .inspector-modal {
    background: var(--color-surface, #1a1a1a);
    border: 1px solid var(--color-border, #333);
    border-radius: 12px;
    width: 500px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .inspector-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-border, #333);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .header-avatar {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    object-fit: cover;
  }

  .header-name {
    margin: 0;
    font-size: 1.125rem;
    line-height: 1.2;
  }

  .header-rarity {
    font-size: 0.75rem;
    text-transform: uppercase;
    color: var(--color-text-secondary, #888);
    letter-spacing: 0.05em;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--color-text-secondary, #888);
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0 0.25rem;
    line-height: 1;
  }
  .close-btn:hover { color: var(--color-text-primary, #fff); }

  .inspector-body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 1.25rem;
  }

  .empty-state {
    color: var(--color-text-secondary, #888);
    text-align: center;
    padding: 2rem 0;
    font-size: var(--font-base, 0.875rem);
  }

  .memory-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .memory-item {
    background: var(--color-surface-raised, #222);
    border-radius: 8px;
    padding: 0.75rem;
  }

  .memory-top {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.375rem;
  }

  .memory-badge {
    font-size: 0.6875rem;
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    color: #fff;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .memory-importance {
    font-size: 0.75rem;
    color: #f59e0b;
  }

  .memory-time {
    margin-left: auto;
    font-size: 0.75rem;
    color: var(--color-text-secondary, #888);
  }

  .memory-delete {
    background: none;
    border: none;
    color: var(--color-text-secondary, #888);
    cursor: pointer;
    font-size: 1rem;
    padding: 0 0.25rem;
    line-height: 1;
  }
  .memory-delete:hover { color: #f43f5e; }

  .memory-content {
    margin: 0;
    font-size: var(--font-base, 0.875rem);
    color: var(--color-text-primary, #fff);
    line-height: 1.4;
  }

  .memory-game {
    display: inline-block;
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: var(--color-text-secondary, #888);
  }

  .inspector-footer {
    border-top: 1px solid var(--color-border, #333);
    padding: 0.75rem 1.25rem;
    display: flex;
    justify-content: center;
  }

  .clear-all-btn {
    background: none;
    border: 1px solid #f43f5e;
    color: #f43f5e;
    padding: 0.375rem 1rem;
    border-radius: 6px;
    font-size: var(--font-base, 0.875rem);
    cursor: pointer;
  }
  .clear-all-btn:hover {
    background: rgba(244, 63, 94, 0.1);
  }
</style>
