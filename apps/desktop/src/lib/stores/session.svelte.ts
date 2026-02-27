import type { GachaCharacter } from '@glazebot/shared-types';
import type { CaptureSource } from '@glazebot/shared-ui';
import { CommentaryEngine, type ChatLogEntry } from '../commentary/engine';
import {
  createSession,
  persistMessage,
  getSessions,
  getSessionMessages,
  pruneOldSessions,
  deleteSession,
  type ChatSession,
  type PersistedChatEntry,
} from './chatHistory';

// Module-level singleton state — survives SvelteKit navigation
let engine: CommentaryEngine = new CommentaryEngine();
let partySlots = $state<(GachaCharacter | null)[]>([null, null, null]);
let isRunning = $state(false);
let isPaused = $state(false);

// Overlay preference — persisted to localStorage, defaults to ON
function loadOverlayPref(): boolean {
  try {
    const stored = localStorage.getItem('glazebot-overlay-pref');
    if (stored !== null) return stored === 'true';
  } catch { /* SSR or localStorage unavailable */ }
  return true; // default ON
}
let overlayOn = $state(loadOverlayPref());
// Plain mirror of overlayOn for use in non-reactive async callbacks (engine callbacks).
// $state signals may not resolve correctly outside Svelte's reactive tracking context.
let _overlayOnRaw = overlayOn;
let chatLog = $state<ChatLogEntry[]>([]);
let activeShare = $state<CaptureSource | null>(null);
let isRecording = $state(false);
let sttBubbleText = $state<string | null>(null);
let sttBubbleTimer: ReturnType<typeof setTimeout> | null = null;

// ── Chat history persistence state ──
let currentSessionId = $state<string | null>(null);
let historySessions = $state<ChatSession[]>([]);
let viewingSessionId = $state<string | null>(null); // null = live session
let historyInitialized = false;

// Wire engine callbacks once at module level
engine.onChatMessage = (entry) => {
  chatLog = [...chatLog, entry];

  // Persist to IndexedDB
  if (currentSessionId) {
    persistMessage(entry, currentSessionId).catch((err) => {
      console.error('Failed to persist chat message:', err);
    });
  }
};

engine.onOverlayMessage = async (msg) => {
  if (!_overlayOnRaw) return;
  try {
    const { emitTo } = await import('@tauri-apps/api/event');
    await emitTo('overlay', 'chat-message', msg);
  } catch (e) {
    console.error('Failed to emit to overlay:', e);
  }
};

engine.onOverlayDismiss = async () => {
  if (!_overlayOnRaw) return;
  try {
    const { emitTo } = await import('@tauri-apps/api/event');
    await emitTo('overlay', 'chat-dismiss', {});
  } catch (e) {
    console.error('Failed to emit dismiss to overlay:', e);
  }
};

export function getSessionStore() {
  return {
    get engine() { return engine; },
    get partySlots() { return partySlots; },
    get isRunning() { return isRunning; },
    get isPaused() { return isPaused; },
    get overlayOn() { return overlayOn; },
    get chatLog() { return chatLog; },
    get activeShare() { return activeShare; },
    get currentSessionId() { return currentSessionId; },
    get historySessions() { return historySessions; },
    get viewingSessionId() { return viewingSessionId; },
    get isViewingHistory() { return viewingSessionId !== null; },
    get isRecording() { return isRecording; },
    get sttBubbleText() { return sttBubbleText; },
  };
}

export function setPartySlot(index: number, char: GachaCharacter | null) {
  partySlots[index] = char;
}

export function setActiveShare(source: CaptureSource | null) {
  activeShare = source;
}

export function setRunning(value: boolean) {
  isRunning = value;
}

export function setPaused(value: boolean) {
  isPaused = value;
}

export function setOverlayOn(value: boolean) {
  overlayOn = value;
  _overlayOnRaw = value;
  try {
    localStorage.setItem('glazebot-overlay-pref', String(value));
  } catch { /* localStorage unavailable */ }
}

export function addChatEntry(entry: ChatLogEntry) {
  chatLog = [...chatLog, entry];
}

export function clearChatLog() {
  chatLog = [];
}

export function getActiveParty(): GachaCharacter[] {
  return partySlots.filter((s): s is GachaCharacter => s !== null);
}

export function setRecording(value: boolean) {
  isRecording = value;
}

export function showSttBubble(text: string) {
  sttBubbleText = text;
  if (sttBubbleTimer) clearTimeout(sttBubbleTimer);
  sttBubbleTimer = setTimeout(() => {
    sttBubbleText = null;
    sttBubbleTimer = null;
  }, 4000);
}

export function sendUserMessage(text: string) {
  if (!text.trim()) return;

  const timeStr = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const chatEntry: ChatLogEntry = {
    id: `${Date.now()}-user`,
    characterId: 'user',
    name: 'You',
    rarity: 'user',
    text: text.trim(),
    time: timeStr,
    timestamp: new Date().toISOString(),
    isUserMessage: true,
  };

  chatLog = [...chatLog, chatEntry];

  // Persist to IndexedDB
  if (currentSessionId) {
    persistMessage(chatEntry, currentSessionId).catch((err) => {
      console.error('Failed to persist user message:', err);
    });
  }

  // Queue on engine
  engine.queueUserMessage(text.trim());
}

// ── Chat history functions ──

/** Initialize chat history — call once on app startup */
export async function initChatHistory(): Promise<void> {
  if (historyInitialized) return;
  historyInitialized = true;

  try {
    // Prune sessions older than 30 days
    await pruneOldSessions(30);
    // Load session list
    historySessions = await getSessions();
  } catch (err) {
    console.error('Failed to initialize chat history:', err);
  }
}

/** Start a new commentary session — replaces clearChatLog() */
export async function startNewSession(partyNames: string[]): Promise<void> {
  try {
    const session = await createSession(partyNames);
    currentSessionId = session.id;
    viewingSessionId = null; // Switch to live view
    chatLog = [];

    // Refresh session list
    historySessions = await getSessions();
  } catch (err) {
    console.error('Failed to create new session:', err);
    // Fallback: just clear the log
    currentSessionId = null;
    chatLog = [];
  }
}

/** View a past session's messages (read-only) */
export async function viewSession(sessionId: string): Promise<void> {
  try {
    const messages = await getSessionMessages(sessionId);
    viewingSessionId = sessionId;
    chatLog = messages;
  } catch (err) {
    console.error('Failed to load session messages:', err);
  }
}

/** Return to the live session view */
export function returnToLive(): void {
  viewingSessionId = null;
  chatLog = []; // Live messages will continue from here
}

/** Delete a past session and refresh the list */
export async function removeSession(sessionId: string): Promise<void> {
  try {
    await deleteSession(sessionId);
    historySessions = await getSessions();

    // If we were viewing the deleted session, go back to live
    if (viewingSessionId === sessionId) {
      returnToLive();
    }
  } catch (err) {
    console.error('Failed to delete session:', err);
  }
}

/** Refresh the sessions list from DB */
export async function refreshSessions(): Promise<void> {
  try {
    historySessions = await getSessions();
  } catch (err) {
    console.error('Failed to refresh sessions:', err);
  }
}
