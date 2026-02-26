import type { GachaCharacter } from '@glazebot/shared-types';
import type { CaptureSource } from '@glazebot/shared-ui';
import { CommentaryEngine, type ChatLogEntry } from '../commentary/engine';

// Module-level singleton state — survives SvelteKit navigation
let engine: CommentaryEngine = new CommentaryEngine();
let partySlots = $state<(GachaCharacter | null)[]>([null, null, null]);
let isRunning = $state(false);
let isPaused = $state(false);
let overlayOn = $state(false);
// Plain mirror of overlayOn for use in non-reactive async callbacks (engine callbacks).
// $state signals may not resolve correctly outside Svelte's reactive tracking context.
let _overlayOnRaw = false;
let chatLog = $state<ChatLogEntry[]>([]);
let activeShare = $state<CaptureSource | null>(null);

// Wire engine callbacks once at module level
engine.onChatMessage = (entry) => {
  chatLog = [...chatLog, entry];
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
