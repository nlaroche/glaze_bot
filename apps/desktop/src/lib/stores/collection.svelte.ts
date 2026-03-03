import type { GachaCharacter } from '@glazebot/shared-types';
import { getCollection } from '@glazebot/supabase-client';

let allCharacters = $state<GachaCharacter[]>([]);
let loading = $state(true);
let error = $state('');

export function getCollectionStore() {
  return {
    get allCharacters() { return allCharacters; },
    get loading() { return loading; },
    get error() { return error; },
  };
}

export async function loadCharacters() {
  loading = true;
  error = '';
  try {
    allCharacters = await getCollection();
  } catch (e) {
    console.error('Failed to load characters:', e);
    error = e instanceof Error ? e.message : 'Failed to load collection';
    allCharacters = [];
  }
  loading = false;
}

export function findCharById(id: string): GachaCharacter | undefined {
  return allCharacters.find((c) => c.id === id);
}
