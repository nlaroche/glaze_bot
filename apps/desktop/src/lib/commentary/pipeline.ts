import { getSupabaseUrl, getSession } from '@glazebot/supabase-client';
import { getDebugStore } from '../stores/debug.svelte';
import type { EngineEventBus } from './events';
import type { ConversationHistory } from './history';
import type { TtsPlayer } from './tts';
import type { MessageRequest, PipelineResult } from './types';

/**
 * The single unified message flow. All 4 paths (timed, user, reaction, direct)
 * funnel through process(). Emits stage events — DebugLogger subscribes.
 *
 * Critical guarantee: overlay-dismiss ALWAYS fires if overlay-show fired,
 * regardless of TTS success (via try/finally).
 */
export class MessagePipeline {
  constructor(
    private events: EngineEventBus,
    private history: ConversationHistory,
    private tts: TtsPlayer,
  ) {}

  async process(request: MessageRequest): Promise<PipelineResult> {
    const { id: requestId, character, trigger, signal } = request;

    this.events.emit('pipeline:start', {
      requestId,
      trigger,
      character: character.name,
      playerText: request.playerText,
    });

    try {
      // 1. Get session
      const session = await getSession();
      if (!session) {
        this.events.emit('pipeline:llm-error', { requestId, error: 'Not authenticated' });
        this.events.emit('system-message', { text: 'Not authenticated — please sign in again.' });
        return { text: '' };
      }

      // 2. Build system prompt
      const debugStore = getDebugStore();
      const customInstructions = debugStore.customSystemInstructions;
      let systemPrompt = character.system_prompt;
      if (customInstructions) {
        systemPrompt += '\n\n' + customInstructions;
      }

      // 3. Build request body
      const supabaseUrl = getSupabaseUrl();
      const hist = this.history.get(character.id);
      const gameHint = debugStore.gameHint;

      const body: Record<string, unknown> = {
        system_prompt: systemPrompt,
        personality: character.personality,
        history: hist,
      };

      if (request.frameB64) {
        body.frame_b64 = request.frameB64;
        if (request.frameDims) body.frame_dims = request.frameDims;
      }
      if (request.playerText) body.player_text = request.playerText;
      if (request.reactTo) body.react_to = request.reactTo;
      if (request.sceneContext) {
        body.scene_context = request.sceneContext;
      } else if (gameHint) {
        body.game_hint = gameHint;
      }
      if (request.enableVisuals) body.enable_visuals = true;

      // 4. LLM call
      this.events.emit('pipeline:llm-start', {
        requestId,
        character: character.name,
        historyLength: hist.length,
        playerText: request.playerText,
      });

      const commentaryRes = await fetch(
        `${supabaseUrl}/functions/v1/generate-commentary`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(body),
          signal,
        },
      );

      if (!commentaryRes.ok) {
        const errText = await commentaryRes.text();
        this.events.emit('pipeline:llm-error', {
          requestId,
          error: errText,
          status: commentaryRes.status,
        });
        if (trigger === 'user') {
          this.events.emit('system-message', { text: `Failed to generate response (${commentaryRes.status}).` });
        }
        return { text: '' };
      }

      const commentaryData = await commentaryRes.json();
      const responseText: string = commentaryData.text ?? '';
      const visuals: Record<string, unknown>[] | undefined = commentaryData.visuals;
      const hasVisuals = visuals && visuals.length > 0;

      this.events.emit('pipeline:llm-end', {
        requestId,
        character: character.name,
        text: responseText,
        usage: commentaryData.usage,
        visuals,
      });

      // 5. Silence check
      if (!responseText && !hasVisuals) {
        this.events.emit('pipeline:silence', { requestId });
        this.events.emit('pipeline:end', { requestId, trigger });
        return { text: '', usage: commentaryData.usage };
      }

      // 6. Update conversation history
      if (responseText) {
        let userContent: string;
        if (request.playerText) {
          userContent = `Player: "${request.playerText}"`;
        } else if (request.reactTo) {
          userContent = `${request.reactTo.name} said: "${request.reactTo.text}"`;
        } else {
          userContent = '(screen only)';
        }
        this.history.append(character.id, userContent, responseText);
      }

      // 7. Check abort before proceeding to UI/TTS
      if (signal?.aborted) {
        this.events.emit('pipeline:abort', { requestId, reason: 'Aborted before TTS — yielding to user message' });
        this.events.emit('pipeline:end', { requestId, trigger });
        return { text: responseText, visuals, usage: commentaryData.usage };
      }

      // 8. Emit chat message
      if (responseText) {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        this.events.emit('chat-message', {
          id: `${Date.now()}-${character.id}`,
          characterId: character.id,
          name: character.name,
          rarity: character.rarity,
          text: responseText,
          time: timeStr,
          timestamp: new Date().toISOString(),
          voiceId: character.voice_id,
          image: character.avatar_url,
        });
      }

      // 9-13. Overlay show → TTS → overlay dismiss (try/finally guarantees dismiss)
      // Only do overlay+TTS if engine is running (not for direct messages when stopped)
      const shouldOverlay = trigger !== 'direct';
      let overlayShown = false;

      if (shouldOverlay && (responseText || hasVisuals)) {
        this.events.emit('overlay-show', {
          bubbleId: requestId,
          name: character.name,
          rarity: character.rarity,
          text: responseText,
          image: character.avatar_url,
          visuals,
        });
        overlayShown = true;
      }

      try {
        if (responseText && character.voice_id && trigger !== 'direct') {
          await this.tts.playTTS({
            requestId,
            text: responseText,
            voiceId: character.voice_id,
            accessToken: session.access_token,
            characterName: character.name,
            signal,
          });
        }
      } finally {
        // GUARANTEED: dismiss fires if show fired
        if (overlayShown) {
          this.events.emit('overlay-dismiss', { bubbleId: requestId });
        }
      }

      this.events.emit('pipeline:end', { requestId, trigger });
      return { text: responseText, visuals, usage: commentaryData.usage };
    } catch (err) {
      if (signal?.aborted) {
        this.events.emit('pipeline:abort', { requestId, reason: 'Cycle aborted — user message takes priority' });
      } else {
        this.events.emit('pipeline:llm-error', {
          requestId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      this.events.emit('pipeline:end', { requestId, trigger });
      throw err;
    }
  }
}
