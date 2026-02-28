/**
 * Character Memory — IndexedDB store for persistent cross-session memories.
 *
 * Each character accumulates memories about games played, notable moments,
 * player comments, etc. These are injected into the system prompt so characters
 * can reference past sessions.
 */

const DB_NAME = 'glazebot-character-memory';
const DB_VERSION = 1;
const STORE_NAME = 'memories';

export interface CharacterMemory {
  id: string;
  characterId: string;
  type: 'game_played' | 'notable_moment' | 'player_comment' | 'question_asked' | 'general';
  content: string;
  gameName?: string;
  importance: number; // 1-5
  createdAt: string;  // ISO timestamp
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('characterId', 'characterId', { unique: false });
        store.createIndex('characterId_importance', ['characterId', 'importance'], { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addMemory(memory: Omit<CharacterMemory, 'id' | 'createdAt'>): Promise<CharacterMemory> {
  const db = await openDB();
  const full: CharacterMemory = {
    ...memory,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(full);
    tx.oncomplete = () => { db.close(); resolve(full); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getMemories(characterId: string, limit = 50): Promise<CharacterMemory[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('characterId');
    const request = index.getAll(characterId);

    request.onsuccess = () => {
      db.close();
      const results = (request.result as CharacterMemory[])
        .sort((a, b) => b.importance - a.importance || b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
      resolve(results);
    };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function deleteMemory(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function clearCharacterMemories(characterId: string): Promise<void> {
  const memories = await getMemories(characterId, 10000);
  if (memories.length === 0) return;

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const m of memories) {
      store.delete(m.id);
    }
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getMemoryCount(characterId: string): Promise<number> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('characterId');
    const request = index.count(characterId);

    request.onsuccess = () => { db.close(); resolve(request.result); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export function formatMemoriesForPrompt(memories: CharacterMemory[]): string[] {
  return memories.map((m) => {
    const prefix = m.gameName ? `[${m.gameName}] ` : '';
    return `${prefix}${m.content}`;
  });
}
