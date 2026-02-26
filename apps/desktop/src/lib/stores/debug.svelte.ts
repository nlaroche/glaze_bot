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

export interface FrameCapture {
  id: number;
  timestamp: Date;
  b64: string;
  aiResponse?: string;
}

const MAX_ENTRIES = 100;
const MAX_FRAME_AGE_MS = 5 * 60 * 1000; // 5 minutes
let nextId = 1;
let nextFrameId = 1;

let entries = $state<DebugEntry[]>([]);
let recentFrames = $state<FrameCapture[]>([]);
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
    get recentFrames() { return recentFrames; },
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

/** Record a captured frame. Returns the frame ID for later attaching an AI response. */
export function captureFrame(b64: string): number {
  const id = nextFrameId++;
  const now = new Date();
  recentFrames = [
    ...recentFrames.filter((f) => now.getTime() - f.timestamp.getTime() < MAX_FRAME_AGE_MS),
    { id, timestamp: now, b64 },
  ];
  return id;
}

/** Attach an AI response to a previously captured frame. */
export function setFrameResponse(id: number, response: string) {
  recentFrames = recentFrames.map((f) =>
    f.id === id ? { ...f, aiResponse: response } : f,
  );
}

export function clearFrames() {
  recentFrames = [];
}
