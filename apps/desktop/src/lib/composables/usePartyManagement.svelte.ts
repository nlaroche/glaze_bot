import type { GachaCharacter } from '@glazebot/shared-types';
import { setPartySlot } from '$lib/stores/session.svelte';
import { findCharById } from '$lib/stores/collection.svelte';

interface UsePartyManagementOptions {
  session: { partySlots: (GachaCharacter | null)[]; overlayOn: boolean };
  collection: { allCharacters: GachaCharacter[] };
  onPartyChanged: () => void;
}

export function usePartyManagement({ session, collection, onPartyChanged }: UsePartyManagementOptions) {
  let searchQuery = $state('');
  let dragOverPartySlot = $state<number | null>(null);
  let dragOverCollection = $state(false);

  let availableCollection = $derived(
    collection.allCharacters.filter((c) => !session.partySlots.some((s) => s?.id === c.id))
  );

  let filteredCollection = $derived(
    searchQuery
      ? availableCollection.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : availableCollection
  );

  function addToParty(char: GachaCharacter) {
    const emptyIndex = session.partySlots.findIndex((s) => s === null);
    if (emptyIndex !== -1) {
      setPartySlot(emptyIndex, char);
      if (session.overlayOn) onPartyChanged();
    }
  }

  function removeFromParty(index: number) {
    setPartySlot(index, null);
    if (session.overlayOn) onPartyChanged();
  }

  function handlePartySlotDrop(e: DragEvent, slotIndex: number) {
    e.preventDefault();
    dragOverPartySlot = null;
    const charId = e.dataTransfer?.getData('text/plain');
    if (!charId) return;
    const char = findCharById(charId);
    if (!char) return;

    const oldSlot = session.partySlots.findIndex((s) => s?.id === charId);
    if (oldSlot !== -1) setPartySlot(oldSlot, null);

    const displaced = session.partySlots[slotIndex];
    setPartySlot(slotIndex, char);
    if (displaced && oldSlot !== -1) {
      setPartySlot(oldSlot, displaced);
    }
  }

  function handleCollectionDrop(e: DragEvent) {
    e.preventDefault();
    dragOverCollection = false;
    const charId = e.dataTransfer?.getData('text/plain');
    if (!charId) return;
    const slotIndex = session.partySlots.findIndex((s) => s?.id === charId);
    if (slotIndex !== -1) setPartySlot(slotIndex, null);
  }

  return {
    get searchQuery() { return searchQuery; },
    set searchQuery(v: string) { searchQuery = v; },
    get collection() { return availableCollection; },
    get filteredCollection() { return filteredCollection; },
    get dragOverPartySlot() { return dragOverPartySlot; },
    set dragOverPartySlot(v: number | null) { dragOverPartySlot = v; },
    get dragOverCollection() { return dragOverCollection; },
    set dragOverCollection(v: boolean) { dragOverCollection = v; },
    addToParty,
    removeFromParty,
    handlePartySlotDrop,
    handleCollectionDrop,
  };
}
