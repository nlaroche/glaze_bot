/**
 * StreamingAudioPlayer — MediaSource + SourceBuffer wrapper for streaming MP3 playback.
 *
 * Usage:
 *   const player = new StreamingAudioPlayer();
 *   player.onFirstPlay = () => { ... };
 *   const done = player.play(signal);
 *   player.appendChunk(chunk1);
 *   player.appendChunk(chunk2);
 *   player.end();
 *   await done;
 */
export class StreamingAudioPlayer {
  private mediaSource: MediaSource;
  private audio: HTMLAudioElement;
  private sourceBuffer: SourceBuffer | null = null;
  private queue: Uint8Array[] = [];
  private appending = false;
  private ended = false;
  private started = false;

  /** Called once when the first audio frame starts playing */
  onFirstPlay: (() => void) | null = null;

  constructor() {
    this.mediaSource = new MediaSource();
    this.audio = new Audio();
    this.audio.src = URL.createObjectURL(this.mediaSource);
  }

  /** Check if the browser supports MediaSource with audio/mpeg */
  static isSupported(): boolean {
    return (
      typeof MediaSource !== 'undefined' &&
      MediaSource.isTypeSupported('audio/mpeg')
    );
  }

  /**
   * Start playback. Resolves when audio ends, is aborted, or errors.
   * Call appendChunk() to feed data, then end() when done.
   */
  play(signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve) => {
      if (signal?.aborted) {
        this.cleanup();
        resolve();
        return;
      }

      const onAbort = () => {
        this.audio.pause();
        this.cleanup();
        resolve();
      };

      signal?.addEventListener('abort', onAbort, { once: true });

      this.audio.onended = () => {
        signal?.removeEventListener('abort', onAbort);
        this.cleanup();
        resolve();
      };

      this.audio.onerror = () => {
        signal?.removeEventListener('abort', onAbort);
        this.cleanup();
        resolve();
      };

      this.mediaSource.addEventListener(
        'sourceopen',
        () => {
          try {
            this.sourceBuffer = this.mediaSource.addSourceBuffer('audio/mpeg');
            this.sourceBuffer.addEventListener('updateend', () => {
              this.appending = false;
              this.processQueue();
            });
            // Process any chunks that arrived before sourceopen
            this.processQueue();
          } catch {
            this.cleanup();
            resolve();
          }
        },
        { once: true },
      );
    });
  }

  /** Queue a chunk of audio data for the SourceBuffer */
  appendChunk(chunk: Uint8Array) {
    this.queue.push(chunk);
    this.processQueue();
  }

  /** Signal that no more chunks will arrive */
  end() {
    this.ended = true;
    this.processQueue();
  }

  private processQueue() {
    if (!this.sourceBuffer || this.appending) return;

    if (this.queue.length > 0) {
      const chunk = this.queue.shift()!;
      this.appending = true;
      try {
        this.sourceBuffer.appendBuffer(new Uint8Array(chunk) as unknown as ArrayBuffer);
      } catch {
        this.appending = false;
        return;
      }

      // Start playback on first append
      if (!this.started) {
        this.started = true;
        this.audio.play().then(() => {
          this.onFirstPlay?.();
        }).catch(() => {
          // Autoplay blocked — resolve silently
        });
      }
    } else if (this.ended && this.mediaSource.readyState === 'open') {
      try {
        this.mediaSource.endOfStream();
      } catch {
        // Already ended or in an error state
      }
    }
  }

  private cleanup() {
    const src = this.audio.src;
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    URL.revokeObjectURL(src);
    this.queue = [];
  }
}
