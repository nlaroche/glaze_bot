import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EngineEventBus } from '$lib/commentary/events';
import { ConversationHistory } from '$lib/commentary/history';
import { MessagePipeline } from '$lib/commentary/pipeline';
import type { MessageRequest } from '$lib/commentary/types';
import { EventCollector } from '../../helpers/event-collector';
import { MockTtsPlayer } from '../../helpers/mock-tts';
import { createMockFetch } from '../../helpers/mock-fetch';
import { fakeCharacter } from '../../helpers/fixtures';

// Mock external dependencies
vi.mock('@glazebot/supabase-client', () => ({
  getSupabaseUrl: () => 'http://test.supabase.co',
  getSession: async () => ({ access_token: 'test-token' }),
}));

vi.mock('$lib/stores/debug.svelte', () => ({
  getDebugStore: () => ({
    commentaryGap: 30,
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
}));

describe('MessagePipeline', () => {
  let bus: EngineEventBus;
  let history: ConversationHistory;
  let mockTts: MockTtsPlayer;
  let pipeline: MessagePipeline;
  let collector: EventCollector;

  const character = fakeCharacter();

  function buildRequest(overrides: Partial<MessageRequest> = {}): MessageRequest {
    return {
      id: 'req-1',
      character,
      trigger: 'timed',
      ...overrides,
    };
  }

  beforeEach(() => {
    bus = new EngineEventBus();
    history = new ConversationHistory();
    mockTts = new MockTtsPlayer(bus);
    // Cast MockTtsPlayer to TtsPlayer since pipeline only uses the playTTS method
    pipeline = new MessagePipeline(bus, history, mockTts as any);
    collector = new EventCollector(bus);
  });

  afterEach(() => {
    collector.destroy();
    bus.clear();
    vi.restoreAllMocks();
  });

  it('happy path: full event chain for timed cycle', async () => {
    vi.stubGlobal('fetch', createMockFetch(new Map([
      ['generate-commentary', {
        body: { text: 'Hello world!', usage: { input_tokens: 100, output_tokens: 20 } },
      }],
    ])));

    const result = await pipeline.process(buildRequest());

    expect(result.text).toBe('Hello world!');

    const events = collector.getEventNames();
    expect(events).toContain('pipeline:start');
    expect(events).toContain('pipeline:llm-start');
    expect(events).toContain('pipeline:llm-end');
    expect(events).toContain('chat-message');
    expect(events).toContain('overlay-show');
    expect(events).toContain('pipeline:tts-start');
    expect(events).toContain('pipeline:tts-end');
    expect(events).toContain('overlay-dismiss');
    expect(events).toContain('pipeline:end');

    // overlay-show happens before tts-start
    const showIdx = events.indexOf('overlay-show');
    const ttsStartIdx = events.indexOf('pipeline:tts-start');
    const dismissIdx = events.indexOf('overlay-dismiss');
    expect(showIdx).toBeLessThan(ttsStartIdx);
    expect(ttsStartIdx).toBeLessThan(dismissIdx);

    vi.unstubAllGlobals();
  });

  it('LLM returns silence: no overlay, no TTS', async () => {
    vi.stubGlobal('fetch', createMockFetch(new Map([
      ['generate-commentary', { body: { text: '' } }],
    ])));

    const result = await pipeline.process(buildRequest());

    expect(result.text).toBe('');
    const events = collector.getEventNames();
    expect(events).toContain('pipeline:silence');
    expect(events).not.toContain('overlay-show');
    expect(events).not.toContain('pipeline:tts-start');
    expect(events).toContain('pipeline:end');

    // TTS should not have been called
    expect(mockTts.calls).toHaveLength(0);

    vi.unstubAllGlobals();
  });

  it('LLM HTTP error (500): emits error and system-message for user trigger', async () => {
    vi.stubGlobal('fetch', createMockFetch(new Map([
      ['generate-commentary', { status: 500, ok: false, text: 'Internal Server Error' }],
    ])));

    const result = await pipeline.process(buildRequest({ trigger: 'user' }));

    expect(result.text).toBe('');
    const events = collector.getEventNames();
    expect(events).toContain('pipeline:llm-error');
    expect(events).toContain('system-message');

    const errorEvent = collector.getEvents('pipeline:llm-error')[0];
    expect((errorEvent.data as any).status).toBe(500);

    vi.unstubAllGlobals();
  });

  it('LLM HTTP error (500): no system-message for timed trigger', async () => {
    vi.stubGlobal('fetch', createMockFetch(new Map([
      ['generate-commentary', { status: 500, ok: false, text: 'Internal Server Error' }],
    ])));

    await pipeline.process(buildRequest({ trigger: 'timed' }));

    const events = collector.getEventNames();
    expect(events).toContain('pipeline:llm-error');
    expect(events).not.toContain('system-message');

    vi.unstubAllGlobals();
  });

  it('TTS failure: overlay-dismiss STILL fires (try/finally guarantee)', async () => {
    vi.stubGlobal('fetch', createMockFetch(new Map([
      ['generate-commentary', { body: { text: 'Hello!' } }],
    ])));

    mockTts.shouldFail = true;

    // Pipeline should not throw — the TTS error is caught in the finally block
    // Actually looking at pipeline.ts, the TTS call is in a try/finally inside the try,
    // and errors from TTS will propagate to the outer catch. Let's check...
    // TTS error throws, goes to outer catch which re-throws. But overlay-dismiss fires in inner finally.
    await expect(pipeline.process(buildRequest())).rejects.toThrow('TTS playback failed');

    const events = collector.getEventNames();
    expect(events).toContain('overlay-show');
    expect(events).toContain('overlay-dismiss');
    expect(events).toContain('pipeline:end');

    vi.unstubAllGlobals();
  });

  it('abort before TTS: emits pipeline:abort, no TTS call', async () => {
    // Create a signal that will be aborted AFTER the LLM call but BEFORE TTS
    // The pipeline checks signal.aborted at step 7, after LLM returns.
    // We abort after the fetch resolves but the pipeline hasn't reached the check yet.
    const abortController = new AbortController();

    // Mock fetch that succeeds, then we abort while pipeline processes the response
    const mockFetch = vi.fn(async () => {
      // Abort after fetch resolves — pipeline will see aborted signal at step 7
      abortController.abort();
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ text: 'Hello!' }),
        json: async () => ({ text: 'Hello!' }),
        headers: new Headers({ 'Content-Type': 'application/json' }),
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await pipeline.process(buildRequest({ signal: abortController.signal }));

    expect(result.text).toBe('Hello!');
    const events = collector.getEventNames();
    expect(events).toContain('pipeline:abort');
    expect(events).not.toContain('pipeline:tts-start');
    expect(events).toContain('pipeline:end');

    vi.unstubAllGlobals();
  });

  it('with visuals and no text: overlay-show fires for visuals only', async () => {
    vi.stubGlobal('fetch', createMockFetch(new Map([
      ['generate-commentary', {
        body: { text: '', visuals: [{ type: 'image', url: 'https://example.com/img.png' }] },
      }],
    ])));

    const result = await pipeline.process(buildRequest());

    const events = collector.getEventNames();
    expect(events).toContain('overlay-show');
    // No TTS since text is empty
    expect(mockTts.calls).toHaveLength(0);
    expect(events).toContain('overlay-dismiss');

    vi.unstubAllGlobals();
  });

  it('direct message: no overlay-show, no TTS', async () => {
    vi.stubGlobal('fetch', createMockFetch(new Map([
      ['generate-commentary', { body: { text: 'Direct reply.' } }],
    ])));

    const result = await pipeline.process(buildRequest({ trigger: 'direct' }));

    expect(result.text).toBe('Direct reply.');
    const events = collector.getEventNames();
    expect(events).toContain('chat-message');
    expect(events).not.toContain('overlay-show');
    expect(events).not.toContain('overlay-dismiss');
    expect(mockTts.calls).toHaveLength(0);

    vi.unstubAllGlobals();
  });

  it('reaction: stores correct user content in history', async () => {
    vi.stubGlobal('fetch', createMockFetch(new Map([
      ['generate-commentary', { body: { text: 'Haha nice!' } }],
    ])));

    await pipeline.process(buildRequest({
      trigger: 'reaction',
      reactTo: { name: 'SpeakerBot', text: 'Great play!' },
    }));

    const hist = history.get(character.id);
    expect(hist).toHaveLength(2);
    expect(hist[0].content).toBe('SpeakerBot said: "Great play!"');
    expect(hist[1].content).toBe('Haha nice!');

    vi.unstubAllGlobals();
  });

  it('per-bubble dismiss: each request gets unique bubbleId', async () => {
    vi.stubGlobal('fetch', createMockFetch(new Map([
      ['generate-commentary', { body: { text: 'Hello!' } }],
    ])));

    await pipeline.process(buildRequest({ id: 'bubble-A' }));
    await pipeline.process(buildRequest({ id: 'bubble-B' }));

    const shows = collector.getEvents('overlay-show');
    const dismisses = collector.getEvents('overlay-dismiss');

    expect(shows).toHaveLength(2);
    expect(dismisses).toHaveLength(2);
    expect((shows[0].data as any).bubbleId).toBe('bubble-A');
    expect((shows[1].data as any).bubbleId).toBe('bubble-B');
    expect((dismisses[0].data as any).bubbleId).toBe('bubble-A');
    expect((dismisses[1].data as any).bubbleId).toBe('bubble-B');

    vi.unstubAllGlobals();
  });

  it('slow TTS: overlay stays visible during playback', async () => {
    vi.stubGlobal('fetch', createMockFetch(new Map([
      ['generate-commentary', { body: { text: 'Taking my time...' } }],
    ])));

    mockTts.delay = 100; // simulate slow TTS

    const events: string[] = [];
    bus.on('overlay-show', () => events.push('show'));
    bus.on('pipeline:tts-start', () => events.push('tts-start'));
    bus.on('pipeline:tts-end', () => events.push('tts-end'));
    bus.on('overlay-dismiss', () => events.push('dismiss'));

    await pipeline.process(buildRequest());

    expect(events).toEqual(['show', 'tts-start', 'tts-end', 'dismiss']);

    vi.unstubAllGlobals();
  });

  it('player text stored in history as Player: quote', async () => {
    vi.stubGlobal('fetch', createMockFetch(new Map([
      ['generate-commentary', { body: { text: 'I see!' } }],
    ])));

    await pipeline.process(buildRequest({ trigger: 'user', playerText: 'What is this game?' }));

    const hist = history.get(character.id);
    expect(hist[0].content).toBe('Player: "What is this game?"');

    vi.unstubAllGlobals();
  });

  it('screen-only history when no playerText or reactTo', async () => {
    vi.stubGlobal('fetch', createMockFetch(new Map([
      ['generate-commentary', { body: { text: 'Nice scenery!' } }],
    ])));

    await pipeline.process(buildRequest());

    const hist = history.get(character.id);
    expect(hist[0].content).toBe('(screen only)');

    vi.unstubAllGlobals();
  });
});
