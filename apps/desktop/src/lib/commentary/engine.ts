import type { GachaCharacter } from '@glazebot/shared-types';
import { getSupabaseUrl, getSession } from '@glazebot/supabase-client';
import {
  logDebug,
  getDebugStore,
  markStarted,
  markStopped,
  resetDebugStats,
  captureFrame,
  setFrameResponse,
  setDetectedGame,
  pushSceneSnapshot,
  clearSceneHistory,
  setFrameSceneContext,
} from '../stores/debug.svelte';

/** Strip markdown formatting so TTS doesn't read asterisks, hashes, etc. */
function cleanForTTS(text: string): string {
  return text
    .replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')   // *bold*, **bold**, ***bold***
    .replace(/_{1,3}(.*?)_{1,3}/g, '$1')       // _italic_, __underline__
    .replace(/~~(.*?)~~/g, '$1')                // ~~strikethrough~~
    .replace(/`{1,3}(.*?)`{1,3}/gs, '$1')      // `code`, ```blocks```
    .replace(/^#{1,6}\s+/gm, '')                // # headers
    .replace(/^\s*[-*+]\s+/gm, '')              // - bullet points
    .replace(/^\s*\d+\.\s+/gm, '')              // 1. numbered lists
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')    // [links](url)
    .replace(/\n{3,}/g, '\n\n')                 // collapse excess newlines
    .trim();
}

const MAX_HISTORY = 10; // 10 turns = 20 messages
const POLL_INTERVAL_MS = 2000;
const REACT_CHANCE = 0.25;

interface HistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatLogEntry {
  id: string;
  characterId: string;
  name: string;
  rarity: string;
  text: string;
  time: string;
  timestamp: string; // ISO timestamp for persistence
  voiceId?: string;
  image?: string;
  isUserMessage?: boolean;
}

/**
 * CommentaryEngine — manages the screenshot→LLM→TTS→overlay pipeline.
 *
 * Usage:
 *   const engine = new CommentaryEngine();
 *   engine.onChatMessage = (entry) => { ... };
 *   await engine.start(sourceId, party);
 *   engine.pause();
 *   engine.resume();
 *   engine.stop();
 */
export class CommentaryEngine {
  private running = false;
  private paused = false;
  private loopTimer: ReturnType<typeof setTimeout> | null = null;
  private histories: Map<string, HistoryEntry[]> = new Map();
  private lastSpokeTime = 0;
  private sourceId = '';
  private party: GachaCharacter[] = [];
  private speaking = false;
  private consecutiveErrors = 0;
  private static readonly MAX_BACKOFF_MS = 60_000;

  // Context loop state
  private contextTimer: ReturnType<typeof setTimeout> | null = null;
  private detectedGame = '';
  private sceneHistory: { timestamp: number; description: string }[] = [];
  private contextRunning = false;

  // User message queue
  private userMessageQueue: string[] = [];
  private processingUserMessage = false;

  /** Callback fired when a new chat message is produced */
  onChatMessage: ((entry: ChatLogEntry) => void) | null = null;

  /** Callback to emit events to overlay */
  onOverlayMessage:
    | ((msg: { name: string; rarity: string; text: string; image?: string; visuals?: Record<string, unknown>[] }) => void)
    | null = null;

  /** Callback fired when overlay bubble should dismiss (after audio ends) */
  onOverlayDismiss: (() => void) | null = null;

  get isRunning() {
    return this.running;
  }
  get isPaused() {
    return this.paused;
  }

  async start(sourceId: string, party: GachaCharacter[]) {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.sourceId = sourceId;
    this.party = party;
    this.histories.clear();
    this.lastSpokeTime = 0;
    this.speaking = false;
    this.consecutiveErrors = 0;
    this.detectedGame = '';
    this.sceneHistory = [];
    this.contextRunning = false;
    resetDebugStats();
    markStarted();
    logDebug('info', 'Commentary engine started');
    this.scheduleNext();
    this.startContextLoop();
  }

  pause() {
    this.paused = true;
    logDebug('info', 'Commentary engine paused');
  }

  resume() {
    if (!this.running) return;
    this.paused = false;
    logDebug('info', 'Commentary engine resumed');
    this.scheduleNext();
    this.scheduleContextTick();
  }

  stop() {
    this.running = false;
    this.paused = false;
    this.userMessageQueue = [];
    this.processingUserMessage = false;
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
    if (this.contextTimer) {
      clearTimeout(this.contextTimer);
      this.contextTimer = null;
    }
    clearSceneHistory();
    markStopped();
    logDebug('info', 'Commentary engine stopped');
  }

  updateParty(party: GachaCharacter[]) {
    this.party = party;
  }

  // ── User Message Queue ───────────────────────────────────────

  queueUserMessage(text: string) {
    this.userMessageQueue.push(text);
    if (!this.speaking && !this.processingUserMessage) {
      this.processUserMessages();
    }
  }

  /** Send a direct text-only message (works without engine running). */
  async sendDirectMessage(text: string, party: GachaCharacter[]): Promise<void> {
    if (!text.trim() || party.length === 0) return;
    if (this.speaking || this.processingUserMessage) {
      // Queue it and let processUserMessages handle it
      this.userMessageQueue.push(text);
      return;
    }

    this.processingUserMessage = true;

    try {
      // Try to match a character name in the message
      const character = this.matchCharacterByName(text, party) ??
        party[Math.floor(Math.random() * party.length)];

      const session = await getSession();
      if (!session) {
        logDebug('error', { message: 'Not authenticated (direct message)' });
        return;
      }

      const debugStore = getDebugStore();
      const customInstructions = debugStore.customSystemInstructions;

      let systemPrompt = character.system_prompt;
      if (customInstructions) {
        systemPrompt += '\n\n' + customInstructions;
      }

      const supabaseUrl = getSupabaseUrl();
      const history = this.getHistory(character.id);

      logDebug('llm-request', {
        character: character.name,
        historyLength: history.length,
        playerText: text,
        directMessage: true,
      });

      this.speaking = true;

      // Text-only call — no frame_b64
      const commentaryRes = await fetch(
        `${supabaseUrl}/functions/v1/generate-commentary`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            system_prompt: systemPrompt,
            personality: character.personality,
            history,
            player_text: text,
          }),
        },
      );

      if (!commentaryRes.ok) {
        const errText = await commentaryRes.text();
        logDebug('error', {
          step: 'generate-commentary (direct)',
          status: commentaryRes.status,
          message: errText,
        });
        return;
      }

      const commentaryData = await commentaryRes.json();
      logDebug('llm-response', {
        character: character.name,
        text: commentaryData.text,
        usage: commentaryData.usage,
        directMessage: true,
      });

      if (!commentaryData.text) return;

      const responseText: string = commentaryData.text;

      // Update history
      const hist = this.histories.get(character.id) ?? [];
      hist.push({ role: 'user', content: `Player: "${text}"` });
      hist.push({ role: 'assistant', content: responseText });
      while (hist.length > MAX_HISTORY * 2) {
        hist.shift();
        hist.shift();
      }
      this.histories.set(character.id, hist);

      // Emit chat message (no TTS, no overlay for direct messages when engine isn't running)
      const timeStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const chatEntry: ChatLogEntry = {
        id: `${Date.now()}-${character.id}`,
        characterId: character.id,
        name: character.name,
        rarity: character.rarity,
        text: responseText,
        time: timeStr,
        timestamp: new Date().toISOString(),
        voiceId: character.voice_id,
        image: character.avatar_url,
      };

      this.onChatMessage?.(chatEntry);
    } catch (err) {
      logDebug('error', {
        step: 'sendDirectMessage',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.speaking = false;
      this.processingUserMessage = false;

      // Drain any messages that queued while we were busy
      if (this.userMessageQueue.length > 0) {
        const next = this.userMessageQueue.shift()!;
        this.sendDirectMessage(next, party);
      }
    }
  }

  /** Try to match a party character by name in the user's message */
  private matchCharacterByName(text: string, party: GachaCharacter[]): GachaCharacter | null {
    const lower = text.toLowerCase();
    for (const char of party) {
      // Match full name or first name
      const fullName = char.name.toLowerCase();
      const firstName = fullName.split(' ')[0];
      if (lower.includes(fullName) || lower.includes(firstName)) {
        return char;
      }
    }
    return null;
  }

  private async processUserMessages() {
    if (this.speaking || this.processingUserMessage || this.userMessageQueue.length === 0) return;
    if (this.party.length === 0) return;

    this.processingUserMessage = true;

    try {
      const message = this.userMessageQueue.shift()!;

      // Try to match a character by name, otherwise pick random
      const character = this.matchCharacterByName(message, this.party) ??
        this.party[Math.floor(Math.random() * this.party.length)];

      // Get session for auth
      const session = await getSession();
      if (!session) {
        logDebug('error', { message: 'Not authenticated (user message)' });
        return;
      }

      // Grab a fresh frame
      let frameB64 = '';
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const frameDataUri = await invoke<string>('grab_frame', { sourceId: this.sourceId });
        frameB64 = frameDataUri.replace(/^data:image\/[a-z]+;base64,/, '');
      } catch (err) {
        logDebug('error', {
          step: 'grab_frame (user message)',
          message: err instanceof Error ? err.message : String(err),
        });
        return;
      }

      const debugStore = getDebugStore();
      const customInstructions = debugStore.customSystemInstructions;

      // Build system prompt
      let systemPrompt = character.system_prompt;
      if (customInstructions) {
        systemPrompt += '\n\n' + customInstructions;
      }

      const supabaseUrl = getSupabaseUrl();
      const history = this.getHistory(character.id);
      const sceneContext = this.buildSceneContext();

      logDebug('llm-request', {
        character: character.name,
        historyLength: history.length,
        playerText: message,
      });

      this.speaking = true;

      const commentaryRes = await fetch(
        `${supabaseUrl}/functions/v1/generate-commentary`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            frame_b64: frameB64,
            system_prompt: systemPrompt,
            personality: character.personality,
            history,
            player_text: message,
            scene_context: sceneContext,
            enable_visuals: true,
          }),
        },
      );

      if (!commentaryRes.ok) {
        const errText = await commentaryRes.text();
        logDebug('error', {
          step: 'generate-commentary (user message)',
          status: commentaryRes.status,
          message: errText,
        });
        return;
      }

      const commentaryData = await commentaryRes.json();
      logDebug('llm-response', {
        character: character.name,
        text: commentaryData.text,
        usage: commentaryData.usage,
        playerMessage: true,
      });

      if (!commentaryData.text) {
        return;
      }

      const responseText: string = commentaryData.text;

      // Update history with user message context
      const hist = this.histories.get(character.id) ?? [];
      hist.push({ role: 'user', content: `Player: "${message}"` });
      hist.push({ role: 'assistant', content: responseText });
      while (hist.length > MAX_HISTORY * 2) {
        hist.shift();
        hist.shift();
      }
      this.histories.set(character.id, hist);

      // TTS
      let audioBlobUrl: string | null = null;
      if (character.voice_id) {
        logDebug('tts-request', {
          character: character.name,
          voiceId: character.voice_id,
          textLength: responseText.length,
        });

        try {
          const ttsRes = await fetch(
            `${supabaseUrl}/functions/v1/generative-tts`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                text: cleanForTTS(responseText),
                reference_id: character.voice_id,
              }),
            },
          );

          if (ttsRes.ok) {
            const audioBlob = await ttsRes.blob();
            audioBlobUrl = URL.createObjectURL(audioBlob);
            logDebug('tts-response', {
              character: character.name,
              audioSize: audioBlob.size,
            });
          }
        } catch {
          // Non-critical
        }
      }

      // Emit chat message
      const timeStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const chatEntry: ChatLogEntry = {
        id: `${Date.now()}-${character.id}`,
        characterId: character.id,
        name: character.name,
        rarity: character.rarity,
        text: responseText,
        time: timeStr,
        timestamp: new Date().toISOString(),
        voiceId: character.voice_id,
        image: character.avatar_url,
      };

      this.onChatMessage?.(chatEntry);
      this.onOverlayMessage?.({
        name: character.name,
        rarity: character.rarity,
        text: responseText,
        image: character.avatar_url,
        visuals: commentaryData.visuals,
      });

      // Play audio
      if (audioBlobUrl) {
        await this.playAudio(audioBlobUrl);
      }
      this.onOverlayDismiss?.();

      this.lastSpokeTime = Date.now();
    } catch (err) {
      logDebug('error', {
        step: 'processUserMessages',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.speaking = false;
      this.processingUserMessage = false;

      // Process next queued message if any
      if (this.userMessageQueue.length > 0) {
        setTimeout(() => this.processUserMessages(), 100);
      }
    }
  }

  // ── Context Loop ──────────────────────────────────────────────

  private startContextLoop() {
    const debugStore = getDebugStore();
    if (!debugStore.contextEnabled) return;
    this.scheduleContextTick();
  }

  private scheduleContextTick() {
    if (!this.running || this.paused) return;
    const debugStore = getDebugStore();
    if (!debugStore.contextEnabled) return;
    const intervalMs = debugStore.contextInterval * 1000;
    this.contextTimer = setTimeout(() => this.contextTick(), intervalMs);
  }

  private async contextTick() {
    if (this.contextRunning || this.paused || !this.running) {
      this.scheduleContextTick();
      return;
    }

    const debugStore = getDebugStore();
    if (!debugStore.contextEnabled) return;

    this.contextRunning = true;

    try {
      // Capture frame
      const { invoke } = await import('@tauri-apps/api/core');
      const frameDataUri = await invoke<string>('grab_frame', { sourceId: this.sourceId });
      const frameB64 = frameDataUri.replace(/^data:image\/[a-z]+;base64,/, '');

      logDebug('context-request', {
        sceneHistoryLength: this.sceneHistory.length,
        detectedGame: this.detectedGame,
      });

      // Get session for auth
      const session = await getSession();
      if (!session) {
        logDebug('error', { step: 'context', message: 'Not authenticated' });
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
            game_name: this.detectedGame || undefined,
          }),
        },
      );

      if (!res.ok) {
        const errText = await res.text();
        logDebug('error', {
          step: 'describe-scene',
          status: res.status,
          message: errText,
        });
        return;
      }

      const data = await res.json();

      logDebug('context-response', {
        description: data.description,
        game_name: data.game_name,
        usage: data.usage,
      });

      // Update detected game if returned
      if (data.game_name && !this.detectedGame) {
        this.detectedGame = data.game_name;
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

      // Push to debug store
      pushSceneSnapshot(data.description, bufferSize);
    } catch (err) {
      logDebug('error', {
        step: 'context-tick',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.contextRunning = false;
      this.scheduleContextTick();
    }
  }

  private buildSceneContext(): { game_name?: string; descriptions: string[] } | undefined {
    if (this.sceneHistory.length === 0) return undefined;
    return {
      game_name: this.detectedGame || undefined,
      descriptions: this.sceneHistory.map((s) => s.description),
    };
  }

  // ── Commentary Loop ───────────────────────────────────────────

  private scheduleNext() {
    if (!this.running || this.paused) return;
    const backoff = this.consecutiveErrors > 0
      ? Math.min(POLL_INTERVAL_MS * Math.pow(2, this.consecutiveErrors), CommentaryEngine.MAX_BACKOFF_MS)
      : POLL_INTERVAL_MS;
    this.loopTimer = setTimeout(() => this.tick(), backoff);
  }

  private async tick() {
    if (!this.running || this.paused) return;

    try {
      await this.doOneCycle();
      this.consecutiveErrors = 0;
    } catch (err) {
      this.consecutiveErrors++;
      const backoff = Math.min(
        POLL_INTERVAL_MS * Math.pow(2, this.consecutiveErrors),
        CommentaryEngine.MAX_BACKOFF_MS,
      );
      logDebug('error', {
        message: err instanceof Error ? err.message : String(err),
      });
      logDebug('info', {
        message: `Backing off ${(backoff / 1000).toFixed(0)}s after ${this.consecutiveErrors} consecutive error(s)`,
      });
    }

    this.scheduleNext();
  }

  private async doOneCycle() {
    if (this.speaking) return;
    if (this.party.length === 0) return;

    // Prioritize user messages over timed commentary
    if (this.userMessageQueue.length > 0) {
      await this.processUserMessages();
      return;
    }

    const debugStore = getDebugStore();
    const gap = debugStore.commentaryGap;
    const gameHint = debugStore.gameHint;
    const customInstructions = debugStore.customSystemInstructions;
    const now = Date.now();

    // Check if enough time has passed since last commentary
    if (this.lastSpokeTime > 0 && now - this.lastSpokeTime < gap * 1000) {
      return;
    }

    // Capture frame (grab_frame returns a data URI: "data:image/jpeg;base64,...")
    let frameDataUri: string;
    let frameB64: string;
    let frameId: number;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      frameDataUri = await invoke<string>('grab_frame', { sourceId: this.sourceId });
      // Strip data URI prefix — API expects raw base64
      frameB64 = frameDataUri.replace(/^data:image\/[a-z]+;base64,/, '');
      logDebug('frame', { size: frameB64.length });
      // Store the full data URI for display in debug frames
      frameId = captureFrame(frameDataUri);
    } catch (err) {
      logDebug('error', {
        step: 'grab_frame',
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    // Attach scene context to frame for debug UI
    const sceneContext = this.buildSceneContext();
    if (sceneContext) {
      const debugScenes = this.sceneHistory.map((s) => ({
        timestamp: new Date(s.timestamp),
        description: s.description,
      }));
      setFrameSceneContext(frameId, debugScenes, this.detectedGame);
    }

    // Pick a random character
    const charIndex = Math.floor(Math.random() * this.party.length);
    const character = this.party[charIndex];

    // Get session for auth
    const session = await getSession();
    if (!session) {
      logDebug('error', { message: 'Not authenticated' });
      return;
    }

    const supabaseUrl = getSupabaseUrl();
    const history = this.getHistory(character.id);

    // Call generate-commentary edge function
    logDebug('llm-request', {
      character: character.name,
      historyLength: history.length,
    });

    this.speaking = true;
    try {
      // Build system prompt: character's own prompt + any custom instructions from settings
      let systemPrompt = character.system_prompt;
      if (customInstructions) {
        systemPrompt += '\n\n' + customInstructions;
      }

      const commentaryRes = await fetch(
        `${supabaseUrl}/functions/v1/generate-commentary`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            frame_b64: frameB64,
            system_prompt: systemPrompt,
            personality: character.personality,
            history,
            game_hint: sceneContext ? undefined : (gameHint || undefined),
            scene_context: sceneContext,
            enable_visuals: true,
          }),
        },
      );

      if (!commentaryRes.ok) {
        const errText = await commentaryRes.text();
        logDebug('error', {
          step: 'generate-commentary',
          status: commentaryRes.status,
          message: errText,
        });
        this.consecutiveErrors++;
        const backoff = Math.min(
          POLL_INTERVAL_MS * Math.pow(2, this.consecutiveErrors),
          CommentaryEngine.MAX_BACKOFF_MS,
        );
        logDebug('info', {
          message: `Backing off ${(backoff / 1000).toFixed(0)}s after ${this.consecutiveErrors} consecutive error(s)`,
        });
        this.speaking = false;
        return;
      }

      const commentaryData = await commentaryRes.json();
      logDebug('llm-response', {
        character: character.name,
        text: commentaryData.text,
        usage: commentaryData.usage,
      });

      // Reset consecutive errors on successful LLM response
      this.consecutiveErrors = 0;

      if (!commentaryData.text) {
        // [SILENCE] — character chose not to speak
        this.speaking = false;
        return;
      }

      const responseText: string = commentaryData.text;
      setFrameResponse(frameId, responseText);

      // Update history
      this.appendHistory(character.id, responseText);

      // TTS
      let audioBlobUrl: string | null = null;
      if (character.voice_id) {
        logDebug('tts-request', {
          character: character.name,
          voiceId: character.voice_id,
          textLength: responseText.length,
        });

        try {
          const ttsRes = await fetch(
            `${supabaseUrl}/functions/v1/generative-tts`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                text: cleanForTTS(responseText),
                reference_id: character.voice_id,
              }),
            },
          );

          if (ttsRes.ok) {
            const audioBlob = await ttsRes.blob();
            audioBlobUrl = URL.createObjectURL(audioBlob);
            logDebug('tts-response', {
              character: character.name,
              audioSize: audioBlob.size,
            });
          } else {
            const errText = await ttsRes.text();
            logDebug('error', {
              step: 'generative-tts',
              status: ttsRes.status,
              message: errText,
            });
          }
        } catch (ttsErr) {
          logDebug('error', {
            step: 'tts-fetch',
            message: ttsErr instanceof Error ? ttsErr.message : String(ttsErr),
          });
        }
      }

      // Emit chat message
      const timeStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const chatEntry: ChatLogEntry = {
        id: `${Date.now()}-${character.id}`,
        characterId: character.id,
        name: character.name,
        rarity: character.rarity,
        text: responseText,
        time: timeStr,
        timestamp: new Date().toISOString(),
        voiceId: character.voice_id,
        image: character.avatar_url,
      };

      this.onChatMessage?.(chatEntry);
      this.onOverlayMessage?.({
        name: character.name,
        rarity: character.rarity,
        text: responseText,
        image: character.avatar_url,
        visuals: commentaryData.visuals,
      });

      // Play audio
      if (audioBlobUrl) {
        await this.playAudio(audioBlobUrl);
      }
      this.onOverlayDismiss?.();

      this.lastSpokeTime = Date.now();

      // 25% chance of character interaction
      if (this.party.length > 1 && Math.random() < REACT_CHANCE) {
        await this.doReaction(character, responseText, frameB64, session);
      }
    } finally {
      this.speaking = false;
      // Check for queued user messages after finishing
      if (this.userMessageQueue.length > 0) {
        setTimeout(() => this.processUserMessages(), 100);
      }
    }
  }

  private async doReaction(
    speaker: GachaCharacter,
    spokenText: string,
    frameB64: string,
    session: { access_token: string },
  ) {
    // Pick a different character
    const others = this.party.filter((c) => c.id !== speaker.id);
    if (others.length === 0) return;
    const reactor = others[Math.floor(Math.random() * others.length)];

    const supabaseUrl = getSupabaseUrl();
    const history = this.getHistory(reactor.id);
    const debugStore = getDebugStore();
    const gameHint = debugStore.gameHint;
    const customInstructions = debugStore.customSystemInstructions;

    // Build system prompt: character's own prompt + custom instructions
    let systemPrompt = reactor.system_prompt;
    if (customInstructions) {
      systemPrompt += '\n\n' + customInstructions;
    }

    logDebug('llm-request', {
      character: reactor.name,
      reactionTo: speaker.name,
    });

    // Include scene context in reactions too
    const sceneContext = this.buildSceneContext();

    try {
      const res = await fetch(
        `${supabaseUrl}/functions/v1/generate-commentary`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            frame_b64: frameB64,
            system_prompt: systemPrompt,
            personality: reactor.personality,
            history,
            react_to: { name: speaker.name, text: spokenText },
            game_hint: sceneContext ? undefined : (gameHint || undefined),
            scene_context: sceneContext,
            enable_visuals: true,
          }),
        },
      );

      if (!res.ok) {
        const errText = await res.text();
        logDebug('error', {
          step: 'reaction',
          status: res.status,
          message: errText,
        });
        return;
      }

      const data = await res.json();
      logDebug('llm-response', {
        character: reactor.name,
        text: data.text,
        usage: data.usage,
        reaction: true,
      });

      if (!data.text) return;

      const responseText: string = data.text;
      this.appendHistory(reactor.id, responseText, {
        name: speaker.name,
        text: spokenText,
      });

      // TTS for reaction
      let audioBlobUrl: string | null = null;
      if (reactor.voice_id) {
        logDebug('tts-request', {
          character: reactor.name,
          voiceId: reactor.voice_id,
          textLength: responseText.length,
        });

        try {
          const ttsRes = await fetch(
            `${supabaseUrl}/functions/v1/generative-tts`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                text: cleanForTTS(responseText),
                reference_id: reactor.voice_id,
              }),
            },
          );

          if (ttsRes.ok) {
            const audioBlob = await ttsRes.blob();
            audioBlobUrl = URL.createObjectURL(audioBlob);
            logDebug('tts-response', {
              character: reactor.name,
              audioSize: audioBlob.size,
            });
          }
        } catch {
          // Non-critical
        }
      }

      const timeStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const chatEntry: ChatLogEntry = {
        id: `${Date.now()}-${reactor.id}`,
        characterId: reactor.id,
        name: reactor.name,
        rarity: reactor.rarity,
        text: responseText,
        time: timeStr,
        timestamp: new Date().toISOString(),
        voiceId: reactor.voice_id,
        image: reactor.avatar_url,
      };

      this.onChatMessage?.(chatEntry);
      this.onOverlayMessage?.({
        name: reactor.name,
        rarity: reactor.rarity,
        text: responseText,
        image: reactor.avatar_url,
        visuals: data.visuals,
      });

      if (audioBlobUrl) {
        await this.playAudio(audioBlobUrl);
      }
      this.onOverlayDismiss?.();
    } catch (err) {
      logDebug('error', {
        step: 'reaction',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private getHistory(characterId: string): HistoryEntry[] {
    return this.histories.get(characterId) ?? [];
  }

  private appendHistory(
    characterId: string,
    assistantText: string,
    reactTo?: { name: string; text: string },
  ) {
    const history = this.histories.get(characterId) ?? [];

    // Build user summary (text-only for token efficiency)
    let userSummary: string;
    if (reactTo) {
      userSummary = `${reactTo.name} said: "${reactTo.text}"`;
    } else {
      userSummary = '(screen only)';
    }

    history.push({ role: 'user', content: userSummary });
    history.push({ role: 'assistant', content: assistantText });

    // Trim to max turns
    while (history.length > MAX_HISTORY * 2) {
      history.shift();
      history.shift();
    }

    this.histories.set(characterId, history);
  }

  private playAudio(blobUrl: string): Promise<void> {
    return new Promise((resolve) => {
      const audio = new Audio(blobUrl);
      audio.onended = () => {
        URL.revokeObjectURL(blobUrl);
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        resolve();
      };
      audio.play().catch(() => {
        URL.revokeObjectURL(blobUrl);
        resolve();
      });
    });
  }
}
