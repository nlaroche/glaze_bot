import type { ChatLogEntry } from '../commentary/engine';

// ── Types ──

export interface ChatSession {
  id: string;
  startedAt: string; // ISO timestamp
  partyNames: string[];
  messageCount: number;
}

export interface PersistedChatEntry extends ChatLogEntry {
  sessionId: string;
  timestamp: string; // ISO timestamp
}

// ── Constants ──

const DB_NAME = 'glazebot-chat-history';
const DB_VERSION = 1;
const SESSIONS_STORE = 'sessions';
const MESSAGES_STORE = 'messages';

// ── Database ──

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
        const msgStore = db.createObjectStore(MESSAGES_STORE, { keyPath: 'id' });
        msgStore.createIndex('sessionId', 'sessionId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

// ── Helpers ──

function tx(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
): IDBObjectStore {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// ── Public API ──

export async function createSession(partyNames: string[]): Promise<ChatSession> {
  const session: ChatSession = {
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    partyNames,
    messageCount: 0,
  };

  const db = await openDB();
  await req(tx(db, SESSIONS_STORE, 'readwrite').put(session));
  return session;
}

export async function persistMessage(
  entry: ChatLogEntry,
  sessionId: string,
): Promise<void> {
  const persisted: PersistedChatEntry = {
    ...entry,
    sessionId,
    timestamp: entry.timestamp ?? new Date().toISOString(),
  };

  const db = await openDB();
  const transaction = db.transaction([MESSAGES_STORE, SESSIONS_STORE], 'readwrite');
  const msgStore = transaction.objectStore(MESSAGES_STORE);
  const sessStore = transaction.objectStore(SESSIONS_STORE);

  msgStore.put(persisted);

  // Increment message count on session
  const sessReq = sessStore.get(sessionId);
  sessReq.onsuccess = () => {
    const sess = sessReq.result as ChatSession | undefined;
    if (sess) {
      sess.messageCount = (sess.messageCount || 0) + 1;
      sessStore.put(sess);
    }
  };

  await txComplete(transaction);
}

export async function getSessions(): Promise<ChatSession[]> {
  const db = await openDB();
  const sessions = await req(tx(db, SESSIONS_STORE, 'readonly').getAll()) as ChatSession[];
  // Sort newest first
  sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return sessions;
}

export async function getSessionMessages(sessionId: string): Promise<PersistedChatEntry[]> {
  const db = await openDB();
  const store = tx(db, MESSAGES_STORE, 'readonly');
  const index = store.index('sessionId');
  const messages = await req(index.getAll(sessionId)) as PersistedChatEntry[];
  // Sort by timestamp ascending
  messages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return messages;
}

export async function pruneOldSessions(days: number): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffISO = cutoff.toISOString();

  const db = await openDB();
  const sessions = await req(tx(db, SESSIONS_STORE, 'readonly').getAll()) as ChatSession[];
  const oldSessions = sessions.filter((s) => s.startedAt < cutoffISO);

  if (oldSessions.length === 0) return;

  for (const sess of oldSessions) {
    await clearSession(sess.id);
  }
}

export async function clearSession(sessionId: string): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([MESSAGES_STORE, SESSIONS_STORE], 'readwrite');
  const msgStore = transaction.objectStore(MESSAGES_STORE);
  const sessStore = transaction.objectStore(SESSIONS_STORE);

  // Delete all messages for this session
  const index = msgStore.index('sessionId');
  const keys = await req(index.getAllKeys(sessionId));
  for (const key of keys) {
    msgStore.delete(key);
  }

  // Delete the session itself
  sessStore.delete(sessionId);

  await txComplete(transaction);
}

export async function deleteSession(sessionId: string): Promise<void> {
  return clearSession(sessionId);
}
