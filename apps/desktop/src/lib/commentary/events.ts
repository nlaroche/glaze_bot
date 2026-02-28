import type { EngineState, ChatLogEntry, MessageRequest, BlockType } from './types';

export interface ChatMessageEvent extends ChatLogEntry {}

export type EngineEventMap = {
  // Engine lifecycle
  'engine:started': {};
  'engine:stopped': {};
  'engine:paused': {};
  'engine:resumed': {};
  'state-change': { from: EngineState; to: EngineState };

  // Block scheduler
  'pipeline:block-selected': { requestId: string; blockType: BlockType; character: string; participants?: string[] };

  // Pipeline stage events
  'pipeline:start': { requestId: string; trigger: MessageRequest['trigger']; character: string; playerText?: string };
  'pipeline:frame': { requestId: string; size: number; width: number; height: number };
  'pipeline:frame-error': { requestId: string; error: string };
  'pipeline:llm-start': { requestId: string; character: string; historyLength: number; playerText?: string };
  'pipeline:llm-end': { requestId: string; character: string; text: string; usage?: { input_tokens: number; output_tokens: number }; visuals?: unknown[] };
  'pipeline:llm-error': { requestId: string; error: string; status?: number };
  'pipeline:silence': { requestId: string };
  'pipeline:abort': { requestId: string; reason: string };
  'pipeline:tts-start': { requestId: string; character: string; voiceId: string; textLength: number; mode: 'streaming' | 'buffered' };
  'pipeline:tts-end': { requestId: string; character: string; mode: 'streaming' | 'buffered'; ttfbMs: number; firstAudioMs: number; totalMs: number; audioSize: number };
  'pipeline:tts-error': { requestId: string; error: string };
  'pipeline:end': { requestId: string; trigger: MessageRequest['trigger'] };

  // Context loop
  'context:start': { sceneHistoryLength: number; detectedGame: string; gameSearchOnCooldown: boolean };
  'context:end': { description: string; game_name?: string; usage?: { input_tokens: number; output_tokens: number } };
  'context:error': { error: string };
  'context:skipped': { reason: string };

  // STT
  'stt:start': { mode: string; key?: string };
  'stt:end': { mode: string; text: string };

  // Memory
  'memory:extracted': { characterId: string; count: number };
  'memory:extraction-error': { error: string };

  // UI-facing events
  'chat-message': ChatMessageEvent;
  'overlay-show': { bubbleId: string; name: string; rarity: string; text: string; image?: string; visuals?: unknown[] };
  'overlay-dismiss': { bubbleId: string };
  'system-message': { text: string };
};

type Listener<T> = (data: T) => void;

export class EngineEventBus {
  private listeners = new Map<string, Set<Listener<any>>>();

  on<K extends keyof EngineEventMap>(event: K, fn: Listener<EngineEventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
    return () => {
      this.listeners.get(event)?.delete(fn);
    };
  }

  emit<K extends keyof EngineEventMap>(event: K, data: EngineEventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(data);
      } catch (err) {
        console.error(`[EngineEventBus] Error in listener for "${event}":`, err);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
