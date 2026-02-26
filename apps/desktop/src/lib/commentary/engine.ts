import type { GachaCharacter } from '@glazebot/shared-types';
import { getSupabaseUrl, getSession } from '@glazebot/supabase-client';
import {
  logDebug,
  getDebugStore,
  markStarted,
  markStopped,
  resetDebugStats,
} from '../stores/debug.svelte';

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
  voiceId?: string;
  image?: string;
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

  /** Callback fired when a new chat message is produced */
  onChatMessage: ((entry: ChatLogEntry) => void) | null = null;

  /** Callback to emit events to overlay */
  onOverlayMessage:
    | ((msg: { name: string; rarity: string; text: string; image?: string }) => void)
    | null = null;

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
    resetDebugStats();
    markStarted();
    logDebug('info', 'Commentary engine started');
    this.scheduleNext();
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
  }

  stop() {
    this.running = false;
    this.paused = false;
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
    markStopped();
    logDebug('info', 'Commentary engine stopped');
  }

  updateParty(party: GachaCharacter[]) {
    this.party = party;
  }

  private scheduleNext() {
    if (!this.running || this.paused) return;
    this.loopTimer = setTimeout(() => this.tick(), POLL_INTERVAL_MS);
  }

  private async tick() {
    if (!this.running || this.paused) return;

    try {
      await this.doOneCycle();
    } catch (err) {
      logDebug('error', {
        message: err instanceof Error ? err.message : String(err),
      });
    }

    this.scheduleNext();
  }

  private async doOneCycle() {
    if (this.speaking) return;
    if (this.party.length === 0) return;

    const debugStore = getDebugStore();
    const gap = debugStore.commentaryGap;
    const gameHint = debugStore.gameHint;
    const customInstructions = debugStore.customSystemInstructions;
    const now = Date.now();

    // Check if enough time has passed since last commentary
    if (this.lastSpokeTime > 0 && now - this.lastSpokeTime < gap * 1000) {
      return;
    }

    // Capture frame
    let frameB64: string;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      frameB64 = await invoke<string>('grab_frame', { sourceId: this.sourceId });
      logDebug('frame', { size: frameB64.length });
    } catch (err) {
      logDebug('error', {
        step: 'grab_frame',
        message: err instanceof Error ? err.message : String(err),
      });
      return;
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
            game_hint: gameHint || undefined,
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
        this.speaking = false;
        return;
      }

      const commentaryData = await commentaryRes.json();
      logDebug('llm-response', {
        character: character.name,
        text: commentaryData.text,
        usage: commentaryData.usage,
      });

      if (!commentaryData.text) {
        // [SILENCE] — character chose not to speak
        this.speaking = false;
        return;
      }

      const responseText: string = commentaryData.text;

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
                text: responseText,
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
        voiceId: character.voice_id,
        image: character.avatar_url,
      };

      this.onChatMessage?.(chatEntry);
      this.onOverlayMessage?.({
        name: character.name,
        rarity: character.rarity,
        text: responseText,
        image: character.avatar_url,
      });

      // Play audio
      if (audioBlobUrl) {
        await this.playAudio(audioBlobUrl);
      }

      this.lastSpokeTime = Date.now();

      // 25% chance of character interaction
      if (this.party.length > 1 && Math.random() < REACT_CHANCE) {
        await this.doReaction(character, responseText, frameB64, session);
      }
    } finally {
      this.speaking = false;
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
            game_hint: gameHint || undefined,
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
                text: responseText,
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
        voiceId: reactor.voice_id,
        image: reactor.avatar_url,
      };

      this.onChatMessage?.(chatEntry);
      this.onOverlayMessage?.({
        name: reactor.name,
        rarity: reactor.rarity,
        text: responseText,
        image: reactor.avatar_url,
      });

      if (audioBlobUrl) {
        await this.playAudio(audioBlobUrl);
      }
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
