import { getSupabaseUrl } from '@glazebot/supabase-client';
import { getDebugStore } from '../stores/debug.svelte';
import { StreamingAudioPlayer } from './streaming-audio';
import type { EngineEventBus } from './events';

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

export interface TtsOptions {
  requestId: string;
  text: string;
  voiceId: string;
  accessToken: string;
  characterName: string;
  signal?: AbortSignal;
}

export interface TtsResult {
  played: boolean;
  mode: 'streaming' | 'buffered';
  ttfbMs: number;
  firstAudioMs: number;
  totalMs: number;
  audioSize: number;
}

export class TtsPlayer {
  constructor(private events: EngineEventBus) {}

  /** Always resolves. Returns result with played=true if audio played, played=false on failure/abort. */
  async playTTS(options: TtsOptions): Promise<TtsResult> {
    const { requestId, text, voiceId, accessToken, characterName, signal } = options;
    const debug = getDebugStore();
    const t0 = performance.now();

    const cleanText = cleanForTTS(text);
    const useStreaming = debug.ttsStreaming && StreamingAudioPlayer.isSupported();
    const supabaseUrl = getSupabaseUrl();
    const mode: TtsResult['mode'] = useStreaming ? 'streaming' : 'buffered';

    this.events.emit('pipeline:tts-start', {
      requestId,
      character: characterName,
      voiceId,
      textLength: cleanText.length,
      mode,
    });

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/generative-tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          text: cleanText,
          reference_id: voiceId,
          stream: useStreaming,
        }),
        signal,
      });

      const tTTFB = performance.now();

      if (!res.ok) {
        const errText = await res.text();
        this.events.emit('pipeline:tts-error', { requestId, error: `TTS ${res.status}: ${errText}` });
        return { played: false, mode, ttfbMs: Math.round(tTTFB - t0), firstAudioMs: 0, totalMs: Math.round(tTTFB - t0), audioSize: 0 };
      }

      let tFirstAudio = 0;
      let tTransferDone = 0;
      let totalBytes = 0;

      if (useStreaming && res.body) {
        const player = new StreamingAudioPlayer();
        player.onFirstPlay = () => { tFirstAudio = performance.now(); };
        const playPromise = player.play(signal);

        const reader = res.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done || signal?.aborted) break;
            totalBytes += value.byteLength;
            player.appendChunk(value);
          }
        } finally {
          reader.releaseLock();
        }
        tTransferDone = performance.now();
        player.end();
        await playPromise;
      } else {
        const audioBlob = await res.blob();
        totalBytes = audioBlob.size;
        tTransferDone = performance.now();
        const blobUrl = URL.createObjectURL(audioBlob);
        tFirstAudio = performance.now();
        await this.playAudioBlob(blobUrl);
      }

      const tDone = performance.now();
      const result: TtsResult = {
        played: true,
        mode,
        ttfbMs: Math.round(tTTFB - t0),
        firstAudioMs: Math.round((tFirstAudio || tDone) - t0),
        totalMs: Math.round(tDone - t0),
        audioSize: totalBytes,
      };

      this.events.emit('pipeline:tts-end', {
        requestId,
        character: characterName,
        mode,
        ttfbMs: result.ttfbMs,
        firstAudioMs: result.firstAudioMs,
        totalMs: result.totalMs,
        audioSize: totalBytes,
      });

      return result;
    } catch (err) {
      if (signal?.aborted) {
        return { played: false, mode, ttfbMs: 0, firstAudioMs: 0, totalMs: 0, audioSize: 0 };
      }
      this.events.emit('pipeline:tts-error', {
        requestId,
        error: err instanceof Error ? err.message : String(err),
      });
      return { played: false, mode, ttfbMs: 0, firstAudioMs: 0, totalMs: 0, audioSize: 0 };
    }
  }

  private playAudioBlob(blobUrl: string): Promise<void> {
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
