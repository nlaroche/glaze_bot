import type { GachaCharacter } from '@glazebot/shared-types';
import type { CaptureSource } from '@glazebot/shared-ui';
import { CommentaryEngine, type ChatLogEntry } from '../commentary/engine';
import { createSession, persistMessage } from './chatHistory';

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

// ── Headless chat persistence (IndexedDB) ──
// Keeps messages across hot-reloads / restarts without any sidebar UI.
let currentSessionId: string | null = null;

async function ensureSession(): Promise<string> {
  if (currentSessionId) return currentSessionId;
  const partyNames = partySlots.filter((s): s is GachaCharacter => s !== null).map((c) => c.name);
  const sess = await createSession(partyNames);
  currentSessionId = sess.id;
  return sess.id;
}

// Restore chat from the most-recent session on module init
(async () => {
  try {
    const { getSessions, getSessionMessages } = await import('./chatHistory');
    const sessions = await getSessions();
    if (sessions.length > 0) {
      const latest = sessions[0]; // sorted newest-first
      const msgs = await getSessionMessages(latest.id);
      if (msgs.length > 0) {
        currentSessionId = latest.id;
        chatLog = msgs.map((m) => ({ ...m }));
      }
    }
  } catch { /* IndexedDB unavailable */ }
})();

// Wire engine callbacks once at module level
engine.onChatMessage = (entry) => {
  chatLog = [...chatLog, entry];
  // Persist to IndexedDB (fire-and-forget)
  ensureSession().then((sid) => persistMessage(entry, sid)).catch(() => {});
};

engine.onOverlayMessage = async (msg) => {
  if (!_overlayOnRaw) return;
  try {
    const { emitTo } = await import('@tauri-apps/api/event');
    await emitTo('overlay', 'chat-message', {
      name: msg.name,
      rarity: msg.rarity,
      text: msg.text,
      image: msg.image,
      visuals: msg.visuals,
    });
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
  currentSessionId = null; // next message starts a fresh session
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

  const party = getActiveParty();
  if (party.length === 0) return;

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
  // Persist user message to IndexedDB
  ensureSession().then((sid) => persistMessage(chatEntry, sid)).catch(() => {});

  if (isRunning) {
    // Engine is running — use the normal queue (includes frame capture, TTS, overlay)
    engine.queueUserMessage(text.trim());
  } else {
    // Engine not running — send direct text-only message (no frame, no TTS, no overlay)
    engine.sendDirectMessage(text.trim(), party);
  }
}

