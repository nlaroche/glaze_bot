import { getSupabaseUrl, getSession } from '@glazebot/supabase-client';
import { getDebugStore, setDetectedGame, pushSceneSnapshot } from '../stores/debug.svelte';
import type { EngineEventBus } from './events';
import type { FrameResult, SceneContext } from './types';

/** Skip context tick if a frame was grabbed within this window (ms) */
const CONTEXT_FRAME_DEDUP_MS = 5000;
/** After detecting a game, wait this long before re-checking with Gemini search (ms) */
const GAME_SEARCH_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export class ContextLoop {
  private contextTimer: ReturnType<typeof setTimeout> | null = null;
  private detectedGame = '';
  private sceneHistory: { timestamp: number; description: string }[] = [];
  private contextRunning = false;
  private gameDetectedAt = 0;
  private sourceId = '';
  private running = false;
  private paused = false;

  /** Timestamp of last frame grab (shared with engine to avoid redundant calls) */
  lastFrameGrabTime = 0;

  constructor(private events: EngineEventBus) {}

  start(sourceId: string): void {
    this.sourceId = sourceId;
    this.running = true;
    this.paused = false;
    this.detectedGame = '';
    this.sceneHistory = [];
    this.contextRunning = false;
    this.gameDetectedAt = 0;
    this.lastFrameGrabTime = 0;

    const debugStore = getDebugStore();
    if (!debugStore.contextEnabled) return;
    this.scheduleTick();
  }

  stop(): void {
    this.running = false;
    this.paused = false;
    if (this.contextTimer) {
      clearTimeout(this.contextTimer);
      this.contextTimer = null;
    }
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.scheduleTick();
  }

  getSceneContext(): SceneContext | undefined {
    if (this.sceneHistory.length === 0) return undefined;
    return {
      game_name: this.detectedGame || undefined,
      descriptions: this.sceneHistory.map((s) => s.description),
    };
  }

  /** Notify that a frame was grabbed externally (e.g. by the commentary cycle) */
  notifyFrameGrab(): void {
    this.lastFrameGrabTime = Date.now();
  }

  private scheduleTick(): void {
    if (!this.running || this.paused) return;
    const debugStore = getDebugStore();
    if (!debugStore.contextEnabled) return;
    const intervalMs = debugStore.contextInterval * 1000;
    this.contextTimer = setTimeout(() => this.tick(), intervalMs);
  }

  private async tick(): Promise<void> {
    if (this.contextRunning || this.paused || !this.running) {
      this.scheduleTick();
      return;
    }

    const debugStore = getDebugStore();
    if (!debugStore.contextEnabled) return;

    // Skip if a frame was grabbed recently
    const sinceLast = Date.now() - this.lastFrameGrabTime;
    if (sinceLast < CONTEXT_FRAME_DEDUP_MS) {
      this.events.emit('context:skipped', {
        reason: `Frame grabbed ${(sinceLast / 1000).toFixed(1)}s ago`,
      });
      this.scheduleTick();
      return;
    }

    this.contextRunning = true;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const frame = await invoke<FrameResult>('grab_frame', { sourceId: this.sourceId });
      const frameB64 = frame.data_uri.replace(/^data:image\/[a-z]+;base64,/, '');

      const gameSearchOnCooldown = !!(this.detectedGame && (Date.now() - this.gameDetectedAt < GAME_SEARCH_COOLDOWN_MS));

      this.events.emit('context:start', {
        sceneHistoryLength: this.sceneHistory.length,
        detectedGame: this.detectedGame,
        gameSearchOnCooldown,
      });

      const session = await getSession();
      if (!session) {
        this.events.emit('context:error', { error: 'Not authenticated' });
        return;
      }

      const supabaseUrl = getSupabaseUrl();
      const previousDescription = this.sceneHistory.length > 0
        ? this.sceneHistory[this.sceneHistory.length - 1].description
        : undefined;

      const res = await fetch(
        `${supabaseUrl}/functions/v1/describe-scene`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            frame_b64: frameB64,
            previous_description: previousDescription,
            game_name: (this.detectedGame && gameSearchOnCooldown) ? this.detectedGame : undefined,
          }),
        },
      );

      if (!res.ok) {
        const errText = await res.text();
        this.events.emit('context:error', { error: `describe-scene ${res.status}: ${errText}` });
        return;
      }

      const data = await res.json();

      this.events.emit('context:end', {
        description: data.description,
        game_name: data.game_name,
        usage: data.usage,
      });

      // Update detected game
      if (data.game_name && data.game_name !== this.detectedGame) {
        this.detectedGame = data.game_name;
        this.gameDetectedAt = Date.now();
        setDetectedGame(data.game_name);
      }

      // Push to scene history
      const bufferSize = debugStore.contextBufferSize;
      this.sceneHistory.push({
        timestamp: Date.now(),
        description: data.description,
      });
      while (this.sceneHistory.length > bufferSize) {
        this.sceneHistory.shift();
      }

      pushSceneSnapshot(data.description, bufferSize);
    } catch (err) {
      this.events.emit('context:error', {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.contextRunning = false;
      this.scheduleTick();
    }
  }
}
