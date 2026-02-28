import type { TtsOptions, TtsResult } from '$lib/commentary/tts';
import type { EngineEventBus } from '$lib/commentary/events';

/**
 * Fake TtsPlayer for pipeline tests.
 * Resolves immediately by default, or with configurable delay/failure.
 */
export class MockTtsPlayer {
  /** Simulated delay in ms before resolving */
  delay = 0;
  /** Whether playTTS should reject */
  shouldFail = false;
  /** Error message when shouldFail is true */
  failMessage = 'TTS playback failed';
  /** Record of all calls for assertions */
  calls: TtsOptions[] = [];

  constructor(private events: EngineEventBus) {}

  async playTTS(options: TtsOptions): Promise<TtsResult> {
    this.calls.push(options);

    const mode: TtsResult['mode'] = 'buffered';

    this.events.emit('pipeline:tts-start', {
      requestId: options.requestId,
      character: options.characterName,
      voiceId: options.voiceId,
      textLength: options.text.length,
      mode,
    });

    if (this.delay > 0) {
      await new Promise((r) => setTimeout(r, this.delay));
    }

    if (this.shouldFail) {
      this.events.emit('pipeline:tts-error', {
        requestId: options.requestId,
        error: this.failMessage,
      });
      throw new Error(this.failMessage);
    }

    const result: TtsResult = {
      played: true,
      mode,
      ttfbMs: 50,
      firstAudioMs: 100,
      totalMs: this.delay || 200,
      audioSize: 1024,
    };

    this.events.emit('pipeline:tts-end', {
      requestId: options.requestId,
      character: options.characterName,
      mode,
      ttfbMs: result.ttfbMs,
      firstAudioMs: result.firstAudioMs,
      totalMs: result.totalMs,
      audioSize: result.audioSize,
    });

    return result;
  }
}
