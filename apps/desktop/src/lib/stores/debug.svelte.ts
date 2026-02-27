export type DebugEntryType =
  | 'frame'
  | 'llm-request'
  | 'llm-response'
  | 'tts-request'
  | 'tts-response'
  | 'context-request'
  | 'context-response'
  | 'stt-request'
  | 'stt-response'
  | 'error'
  | 'info';

export interface DebugEntry {
  id: number;
  timestamp: Date;
  type: DebugEntryType;
  data: unknown;
}

export interface SceneSnapshot {
  timestamp: Date;
  description: string;
}

export interface FrameCapture {
  id: number;
  timestamp: Date;
  b64: string;
  aiResponse?: string;
  sceneContext?: SceneSnapshot[];
  detectedGame?: string;
}

const MAX_ENTRIES = 100;
const MAX_FRAME_AGE_MS = 5 * 60 * 1000; // 5 minutes
const FLUSH_INTERVAL_MS = 5000; // Flush to file every 5 seconds
let nextId = 1;
let nextFrameId = 1;

// File-flush state
let pendingFlush: DebugEntry[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let logFilePath: string | null = null;

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

// Speech input state
let speechMode = $state<'off' | 'push-to-talk' | 'always-on'>('push-to-talk');
let pttKey = $state('ShiftLeft');
let vadThreshold = $state(0.02);
let vadSilenceMs = $state(1500);
let totalSttCalls = $state(0);

// Context analysis state
let detectedGame = $state('');
let sceneHistory = $state<SceneSnapshot[]>([]);
let totalContextCalls = $state(0);
let contextEnabled = $state(true);
let contextInterval = $state(3);
let contextBufferSize = $state(10);

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
    get detectedGame() { return detectedGame; },
    get sceneHistory() { return sceneHistory; },
    get totalContextCalls() { return totalContextCalls; },
    get contextEnabled() { return contextEnabled; },
    get contextInterval() { return contextInterval; },
    get contextBufferSize() { return contextBufferSize; },
    get speechMode() { return speechMode; },
    get pttKey() { return pttKey; },
    get vadThreshold() { return vadThreshold; },
    get vadSilenceMs() { return vadSilenceMs; },
    get totalSttCalls() { return totalSttCalls; },
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

export function setDetectedGame(value: string) {
  detectedGame = value;
}

export function pushSceneSnapshot(description: string, bufferSize?: number) {
  const max = bufferSize ?? contextBufferSize;
  const snapshot: SceneSnapshot = { timestamp: new Date(), description };
  sceneHistory = [...sceneHistory.slice(-(max - 1)), snapshot];
}

export function clearSceneHistory() {
  sceneHistory = [];
  detectedGame = '';
}

export function setFrameSceneContext(frameId: number, scenes: SceneSnapshot[], game: string) {
  recentFrames = recentFrames.map((f) =>
    f.id === frameId ? { ...f, sceneContext: scenes, detectedGame: game } : f,
  );
}

export function setContextEnabled(value: boolean) {
  contextEnabled = value;
}

export function setContextInterval(value: number) {
  contextInterval = Math.max(1, Math.min(30, value));
}

export function setContextBufferSize(value: number) {
  contextBufferSize = Math.max(1, Math.min(50, value));
}

export function setSpeechMode(value: 'off' | 'push-to-talk' | 'always-on') {
  speechMode = value;
}

export function setPttKey(value: string) {
  pttKey = value;
}

export function setVadThreshold(value: number) {
  vadThreshold = Math.max(0.005, Math.min(0.1, value));
}

export function setVadSilenceMs(value: number) {
  vadSilenceMs = Math.max(500, Math.min(5000, value));
}

export function logDebug(type: DebugEntryType, data: unknown) {
  const entry: DebugEntry = {
    id: nextId++,
    timestamp: new Date(),
    type,
    data,
  };
  entries = [...entries.slice(-(MAX_ENTRIES - 1)), entry];
  pendingFlush.push(entry);

  if (type === 'llm-request') totalLlmCalls++;
  if (type === 'tts-request') totalTtsCalls++;
  if (type === 'context-request') totalContextCalls++;
  if (type === 'stt-request') totalSttCalls++;
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
  totalContextCalls = 0;
  totalSttCalls = 0;
  startedAt = null;
  detectedGame = '';
  sceneHistory = [];
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

// ── File-based debug log flushing ──────────────────────────────────

function formatEntry(entry: DebugEntry): string {
  const ts = entry.timestamp.toISOString();
  const type = entry.type.toUpperCase().padEnd(16);
  let data = '';
  try {
    data = typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data);
  } catch {
    data = String(entry.data);
  }
  // Truncate very long data (e.g. base64 frames) to keep the log readable
  if (data.length > 500) {
    data = data.slice(0, 497) + '...';
  }
  return `[${ts}] ${type} ${data}\n`;
}

async function flushToFile() {
  if (pendingFlush.length === 0) return;

  const batch = pendingFlush.splice(0);
  const lines = batch.map(formatEntry).join('');

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const path = await invoke<string>('append_debug_log', { lines });
    if (!logFilePath) {
      logFilePath = path;
      console.info(`[debug] Log file: ${path}`);
    }
  } catch (err) {
    // If Tauri isn't available (e.g. browser dev), just silently skip
    console.warn('[debug] File flush failed:', err);
  }
}

/** Start periodic log flushing to disk. Call once at app startup. */
export function startLogFlushing() {
  if (flushTimer) return;
  flushTimer = setInterval(flushToFile, FLUSH_INTERVAL_MS);
  // Also flush on page unload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => { flushToFile(); });
  }
}

/** Stop periodic log flushing. */
export function stopLogFlushing() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  // Final flush
  flushToFile();
}

/** Get the path to the debug log file (null if not yet flushed). */
export function getLogFilePath(): string | null {
  return logFilePath;
}

/** Clear the on-disk debug log file. */
export async function clearLogFile() {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('clear_debug_log');
  } catch { /* ignore */ }
}
