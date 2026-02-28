import { getSupabaseUrl, getSession } from '@glazebot/supabase-client';
import { getDebugStore } from '../stores/debug.svelte';
import type { EngineEventBus } from './events';
import type { ConversationHistory } from './history';
import type { TtsPlayer } from './tts';
import type { MessageRequest, PipelineResult, MultiLineResult } from './types';

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

  /**
   * Process a multi-character block (quip_banter / hype_chain).
   * Sends all participants to the edge function, gets back multiple lines,
   * then plays each line sequentially with overlay + TTS.
   */
  async processMulti(request: MessageRequest): Promise<MultiLineResult> {
    const { id: requestId, character, trigger, signal, participants } = request;

    if (!participants || participants.length < 2) {
      // Fallback to single-character
      const result = await this.process({
        ...request,
        blockType: 'solo_observation',
        blockPrompt: undefined,
        participants: undefined,
      });
      if (!result.text) return { lines: [], usage: result.usage };
      return {
        lines: [{
          characterId: character.id,
          characterName: character.name,
          voiceId: character.voice_id,
          text: result.text,
          avatarUrl: character.avatar_url,
          rarity: character.rarity,
        }],
        usage: result.usage,
      };
    }

    this.events.emit('pipeline:start', {
      requestId,
      trigger,
      character: character.name,
    });

    try {
      const session = await getSession();
      if (!session) {
        this.events.emit('pipeline:llm-error', { requestId, error: 'Not authenticated' });
        return { lines: [] };
      }

      const supabaseUrl = getSupabaseUrl();

      const body: Record<string, unknown> = {
        system_prompt: character.system_prompt,
        personality: character.personality,
        block_type: request.blockType,
        block_prompt: request.blockPrompt,
        participants: participants.map((p) => ({
          name: p.name,
          system_prompt: p.system_prompt,
          personality: p.personality,
          voice_id: p.voice_id,
          avatar_url: p.avatar_url,
          rarity: p.rarity,
          id: p.id,
        })),
      };

      if (request.frameB64) {
        body.frame_b64 = request.frameB64;
        if (request.frameDims) body.frame_dims = request.frameDims;
      }
      if (request.sceneContext) body.scene_context = request.sceneContext;
      if (request.memories && request.memories.length > 0) body.memories = request.memories;

      this.events.emit('pipeline:llm-start', {
        requestId,
        character: character.name,
        historyLength: 0,
      });

      const res = await fetch(`${supabaseUrl}/functions/v1/generate-commentary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        this.events.emit('pipeline:llm-error', { requestId, error: errText, status: res.status });
        return { lines: [] };
      }

      const data = await res.json();

      this.events.emit('pipeline:llm-end', {
        requestId,
        character: character.name,
        text: data.text ?? '',
        usage: data.usage,
      });

      // Parse multi-line response
      let lines: MultiLineResult['lines'] = [];
      if (data.lines && Array.isArray(data.lines)) {
        // Edge function returned structured lines
        lines = data.lines.map((l: { character: string; line: string }) => {
          const participant = participants.find((p) => p.name === l.character) ?? character;
          return {
            characterId: participant.id,
            characterName: participant.name,
            voiceId: participant.voice_id,
            text: l.line,
            avatarUrl: participant.avatar_url,
            rarity: participant.rarity,
          };
        });
      } else if (data.text) {
        // Fallback: attribute entire response to primary character
        // Guard: never show raw JSON to the user
        const trimmed = (data.text as string).trim();
        if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
          lines = [{
            characterId: character.id,
            characterName: character.name,
            voiceId: character.voice_id,
            text: data.text,
            avatarUrl: character.avatar_url,
            rarity: character.rarity,
          }];
        }
      }

      if (lines.length === 0) {
        this.events.emit('pipeline:silence', { requestId });
        this.events.emit('pipeline:end', { requestId, trigger });
        return { lines: [], usage: data.usage };
      }

      // Play each line sequentially: chat → overlay → TTS → dismiss → delay
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (signal?.aborted) break;

        const lineId = `${requestId}-${i}`;
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Emit chat message
        this.events.emit('chat-message', {
          id: `${Date.now()}-${line.characterId}`,
          characterId: line.characterId,
          name: line.characterName,
          rarity: line.rarity,
          text: line.text,
          time: timeStr,
          timestamp: new Date().toISOString(),
          voiceId: line.voiceId,
          image: line.avatarUrl,
        });

        // Overlay + TTS
        this.events.emit('overlay-show', {
          bubbleId: lineId,
          name: line.characterName,
          rarity: line.rarity,
          text: line.text,
          image: line.avatarUrl,
        });

        try {
          if (line.voiceId) {
            await this.tts.playTTS({
              requestId: lineId,
              text: line.text,
              voiceId: line.voiceId,
              accessToken: session.access_token,
              characterName: line.characterName,
              signal,
            });
          }
        } finally {
          this.events.emit('overlay-dismiss', { bubbleId: lineId });
        }

        // Brief delay between lines
        if (i < lines.length - 1 && !signal?.aborted) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      // Update conversation history for primary character
      const fullExchange = lines.map((l) => `${l.characterName}: ${l.text}`).join('\n');
      this.history.append(character.id, '(screen only)', fullExchange);

      this.events.emit('pipeline:end', { requestId, trigger });
      return { lines, usage: data.usage };
    } catch (err) {
      if (signal?.aborted) {
        this.events.emit('pipeline:abort', { requestId, reason: 'Multi-character cycle aborted' });
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
      if (request.blockType) body.block_type = request.blockType;
      if (request.blockPrompt) body.block_prompt = request.blockPrompt;
      if (request.memories && request.memories.length > 0) body.memories = request.memories;

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
