import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventCollector } from '../../helpers/event-collector';
import { fakeCharacter, fakeCharacter2 } from '../../helpers/fixtures';
import { createMockFetch } from '../../helpers/mock-fetch';

// Mock all external dependencies BEFORE importing the engine
vi.mock('@glazebot/supabase-client', () => ({
  getSupabaseUrl: () => 'http://test.supabase.co',
  getSession: async () => ({ access_token: 'test-token' }),
}));

vi.mock('$lib/stores/debug.svelte', () => ({
  getDebugStore: () => ({
    commentaryGap: 0,    // No gap — process immediately
    ttsStreaming: false,
    customSystemInstructions: '',
    gameHint: '',
    contextEnabled: false,
    contextInterval: 15,
    contextBufferSize: 10,
  }),
  logDebug: vi.fn(),
  pushTtsTiming: vi.fn(),
  captureFrame: vi.fn(() => 1),
  setFrameResponse: vi.fn(),
  setFrameSceneContext: vi.fn(),
  resetDebugStats: vi.fn(),
  markStarted: vi.fn(),
  markStopped: vi.fn(),
  clearLogFile: vi.fn(),
  clearSceneHistory: vi.fn(),
  clearDebugLog: vi.fn(),
  setDetectedGame: vi.fn(),
  pushSceneSnapshot: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd: string) => {
    if (cmd === 'grab_frame') {
      return { data_uri: 'data:image/png;base64,fakeframe', width: 1920, height: 1080 };
    }
    if (cmd === 'append_debug_log') return '/tmp/debug.log';
    if (cmd === 'clear_debug_log') return;
    return null;
  }),
}));

// Mock streaming audio to avoid browser APIs
vi.mock('$lib/commentary/streaming-audio', () => ({
  StreamingAudioPlayer: {
    isSupported: () => false,
  },
}));

// Now import engine after mocks
import { CommentaryEngine } from '$lib/commentary/engine';

/** Helper: wait for a specific event or timeout */
function waitFor(collector: EventCollector, event: string, timeoutMs = 5000): Promise<unknown> {
  return collector.waitForEvent(event, timeoutMs);
}

describe('CommentaryEngine', () => {
  let engine: CommentaryEngine;
  let collector: EventCollector;

  const party = [fakeCharacter(), fakeCharacter2()];

  beforeEach(() => {
    // Default mock fetch for commentary + TTS
    vi.stubGlobal('fetch', createMockFetch(new Map([
      ['generate-commentary', { body: { text: 'Test response', usage: { input_tokens: 50, output_tokens: 10 } } }],
      ['generative-tts', { status: 200, body: new Blob(['audio']), text: '' }],
    ])));

    // Mock Audio for TTS buffered playback
    vi.stubGlobal('Audio', class MockAudio {
      src = '';
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      play() {
        queueMicrotask(() => this.onended?.());
        return Promise.resolve();
      }
    });

    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:test',
      revokeObjectURL: () => {},
    });

    engine = new CommentaryEngine();
    collector = new EventCollector(engine.events);
  });

  afterEach(() => {
    engine.stop();
    collector.destroy();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('start() emits engine:started', async () => {
    await engine.start('source-1', party);

    const events = collector.getEventNames();
    expect(events).toContain('engine:started');
  });

  it('stop() emits engine:stopped', async () => {
    await engine.start('source-1', party);
    engine.stop();

    const events = collector.getEventNames();
    expect(events).toContain('engine:stopped');
  });

  it('pause() and resume() emit correct events', async () => {
    await engine.start('source-1', party);
    engine.pause();
    engine.resume();

    const events = collector.getEventNames();
    expect(events).toContain('engine:paused');
    expect(events).toContain('engine:resumed');
  });

  it('start() schedules the processing loop', async () => {
    await engine.start('source-1', party);

    // Wait for the pipeline to actually process (POLL_INTERVAL_MS = 2000, real time)
    await waitFor(collector, 'pipeline:start');

    const events = collector.getEventNames();
    expect(events).toContain('pipeline:start');
  });

  it('stop() prevents further processing', async () => {
    await engine.start('source-1', party);
    engine.stop();
    collector.clear();

    // Wait a bit to verify nothing fires
    await new Promise((r) => setTimeout(r, 3000));

    const events = collector.getEventNames();
    expect(events).not.toContain('pipeline:start');
  });

  it('sendDirectMessage() works when engine is stopped', async () => {
    // Engine not started — sendDirectMessage should still work
    await engine.sendDirectMessage('Hello there!', party);

    const events = collector.getEventNames();
    expect(events).toContain('pipeline:start');
    expect(events).toContain('chat-message');

    // Direct messages should NOT show overlay
    expect(events).not.toContain('overlay-show');
  });

  it('queueUserMessage() processes user message with priority', async () => {
    await engine.start('source-1', party);

    // Queue a user message
    engine.queueUserMessage('Hey what game is this?');

    // Wait for the pipeline to start processing
    await waitFor(collector, 'pipeline:start');

    const events = collector.getEventNames();
    expect(events).toContain('pipeline:start');

    const starts = collector.getEvents('pipeline:start');
    expect(starts.length).toBeGreaterThan(0);
  });
});
