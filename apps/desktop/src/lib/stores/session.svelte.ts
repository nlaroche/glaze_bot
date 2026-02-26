import type { GachaCharacter } from '@glazebot/shared-types';
import type { CaptureSource } from '@glazebot/shared-ui';
import { CommentaryEngine, type ChatLogEntry } from '../commentary/engine';

// Module-level singleton state — survives SvelteKit navigation
let engine: CommentaryEngine = new CommentaryEngine();
let partySlots = $state<(GachaCharacter | null)[]>([null, null, null]);
let isRunning = $state(false);
let isPaused = $state(false);
let overlayOn = $state(false);
let chatLog = $state<ChatLogEntry[]>([]);
let activeShare = $state<CaptureSource | null>(null);

// Wire engine callbacks once at module level
engine.onChatMessage = (entry) => {
  chatLog = [...chatLog, entry];
};

engine.onOverlayMessage = async (msg) => {
  // Read overlayOn via getter to ensure we get the current $state value
  if (!getSessionStore().overlayOn) return;
  try {
    const { emitTo } = await import('@tauri-apps/api/event');
    await emitTo('overlay', 'chat-message', msg);
  } catch (e) {
    console.error('Failed to emit to overlay:', e);
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
