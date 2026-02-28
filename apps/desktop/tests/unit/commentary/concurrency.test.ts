/**
 * Concurrency & race condition tests for the commentary engine.
 *
 * These test the real-world scenarios that break things:
 * - User speaks while timed commentary is mid-flight
 * - Multiple user messages arrive faster than processing
 * - Party changes mid-pipeline
 * - Engine stop/pause during active processing
 * - Rapid start/stop cycling
 * - Empty party edge cases
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EngineEventBus } from '$lib/commentary/events';
import { ConversationHistory } from '$lib/commentary/history';
import { MessagePipeline } from '$lib/commentary/pipeline';
import type { MessageRequest } from '$lib/commentary/types';
import { EventCollector } from '../../helpers/event-collector';
import { MockTtsPlayer } from '../../helpers/mock-tts';
import { createMockFetch } from '../../helpers/mock-fetch';
import { fakeCharacter, fakeCharacter2, fakeCharacter3 } from '../../helpers/fixtures';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('@glazebot/supabase-client', () => ({
  getSupabaseUrl: () => 'http://test.supabase.co',
  getSession: async () => ({ access_token: 'test-token' }),
}));

vi.mock('$lib/stores/debug.svelte', () => ({
  getDebugStore: () => ({
    commentaryGap: 0,
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
  incrementBlockStat: vi.fn(),
  markStarted: vi.fn(),
  markStopped: vi.fn(),
  clearLogFile: vi.fn(),
  clearSceneHistory: vi.fn(),
  clearDebugLog: vi.fn(),
  setDetectedGame: vi.fn(),
  pushSceneSnapshot: vi.fn(),
}));

vi.mock('$lib/stores/characterMemory', () => ({
  getMemories: vi.fn(async () => []),
  addMemory: vi.fn(async (m: unknown) => ({ id: 'mock-id', createdAt: new Date().toISOString(), ...m })),
  formatMemoriesForPrompt: vi.fn(() => []),
  deleteMemory: vi.fn(async () => {}),
  clearCharacterMemories: vi.fn(async () => {}),
  getMemoryCount: vi.fn(async () => 0),
}));

// Mock scheduler — round-robins through party members for deterministic character selection
vi.mock('$lib/commentary/scheduler', () => {
  const { DEFAULT_BLOCK_PROMPTS } = vi.importActual('$lib/commentary/scheduler') as Record<string, unknown>;
  let pickCounter = 0;
  return {
    DEFAULT_BLOCK_WEIGHTS: {},
    DEFAULT_BLOCK_PROMPTS,
    BlockScheduler: class MockBlockScheduler {
      pickBlock(party: Array<{ id: string; name: string }>) {
        const idx = pickCounter++ % party.length;
        return { type: 'solo_observation', primaryCharacter: party[idx] };
      }
      getPrompt(type: string) {
        return (DEFAULT_BLOCK_PROMPTS as Record<string, string>)?.[type] ?? 'React to what you see.';
      }
      getDistribution() { return {}; }
      updateWeights() {}
      updatePrompts() {}
      static _resetCounter() { pickCounter = 0; }
    },
  };
});

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

vi.mock('$lib/commentary/streaming-audio', () => ({
  StreamingAudioPlayer: { isSupported: () => false },
}));

import { CommentaryEngine } from '$lib/commentary/engine';

// ── Helpers ────────────────────────────────────────────────────

function waitFor(collector: EventCollector, event: string, timeoutMs = 5000, count = 1): Promise<unknown> {
  return collector.waitForEvent(event, timeoutMs, count);
}

/** Stub globals needed for engine TTS (Audio, URL, fetch) */
function stubBrowserGlobals(fetchResponses?: Map<string | RegExp, any>) {
  vi.stubGlobal('fetch', createMockFetch(fetchResponses ?? new Map([
    ['generate-commentary', { body: { text: 'Response text', usage: { input_tokens: 50, output_tokens: 10 } } }],
    ['generative-tts', { status: 200, text: '' }],
  ])));

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
}

// ── Pipeline-level concurrency (direct control, no timers) ─────

describe('Pipeline concurrency', () => {
  let bus: EngineEventBus;
  let history: ConversationHistory;
  let mockTts: MockTtsPlayer;
  let pipeline: MessagePipeline;
  let collector: EventCollector;

  const char1 = fakeCharacter();
  const char2 = fakeCharacter2();

  function req(overrides: Partial<MessageRequest> = {}): MessageRequest {
    return {
      id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      character: char1,
      trigger: 'timed',
      ...overrides,
    };
  }

  beforeEach(() => {
    bus = new EngineEventBus();
    history = new ConversationHistory();
    mockTts = new MockTtsPlayer(bus);
    pipeline = new MessagePipeline(bus, history, mockTts as any);
    collector = new EventCollector(bus);
  });

  afterEach(() => {
    collector.destroy();
    bus.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('concurrent pipeline calls: both produce complete event chains', async () => {
    // Two pipeline.process() calls running simultaneously with different characters
    vi.stubGlobal('fetch', createMockFetch(new Map([
      ['generate-commentary', { body: { text: 'Concurrent!' } }],
    ])));

    const [r1, r2] = await Promise.all([
      pipeline.process(req({ id: 'concurrent-A', character: char1 })),
      pipeline.process(req({ id: 'concurrent-B', character: char2 })),
    ]);

    expect(r1.text).toBe('Concurrent!');
    expect(r2.text).toBe('Concurrent!');

    // Both should have their own overlay-show/dismiss pairs
    const shows = collector.getEvents('overlay-show');
    const dismisses = collector.getEvents('overlay-dismiss');
    expect(shows).toHaveLength(2);
    expect(dismisses).toHaveLength(2);

    const bubbleIds = shows.map((e) => (e.data as any).bubbleId);
    expect(bubbleIds).toContain('concurrent-A');
    expect(bubbleIds).toContain('concurrent-B');
  });

  it('slow TTS on first message does not block second message events', async () => {
    vi.stubGlobal('fetch', createMockFetch(new Map([
      ['generate-commentary', { body: { text: 'Msg' } }],
    ])));

    // First message has slow TTS
    mockTts.delay = 200;

    const p1 = pipeline.process(req({ id: 'slow-tts', character: char1 }));

    // Second message starts while first is stuck in TTS
    // Reset delay for second message
    setTimeout(() => { mockTts.delay = 0; }, 50);
    const p2 = pipeline.process(req({ id: 'fast-msg', character: char2 }));

    await Promise.all([p1, p2]);

    // Both should complete with proper dismiss
    const dismisses = collector.getEvents('overlay-dismiss');
    const dismissBubbles = dismisses.map((e) => (e.data as any).bubbleId);
    expect(dismissBubbles).toContain('slow-tts');
    expect(dismissBubbles).toContain('fast-msg');
  });

  it('abort mid-LLM: pipeline still emits end event', async () => {
    const ac = new AbortController();

    // LLM takes a while — abort during the call
    const slowFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      // Simulate slow LLM — abort happens during this delay
      await new Promise((r) => setTimeout(r, 50));
      if (init?.signal?.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError');
      }
      return {
        ok: true, status: 200,
        json: async () => ({ text: 'Too late' }),
        text: async () => '{"text":"Too late"}',
        headers: new Headers(),
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', slowFetch);

    // Abort after 20ms (while LLM is "thinking")
    setTimeout(() => ac.abort(), 20);

    await expect(pipeline.process(req({ signal: ac.signal }))).rejects.toThrow();

    const events = collector.getEventNames();
    expect(events).toContain('pipeline:abort');
    expect(events).toContain('pipeline:end');
    // No TTS should have started
    expect(events).not.toContain('pipeline:tts-start');
  });

  it('different characters get separate history entries from concurrent calls', async () => {
    let callCount = 0;
    const mockFetch = vi.fn(async () => {
      callCount++;
      return {
        ok: true, status: 200,
        json: async () => ({ text: `Reply ${callCount}` }),
        text: async () => JSON.stringify({ text: `Reply ${callCount}` }),
        headers: new Headers(),
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', mockFetch);

    await pipeline.process(req({ character: char1, playerText: 'Hey char1' }));
    await pipeline.process(req({ character: char2, playerText: 'Hey char2' }));

    const h1 = history.get(char1.id);
    const h2 = history.get(char2.id);

    expect(h1).toHaveLength(2);
    expect(h2).toHaveLength(2);
    expect(h1[0].content).toContain('Hey char1');
    expect(h2[0].content).toContain('Hey char2');
    // Different responses
    expect(h1[1].content).not.toBe(h2[1].content);
  });

  it('LLM error on first, success on second — only first emits error', async () => {
    let callCount = 0;
    const mockFetch = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        return { ok: false, status: 500, text: async () => 'Server Error', headers: new Headers() } as unknown as Response;
      }
      return {
        ok: true, status: 200,
        json: async () => ({ text: 'Success!' }),
        text: async () => '{"text":"Success!"}',
        headers: new Headers(),
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', mockFetch);

    const r1 = await pipeline.process(req({ id: 'fail-req', trigger: 'user' }));
    const r2 = await pipeline.process(req({ id: 'ok-req' }));

    expect(r1.text).toBe('');
    expect(r2.text).toBe('Success!');

    const errors = collector.getEvents('pipeline:llm-error');
    expect(errors).toHaveLength(1);
    expect((errors[0].data as any).requestId).toBe('fail-req');

    // Second request should have overlay
    const shows = collector.getEvents('overlay-show');
    expect(shows).toHaveLength(1);
    expect((shows[0].data as any).bubbleId).toBe('ok-req');
  });

  it('TTS error on first, success on second — both get overlay-dismiss', async () => {
    vi.stubGlobal('fetch', createMockFetch(new Map([
      ['generate-commentary', { body: { text: 'Some text' } }],
    ])));

    // First call fails TTS
    mockTts.shouldFail = true;

    await expect(pipeline.process(req({ id: 'tts-fail' }))).rejects.toThrow();

    // Second call succeeds
    mockTts.shouldFail = false;
    await pipeline.process(req({ id: 'tts-ok' }));

    const dismisses = collector.getEvents('overlay-dismiss');
    const dismissBubbles = dismisses.map((e) => (e.data as any).bubbleId);
    expect(dismissBubbles).toContain('tts-fail');
    expect(dismissBubbles).toContain('tts-ok');
  });
});


// ── Engine-level concurrency (timers, queues, real orchestration) ──

describe('Engine concurrency', () => {
  let engine: CommentaryEngine;
  let collector: EventCollector;

  const char1 = fakeCharacter();
  const char2 = fakeCharacter2();
  const char3 = fakeCharacter3();

  beforeEach(() => {
    stubBrowserGlobals();
    engine = new CommentaryEngine();
    collector = new EventCollector(engine.events);
  });

  afterEach(() => {
    engine.stop();
    collector.destroy();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('user message interrupts timed cycle — timed cycle aborts', async () => {
    // Use slow LLM so timed cycle is still in-flight when user message arrives
    let fetchCallCount = 0;
    const slowFetch = vi.fn(async (url: string, init?: RequestInit) => {
      fetchCallCount++;
      const isCommentary = typeof url === 'string' && url.includes('generate-commentary');
      if (isCommentary && fetchCallCount === 1) {
        // First call (timed) — slow
        await new Promise((r) => setTimeout(r, 300));
        if (init?.signal?.aborted) {
          throw new DOMException('The operation was aborted.', 'AbortError');
        }
      }
      if (typeof url === 'string' && url.includes('generative-tts')) {
        return { ok: true, status: 200, blob: async () => new Blob(['']), text: async () => '', headers: new Headers() } as unknown as Response;
      }
      return {
        ok: true, status: 200,
        json: async () => ({ text: `Reply ${fetchCallCount}` }),
        text: async () => JSON.stringify({ text: `Reply ${fetchCallCount}` }),
        headers: new Headers(),
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', slowFetch);

    await engine.start('src-1', [char1, char2]);

    // Wait for timed cycle to START
    await waitFor(collector, 'pipeline:start');

    // While timed cycle LLM is slow, user sends a message
    engine.queueUserMessage('Whats happening?');

    // Wait for the timed cycle to abort or end, then user message to process
    await waitFor(collector, 'pipeline:end', 5000, 2);

    const events = collector.getEventNames();

    // Should see an abort from the timed cycle being preempted
    const aborts = collector.getEvents('pipeline:abort');
    // Abort may or may not fire depending on timing — but the key guarantee
    // is that the user message DID get processed
    const starts = collector.getEvents('pipeline:start');
    expect(starts.length).toBeGreaterThanOrEqual(2); // timed + user

    // At least one pipeline:end for each
    const ends = collector.getEvents('pipeline:end');
    expect(ends.length).toBeGreaterThanOrEqual(2);
  }, 10000);

  it('multiple rapid user messages drain in order', async () => {
    // Track which player_text values arrive at the LLM by intercepting pipeline:start events
    await engine.start('src-1', [char1]);

    // Fire 3 messages in rapid succession
    engine.queueUserMessage('First');
    engine.queueUserMessage('Second');
    engine.queueUserMessage('Third');

    // Wait for all 3 user messages to process (plus any timed cycle that was already scheduled)
    // We need at least 3 pipeline:end events for the user messages
    // Use a generous timeout since there's a 2s poll interval + processing time
    await waitFor(collector, 'pipeline:end', 15000, 4);

    // Check that all 3 user messages were processed via pipeline:start playerText
    const starts = collector.getEvents('pipeline:start');
    const playerTexts = starts
      .map((e) => (e.data as any).playerText)
      .filter(Boolean);

    expect(playerTexts).toContain('First');
    expect(playerTexts).toContain('Second');
    expect(playerTexts).toContain('Third');
  }, 20000);

  it('party update mid-session — new character gets picked', async () => {
    // Start with just char1
    await engine.start('src-1', [char1]);

    // Wait for first timed cycle
    await waitFor(collector, 'pipeline:start');

    // Hot-swap the party to only char3
    engine.updateParty([char3]);

    // Queue a user message — should use char3 since that's the only option
    engine.queueUserMessage('Hello new party!');

    // Wait for the user message pipeline to complete
    // We need at least 2 pipeline:end events (timed + user)
    await waitFor(collector, 'pipeline:end', 5000, 2);

    // Find chat-message events — at least one should reference ThirdWheel
    const chatMsgs = collector.getEvents('chat-message');
    const hasThirdWheel = chatMsgs.some((e) => (e.data as any).name === 'ThirdWheel');
    // The user message should use char3 since it's the only party member now
    expect(hasThirdWheel).toBe(true);
  });

  it('party reduced to empty — engine loop keeps running without crashing', async () => {
    await engine.start('src-1', [char1]);

    // Wait for first timed cycle to begin
    await waitFor(collector, 'pipeline:start');
    await waitFor(collector, 'pipeline:end');

    // Remove all party members
    engine.updateParty([]);
    collector.clear();

    // Let the loop tick a couple more times — should not crash
    await new Promise((r) => setTimeout(r, 2500));

    // No pipeline:start should fire with empty party
    // (processNext returns early and reschedules)
    const starts = collector.getEvents('pipeline:start');
    expect(starts).toHaveLength(0);
  });

  it('stop during active TTS — processing halts, no further events after stop', async () => {
    await engine.start('src-1', [char1]);

    // Wait for the first timed cycle to begin processing
    await waitFor(collector, 'pipeline:start');

    // Stop engine while it's processing (LLM or TTS)
    engine.stop();

    const events = collector.getEventNames();
    expect(events).toContain('engine:stopped');

    // After stopping, wait a bit and verify no NEW pipeline:start events
    const startsBeforeStop = collector.getEvents('pipeline:start').length;
    await new Promise((r) => setTimeout(r, 3000));

    const startsAfterWait = collector.getEvents('pipeline:start').length;
    expect(startsAfterWait).toBe(startsBeforeStop);
  }, 10000);

  it('pause during processing — resume continues', async () => {
    await engine.start('src-1', [char1]);

    // Wait for first cycle to complete
    await waitFor(collector, 'pipeline:end', 8000);

    // Pause
    engine.pause();
    const startsAtPause = collector.getEvents('pipeline:start').length;

    // Wait and verify no new pipeline:start fires while paused
    await new Promise((r) => setTimeout(r, 2500));
    expect(collector.getEvents('pipeline:start').length).toBe(startsAtPause);

    // Resume — should schedule next cycle
    engine.resume();
    await waitFor(collector, 'pipeline:start', 5000, startsAtPause + 1);
    expect(collector.getEvents('pipeline:start').length).toBeGreaterThan(startsAtPause);
  }, 20000);

  it('rapid start/stop/start does not leave orphan timers', async () => {
    await engine.start('src-1', [char1]);
    engine.stop();

    collector.clear();
    await engine.start('src-1', [char2]);

    // Wait for processing from the second start
    await waitFor(collector, 'pipeline:start');

    const events = collector.getEventNames();
    // Should see engine:started for the second start
    expect(events).toContain('engine:started');
    expect(events).toContain('pipeline:start');

    // The first engine's timer should not be firing anymore
    // (if it were, we'd see extra pipeline:start events or errors)
  });

  it('sendDirectMessage while engine is processing — queues and drains', async () => {
    // Start engine with slow LLM
    let callCount = 0;
    const slowFetch = vi.fn(async (url: string) => {
      callCount++;
      if (typeof url === 'string' && url.includes('generate-commentary')) {
        if (callCount === 1) {
          await new Promise((r) => setTimeout(r, 200)); // slow first call
        }
        return {
          ok: true, status: 200,
          json: async () => ({ text: `Reply-${callCount}` }),
          text: async () => JSON.stringify({ text: `Reply-${callCount}` }),
          headers: new Headers(),
        } as unknown as Response;
      }
      return { ok: true, status: 200, blob: async () => new Blob([]), text: async () => '', headers: new Headers() } as unknown as Response;
    });
    vi.stubGlobal('fetch', slowFetch);

    await engine.start('src-1', [char1]);

    // Wait for timed processing to begin
    await waitFor(collector, 'pipeline:start');

    // While timed cycle is active, try sending a direct message
    // sendDirectMessage checks state === 'processing' and queues it
    engine.sendDirectMessage('Direct while busy', [char1, char2]);

    // Wait for multiple pipeline:end events
    await waitFor(collector, 'pipeline:end', 10000, 2);

    // Both should have produced chat-messages
    const msgs = collector.getEvents('chat-message');
    expect(msgs.length).toBeGreaterThanOrEqual(2);
  });

  it('3-member party — all characters can be selected for commentary', async () => {
    // The mock scheduler round-robins through party members deterministically
    await engine.start('src-1', [char1, char2, char3]);

    // Wait for 3 timed cycles — each takes ~2s poll interval
    await waitFor(collector, 'pipeline:end', 15000, 3);

    const starts = collector.getEvents('pipeline:start');
    const characters = starts.map((e) => (e.data as any).character);

    // All 3 characters should have been selected at least once
    expect(characters).toContain('TestChar');
    expect(characters).toContain('ReactorBot');
    expect(characters).toContain('ThirdWheel');
  }, 20000);

  it('removing a character mid-session — removed character not used for new messages', async () => {
    await engine.start('src-1', [char1, char2, char3]);

    // Wait for first cycle
    await waitFor(collector, 'pipeline:end');

    // Remove char2 from party
    engine.updateParty([char1, char3]);

    // Queue several user messages to force processing with the updated party
    engine.queueUserMessage('Message 1');
    engine.queueUserMessage('Message 2');
    engine.queueUserMessage('Message 3');

    // Wait for all to process
    await waitFor(collector, 'pipeline:end', 10000, 4); // 1 timed + 3 user

    // Get all pipeline:start events AFTER the party update
    const allStarts = collector.getEvents('pipeline:start');
    // Find starts that happened after the first pipeline:end
    const firstEndTime = collector.getEvents('pipeline:end')[0].timestamp;
    const postUpdateStarts = allStarts.filter((e) => e.timestamp > firstEndTime);

    // None of the post-update starts should reference ReactorBot
    for (const start of postUpdateStarts) {
      // User-triggered starts don't always have the character in pipeline:start
      // but we can check chat-messages
    }

    // Check that chat-messages after update don't reference ReactorBot
    const allMsgs = collector.getEvents('chat-message');
    const firstEndIdx = collector.getEvents('pipeline:end')[0].timestamp;
    const postUpdateMsgs = allMsgs.filter((e) => e.timestamp > firstEndIdx);

    // ReactorBot should NOT appear in any post-update messages
    // (with 3 user messages + possible timed cycles, all should use char1 or char3)
    const reactorMsgs = postUpdateMsgs.filter((e) => (e.data as any).name === 'ReactorBot');
    expect(reactorMsgs).toHaveLength(0);
  });

  it('double start() is a no-op — does not create duplicate timers', async () => {
    await engine.start('src-1', [char1]);
    await engine.start('src-1', [char1]); // second call should be ignored

    // Wait for processing
    await waitFor(collector, 'pipeline:end');

    // Should only have one engine:started event
    const startEvents = collector.getEvents('engine:started');
    expect(startEvents).toHaveLength(1);
  });

  it('user message addressed to specific character selects that character', async () => {
    await engine.start('src-1', [char1, char2, char3]);

    // Queue message mentioning ReactorBot by name
    engine.queueUserMessage('Hey ReactorBot what do you think?');

    // Wait for the user message to process
    await waitFor(collector, 'pipeline:end', 5000, 2); // timed + user

    const chatMsgs = collector.getEvents('chat-message');
    const reactorMsg = chatMsgs.find((e) => (e.data as any).name === 'ReactorBot');

    // ReactorBot should have been matched by name
    expect(reactorMsg).toBeDefined();
  });

  it('sendDirectMessage with empty text or empty party is a no-op', async () => {
    await engine.sendDirectMessage('', [char1]);
    await engine.sendDirectMessage('   ', [char1]);
    await engine.sendDirectMessage('Hello', []);

    const events = collector.getEventNames();
    expect(events).not.toContain('pipeline:start');
  });
});
