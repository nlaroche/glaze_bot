export type DebugEntryType =
  | 'frame'
  | 'llm-request'
  | 'llm-response'
  | 'tts-request'
  | 'tts-response'
  | 'error'
  | 'info';

export interface DebugEntry {
  id: number;
  timestamp: Date;
  type: DebugEntryType;
  data: unknown;
}

const MAX_ENTRIES = 100;
let nextId = 1;

let entries = $state<DebugEntry[]>([]);
let commentaryGap = $state(30);
let gameHint = $state('');
let customSystemInstructions = $state('');
let totalLlmCalls = $state(0);
let totalTtsCalls = $state(0);
let totalInputTokens = $state(0);
let totalOutputTokens = $state(0);
let startedAt = $state<Date | null>(null);

export function getDebugStore() {
  return {
    get entries() { return entries; },
    get commentaryGap() { return commentaryGap; },
    get gameHint() { return gameHint; },
    get customSystemInstructions() { return customSystemInstructions; },
    get totalLlmCalls() { return totalLlmCalls; },
    get totalTtsCalls() { return totalTtsCalls; },
    get totalInputTokens() { return totalInputTokens; },
    get totalOutputTokens() { return totalOutputTokens; },
    get startedAt() { return startedAt; },
  };
}

export function setCommentaryGap(value: number) {
  commentaryGap = Math.max(30, Math.min(120, value));
}

export function setGameHint(value: string) {
  gameHint = value;
}

export function setCustomSystemInstructions(value: string) {
  customSystemInstructions = value;
}

export function logDebug(type: DebugEntryType, data: unknown) {
  const entry: DebugEntry = {
    id: nextId++,
    timestamp: new Date(),
    type,
    data,
  };
  entries = [...entries.slice(-(MAX_ENTRIES - 1)), entry];

  if (type === 'llm-request') totalLlmCalls++;
  if (type === 'tts-request') totalTtsCalls++;
  if (type === 'llm-response' && data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (d.usage && typeof d.usage === 'object') {
      const u = d.usage as Record<string, number>;
      totalInputTokens += u.input_tokens ?? 0;
      totalOutputTokens += u.output_tokens ?? 0;
    }
  }
}

export function clearDebugLog() {
  entries = [];
}

export function resetDebugStats() {
  totalLlmCalls = 0;
  totalTtsCalls = 0;
  totalInputTokens = 0;
  totalOutputTokens = 0;
  startedAt = null;
}

export function markStarted() {
  startedAt = new Date();
}

export function markStopped() {
  startedAt = null;
}
