import type { GachaCharacter } from '@glazebot/shared-types';
import { getDebugStore, resetDebugStats, markStarted, markStopped, clearLogFile, clearSceneHistory } from '../stores/debug.svelte';
import { EngineEventBus } from './events';
import { DebugLogger } from './debug-logger';
import { ConversationHistory } from './history';
import { TtsPlayer } from './tts';
import { MessagePipeline } from './pipeline';
import { ContextLoop } from './context-loop';
import type { EngineState, FrameResult, MessageRequest } from './types';

// Re-export types that session store and other consumers need
export type { ChatLogEntry } from './types';

const POLL_INTERVAL_MS = 2000;
const REACT_CHANCE = 0.25;
const MAX_BACKOFF_MS = 60_000;

/**
 * CommentaryEngine — thin orchestrator that manages timers, queues, and state.
 * All message paths funnel through MessagePipeline. All logging flows through
 * EngineEventBus → DebugLogger. Zero logDebug() calls here.
 */
export class CommentaryEngine {
  /** Public event bus — session store subscribes to UI-facing events */
  readonly events = new EngineEventBus();

  private state: EngineState = 'idle';
  private loopTimer: ReturnType<typeof setTimeout> | null = null;
  private sourceId = '';
  private party: GachaCharacter[] = [];
  private consecutiveErrors = 0;
  private lastSpokeTime = 0;

  // User message queue
  private userMessageQueue: string[] = [];
  private cycleAbort: AbortController | null = null;

  // Components
  private pipeline: MessagePipeline;
  private history: ConversationHistory;
  private tts: TtsPlayer;
  private contextLoop: ContextLoop;
  private debugLogger: DebugLogger;

  constructor() {
    this.history = new ConversationHistory();
    this.tts = new TtsPlayer(this.events);
    this.pipeline = new MessagePipeline(this.events, this.history, this.tts);
    this.contextLoop = new ContextLoop(this.events);
    this.debugLogger = new DebugLogger(this.events);
    this.debugLogger.attach();
  }

  get isRunning() { return this.state !== 'stopped' && this.state !== 'idle'; }
  get isPaused() { return this.state === 'idle' && this._paused; }

  // Track paused separately since idle is also the state when not processing
  private _paused = false;
  private _running = false;

  async start(sourceId: string, party: GachaCharacter[]) {
    if (this._running) return;
    this._running = true;
    this._paused = false;
    this.sourceId = sourceId;
    this.party = party;
    this.history.clear();
    this.lastSpokeTime = 0;
    this.consecutiveErrors = 0;
    this.userMessageQueue = [];

    resetDebugStats();
    clearLogFile();
    markStarted();
    this.transition('idle');
    this.events.emit('engine:started', {});

    this.contextLoop.start(sourceId);
    this.scheduleNext();
  }

  pause() {
    this._paused = true;
    this.contextLoop.pause();
    this.events.emit('engine:paused', {});
  }

  resume() {
    if (!this._running) return;
    this._paused = false;
    this.contextLoop.resume();
    this.events.emit('engine:resumed', {});
    this.scheduleNext();
  }

  stop() {
    this._running = false;
    this._paused = false;
    this.userMessageQueue = [];
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
    this.contextLoop.stop();
    clearSceneHistory();
    markStopped();
    this.transition('stopped');
    this.events.emit('engine:stopped', {});
  }

  updateParty(party: GachaCharacter[]) {
    this.party = party;
  }

  queueUserMessage(text: string) {
    this.userMessageQueue.push(text);

    // Abort timed cycle so user message gets priority
    if (this.cycleAbort) {
      this.cycleAbort.abort();
    }

    if (this.state === 'idle' && !this._paused) {
      this.processNext();
    }
  }

  /** Send a direct text-only message (works without engine running). */
  async sendDirectMessage(text: string, party: GachaCharacter[]): Promise<void> {
    if (!text.trim() || party.length === 0) return;
    if (this.state === 'processing') {
      this.userMessageQueue.push(text);
      return;
    }

    this.transition('processing');

    try {
      const character = this.matchCharacterByName(text, party) ??
        party[Math.floor(Math.random() * party.length)];

      const request = this.buildRequest({
        character,
        trigger: 'direct',
        playerText: text,
      });

      await this.pipeline.process(request);
    } catch {
      // Errors already emitted by pipeline
    } finally {
      this.transition('idle');
      // Drain any messages that queued while we were busy
      if (this.userMessageQueue.length > 0) {
        const next = this.userMessageQueue.shift()!;
        this.sendDirectMessage(next, party);
      }
    }
  }

  // ── Private Methods ────────────────────────────────────────────

  private transition(to: EngineState) {
    const from = this.state;
    if (from === to) return;
    this.state = to;
    this.events.emit('state-change', { from, to });
  }

  private scheduleNext() {
    if (!this._running || this._paused) return;
    const backoff = this.consecutiveErrors > 0
      ? Math.min(POLL_INTERVAL_MS * Math.pow(2, this.consecutiveErrors), MAX_BACKOFF_MS)
      : POLL_INTERVAL_MS;
    this.loopTimer = setTimeout(() => this.processNext(), backoff);
  }

  private async processNext() {
    if (!this._running || this._paused) return;
    if (this.state === 'processing') return;
    if (this.party.length === 0) {
      this.scheduleNext();
      return;
    }

    // User messages have priority
    if (this.userMessageQueue.length > 0) {
      await this.processUserMessage();
    } else {
      await this.processTimedCycle();
    }

    this.scheduleNext();
  }

  private async processTimedCycle() {
    const debugStore = getDebugStore();
    const gap = debugStore.commentaryGap;
    const now = Date.now();

    if (this.lastSpokeTime > 0 && now - this.lastSpokeTime < gap * 1000) {
      return;
    }

    this.transition('processing');
    this.cycleAbort = new AbortController();
    const signal = this.cycleAbort.signal;

    try {
      // Grab frame
      let frameB64: string;
      let frameDims = { width: 1920, height: 1080 };
      let debugFrameId: number;
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const frame = await invoke<FrameResult>('grab_frame', { sourceId: this.sourceId, withGrid: true });
        frameB64 = frame.data_uri.replace(/^data:image\/[a-z]+;base64,/, '');
        frameDims = { width: frame.width, height: frame.height };
        this.contextLoop.notifyFrameGrab();

        this.events.emit('pipeline:frame', { requestId: '', size: frameB64.length, width: frame.width, height: frame.height });
        debugFrameId = this.debugLogger.recordFrame(frame.data_uri);

        // Attach scene context to frame for debug UI
        const sceneContext = this.contextLoop.getSceneContext();
        if (sceneContext) {
          const debugScenes = sceneContext.descriptions.map((d) => ({
            timestamp: new Date(),
            description: d,
          }));
          this.debugLogger.recordFrameSceneContext(debugFrameId, debugScenes, sceneContext.game_name ?? '');
        }
      } catch (err) {
        this.events.emit('pipeline:frame-error', { requestId: '', error: err instanceof Error ? err.message : String(err) });
        this.transition('idle');
        throw err;
      }

      // Pick random character
      const character = this.party[Math.floor(Math.random() * this.party.length)];

      const request = this.buildRequest({
        character,
        trigger: 'timed',
        frameB64,
        frameDims,
        sceneContext: this.contextLoop.getSceneContext(),
        enableVisuals: true,
        signal,
        debugFrameId,
      });

      const result = await this.pipeline.process(request);
      this.consecutiveErrors = 0;

      if (result.text && debugFrameId !== undefined) {
        this.debugLogger.recordFrameResponse(debugFrameId, result.text);
      }

      if (!signal.aborted && result.text) {
        this.lastSpokeTime = Date.now();

        // 25% chance of character reaction
        if (this.party.length > 1 && Math.random() < REACT_CHANCE) {
          await this.processReaction(character, result.text, frameB64!);
        }
      }
    } catch (err) {
      if (signal.aborted) {
        // Expected — user message preempted timed cycle
      } else {
        this.consecutiveErrors++;
      }
    } finally {
      this.transition('idle');
      this.cycleAbort = null;
      // Check for queued user messages
      if (this.userMessageQueue.length > 0 && !this._paused && this._running) {
        setTimeout(() => this.processNext(), 0);
      }
    }
  }

  private async processUserMessage() {
    if (this.userMessageQueue.length === 0) return;

    this.transition('processing');

    try {
      const message = this.userMessageQueue.shift()!;
      const character = this.matchCharacterByName(message, this.party) ??
        this.party[Math.floor(Math.random() * this.party.length)];

      // Grab frame
      let frameB64: string | undefined;
      let frameDims: { width: number; height: number } | undefined;
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const frame = await invoke<FrameResult>('grab_frame', { sourceId: this.sourceId, withGrid: true });
        frameB64 = frame.data_uri.replace(/^data:image\/[a-z]+;base64,/, '');
        frameDims = { width: frame.width, height: frame.height };
        this.contextLoop.notifyFrameGrab();
      } catch (err) {
        this.events.emit('pipeline:frame-error', { requestId: '', error: err instanceof Error ? err.message : String(err) });
        this.events.emit('system-message', { text: 'Failed to capture screen — is the share source still active?' });
        return;
      }

      const request = this.buildRequest({
        character,
        trigger: 'user',
        frameB64,
        frameDims,
        playerText: message,
        sceneContext: this.contextLoop.getSceneContext(),
        enableVisuals: true,
      });

      await this.pipeline.process(request);
      this.lastSpokeTime = Date.now();
    } catch {
      // Errors already emitted by pipeline
    } finally {
      this.transition('idle');
      // Process next queued message if any
      if (this.userMessageQueue.length > 0) {
        setTimeout(() => this.processNext(), 100);
      }
    }
  }

  private async processReaction(
    speaker: GachaCharacter,
    spokenText: string,
    frameB64: string,
  ) {
    const others = this.party.filter((c) => c.id !== speaker.id);
    if (others.length === 0) return;
    const reactor = others[Math.floor(Math.random() * others.length)];

    const request = this.buildRequest({
      character: reactor,
      trigger: 'reaction',
      frameB64,
      reactTo: { name: speaker.name, text: spokenText },
      sceneContext: this.contextLoop.getSceneContext(),
      enableVisuals: true,
    });

    try {
      await this.pipeline.process(request);
    } catch {
      // Errors already emitted by pipeline
    }
  }

  private buildRequest(opts: Omit<MessageRequest, 'id'>): MessageRequest {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...opts,
    };
  }

  private matchCharacterByName(text: string, party: GachaCharacter[]): GachaCharacter | null {
    const lower = text.toLowerCase();
    for (const char of party) {
      const fullName = char.name.toLowerCase();
      const firstName = fullName.split(' ')[0];
      if (lower.includes(fullName) || lower.includes(firstName)) {
        return char;
      }
    }
    return null;
  }
}
