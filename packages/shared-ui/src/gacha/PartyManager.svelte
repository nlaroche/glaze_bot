<script lang="ts">
  import type { GachaCharacter } from '@glazebot/shared-types';
  import { getActiveParty, setActiveParty, getCollection } from '@glazebot/supabase-client';
  import ProceduralAvatar from './ProceduralAvatar.svelte';
  import RarityBadge from './RarityBadge.svelte';

  let partyMembers: (GachaCharacter | null)[] = $state([null, null, null]);
  let allCharacters: GachaCharacter[] = $state([]);
  let picking: number | null = $state(null);
  let saving: boolean = $state(false);
  let loading: boolean = $state(true);

  $effect(() => {
    loadData();
  });

  async function loadData() {
    loading = true;
    try {
      const [party, chars] = await Promise.all([getActiveParty(), getCollection()]);
      allCharacters = chars;

      if (party?.member_ids) {
        const ids = party.member_ids as string[];
        partyMembers = [0, 1, 2].map(i => {
          const id = ids[i];
          return id ? chars.find(c => c.id === id) ?? null : null;
        });
      }
    } catch {
      // Empty state
    } finally {
      loading = false;
    }
  }

  function startPicking(slotIndex: number) {
    picking = slotIndex;
  }

  function selectCharacter(char: GachaCharacter) {
    if (picking === null) return;
    partyMembers[picking] = char;
    picking = null;
  }

  function removeFromSlot(index: number) {
    partyMembers[index] = null;
  }

  async function saveParty() {
    saving = true;
    try {
      const ids = partyMembers.filter((m): m is GachaCharacter => m !== null).map(m => m.id);
      await setActiveParty(ids);
    } catch {
      // Error saving
    } finally {
      saving = false;
    }
  }

  const availableCharacters = $derived(
    allCharacters.filter(c => !partyMembers.some(m => m?.id === c.id))
  );
</script>

<div class="party-manager" data-testid="party-manager">
  <h2>Your Party</h2>
  <p class="subtitle">Select up to 3 characters for your commentary team</p>

  <div class="slots" data-testid="party-slots">
    {#each partyMembers as member, i}
      <div class="slot" class:empty={!member} data-testid="party-slot" data-slot-index={i}>
        {#if member}
          <div class="slot-content">
            <ProceduralAvatar seed={member.avatar_seed} rarity={member.rarity} size={56} />
            <div class="slot-info">
              <span class="slot-name" data-testid="party-member-name">{member.name}</span>
              <RarityBadge rarity={member.rarity} />
            </div>
            <button class="remove-btn" onclick={() => removeFromSlot(i)} title="Remove" data-testid="remove-party-member">&times;</button>
          </div>
        {:else}
          <button class="add-btn" onclick={() => startPicking(i)} data-testid="add-party-member">
            <span class="plus">+</span>
            <span>Slot {i + 1}</span>
          </button>
        {/if}
      </div>
    {/each}
  </div>

  <button class="save-btn" onclick={saveParty} disabled={saving} data-testid="save-party-btn">
    {saving ? 'Saving...' : 'Save Party'}
  </button>

  {#if picking !== null}
    <div class="picker" data-testid="character-picker">
      <div class="picker-header">
        <h3>Pick a character for Slot {picking + 1}</h3>
        <button class="cancel-btn" onclick={() => picking = null} data-testid="cancel-picker">Cancel</button>
      </div>
      {#if availableCharacters.length === 0}
        <p class="empty-msg">No available characters. Open some packs first!</p>
      {:else}
        <div class="picker-grid">
          {#each availableCharacters as char (char.id)}
            <button class="picker-item" onclick={() => selectCharacter(char)} data-testid="picker-character" data-character-id={char.id}>
              <ProceduralAvatar seed={char.avatar_seed} rarity={char.rarity} size={40} />
              <div class="picker-info">
                <span class="picker-name">{char.name}</span>
                <RarityBadge rarity={char.rarity} />
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .party-manager {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  h2 {
    font-size: 1.4rem;
    color: var(--color-pink);
    margin: 0;
  }

  .subtitle {
    color: var(--color-text-muted);
    font-size: var(--font-sm);
    margin: 0;
  }

  .slots {
    display: flex;
    gap: var(--space-3);
  }

  .slot {
    flex: 1;
    min-height: 80px;
    border-radius: var(--radius-2xl);
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    overflow: hidden;
  }

  .slot.empty {
    border-style: dashed;
  }

  .slot-content {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    position: relative;
  }

  .slot-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  .slot-name {
    font-weight: 600;
    font-size: var(--font-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .remove-btn {
    position: absolute;
    top: var(--space-1);
    right: var(--space-1);
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 1.2rem;
    cursor: pointer;
    padding: var(--space-1);
    line-height: 1;
  }

  .remove-btn:hover { color: var(--color-error); }

  .add-btn {
    width: 100%;
    height: 100%;
    min-height: 80px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    font-family: inherit;
    font-size: var(--font-brand-md);
    transition: color var(--transition-slow);
  }

  .add-btn:hover { color: var(--color-teal); }

  .plus {
    font-size: 1.5rem;
    font-weight: 300;
  }

  .save-btn {
    padding: var(--space-2-5) var(--space-6);
    border: none;
    border-radius: var(--radius-lg);
    background: var(--color-teal);
    color: white;
    font-size: var(--font-base);
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background var(--transition-slow);
    align-self: flex-start;
  }

  .save-btn:hover:not(:disabled) { background: #4ab0b0; }
  .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .picker {
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-2xl);
    padding: var(--space-4);
  }

  .picker-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-3);
  }

  .picker-header h3 {
    font-size: var(--font-md);
    margin: 0;
  }

  .cancel-btn {
    background: none;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    padding: var(--space-1) var(--space-3);
    cursor: pointer;
    font-family: inherit;
    font-size: var(--font-brand-md);
  }

  .cancel-btn:hover { color: var(--color-text-primary); }

  .empty-msg {
    color: var(--color-text-muted);
    text-align: center;
    padding: var(--space-5);
  }

  .picker-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    max-height: 300px;
    overflow-y: auto;
  }

  .picker-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    border-radius: var(--radius-lg);
    background: none;
    border: 1px solid transparent;
    cursor: pointer;
    color: inherit;
    font-family: inherit;
    text-align: left;
    transition: all var(--transition-slow);
  }

  .picker-item:hover {
    background: var(--teal-a10);
    border-color: var(--glass-border);
  }

  .picker-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-0-5);
  }

  .picker-name {
    font-size: var(--font-sm);
    font-weight: 600;
  }
</style>
