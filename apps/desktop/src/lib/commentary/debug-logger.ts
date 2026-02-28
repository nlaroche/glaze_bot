import type { EngineEventBus, EngineEventMap } from './events';
import {
  logDebug,
  pushError,
  pushTtsTiming,
  captureFrame,
  setFrameResponse,
  setFrameSceneContext,
} from '../stores/debug.svelte';

/**
 * Event bus subscriber that handles ALL debug logging.
 * Zero logDebug() calls exist in engine/pipeline/tts/context —
 * this class owns all logging, timing computation, and file flushing.
 */
export class DebugLogger {
  private unsubs: (() => void)[] = [];
  private requestTimings = new Map<string, {
    start: number;
    llmStart?: number;
    ttsStart?: number;
    trigger?: string;
  }>();

  constructor(private events: EngineEventBus) {}

  /** Subscribe to all events. Call once at engine creation. */
  attach(): void {
    // Engine lifecycle
    this.sub('engine:started', () => logDebug('info', 'Commentary engine started'));
    this.sub('engine:stopped', () => logDebug('info', 'Commentary engine stopped'));
    this.sub('engine:paused', () => logDebug('info', 'Commentary engine paused'));
    this.sub('engine:resumed', () => logDebug('info', 'Commentary engine resumed'));

    // Pipeline stages
    this.sub('pipeline:start', (d) => {
      this.requestTimings.set(d.requestId, { start: Date.now(), trigger: d.trigger });
    });

    this.sub('pipeline:frame', (d) => {
      logDebug('frame', { size: d.size, width: d.width, height: d.height });
    });

    this.sub('pipeline:frame-error', (d) => {
      logDebug('error', { step: 'grab_frame', message: d.error });
      pushError('Frame Capture', d.error);
    });

    this.sub('pipeline:llm-start', (d) => {
      const t = this.requestTimings.get(d.requestId);
      if (t) t.llmStart = Date.now();
      logDebug('llm-request', {
        character: d.character,
        historyLength: d.historyLength,
        playerText: d.playerText,
      });
    });

    this.sub('pipeline:llm-end', (d) => {
      logDebug('llm-response', {
        character: d.character,
        text: d.text,
        usage: d.usage,
      });
    });

    this.sub('pipeline:llm-error', (d) => {
      logDebug('error', { step: 'generate-commentary', status: d.status, message: d.error });
      pushError('LLM', d.status ? `HTTP ${d.status}: ${d.error}` : d.error, { status: d.status });
    });

    this.sub('pipeline:silence', () => {
      // No log needed for silence — it's a normal outcome
    });

    this.sub('pipeline:abort', (d) => {
      logDebug('info', { message: d.reason });
    });

    this.sub('pipeline:tts-start', (d) => {
      const t = this.requestTimings.get(d.requestId);
      if (t) t.ttsStart = Date.now();
      logDebug('tts-request', {
        character: d.character,
        voiceId: d.voiceId,
        textLength: d.textLength,
        mode: d.mode,
      });
    });

    this.sub('pipeline:tts-end', (d) => {
      logDebug('tts-response', {
        character: d.character,
        mode: d.mode,
        ttfbMs: d.ttfbMs,
        firstAudioMs: d.firstAudioMs,
        totalMs: d.totalMs,
        audioSize: d.audioSize,
      });

      // Compute full timing chain for the analytics dashboard
      const t = this.requestTimings.get(d.requestId);
      if (t) {
        const llmDuration = t.llmStart && t.ttsStart
          ? t.ttsStart - t.llmStart
          : 0;
        const ttsRequestDuration = d.ttfbMs;
        const ttsTransferDuration = d.firstAudioMs - d.ttfbMs;
        const playbackDuration = d.totalMs - d.firstAudioMs;

        pushTtsTiming({
          id: `${Date.now()}-${d.character}`,
          mode: d.mode,
          timestamp: new Date(),
          llmDuration: Math.round(llmDuration),
          ttsRequestDuration,
          ttsTransferDuration: Math.max(0, ttsTransferDuration),
          ttsFirstAudio: d.firstAudioMs,
          playbackDuration: Math.max(0, playbackDuration),
          totalDuration: d.totalMs,
          audioSize: d.audioSize,
          characterName: d.character,
        });
      }
    });

    this.sub('pipeline:tts-error', (d) => {
      logDebug('error', { step: 'tts', message: d.error });
      pushError('TTS', d.error);
    });

    this.sub('pipeline:end', (d) => {
      this.requestTimings.delete(d.requestId);
    });

    // Context loop
    this.sub('context:start', (d) => {
      logDebug('context-request', {
        sceneHistoryLength: d.sceneHistoryLength,
        detectedGame: d.detectedGame,
        gameSearchOnCooldown: d.gameSearchOnCooldown,
      });
    });

    this.sub('context:end', (d) => {
      logDebug('context-response', {
        description: d.description,
        game_name: d.game_name,
        usage: d.usage,
      });
    });

    this.sub('context:error', (d) => {
      logDebug('error', { step: 'context', message: d.error });
      pushError('Context', d.error);
    });

    this.sub('context:skipped', (d) => {
      logDebug('info', { message: `Context tick skipped — ${d.reason}` });
    });

    // Memory
    this.sub('memory:extraction-error', (d) => {
      logDebug('error', { step: 'memory-extraction', message: d.error });
      pushError('Memory', d.error);
    });

    // STT
    this.sub('stt:start', (d) => logDebug('stt-request', d));
    this.sub('stt:end', (d) => logDebug('stt-response', d));
  }

  /** Store a captured frame and return its debug ID for later attaching responses. */
  recordFrame(dataUri: string): number {
    return captureFrame(dataUri);
  }

  /** Attach an AI response to a previously captured frame. */
  recordFrameResponse(frameId: number, text: string): void {
    setFrameResponse(frameId, text);
  }

  /** Attach scene context to a previously captured frame. */
  recordFrameSceneContext(
    frameId: number,
    scenes: { timestamp: Date; description: string }[],
    game: string,
  ): void {
    setFrameSceneContext(frameId, scenes, game);
  }

  /** Unsubscribe from everything. */
  detach(): void {
    this.unsubs.forEach((fn) => fn());
    this.unsubs = [];
    this.requestTimings.clear();
  }

  private sub<K extends keyof EngineEventMap>(event: K, fn: (d: EngineEventMap[K]) => void): void {
    this.unsubs.push(this.events.on(event, fn));
  }
}
