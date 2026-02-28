import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fakeCharacter, fakeCharacter2, fakeCharacter3 } from '../../helpers/fixtures';
import { EventCollector } from '../../helpers/event-collector';
import { createMockFetch } from '../../helpers/mock-fetch';

// Mock dependencies
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
  markStarted: vi.fn(),
  markStopped: vi.fn(),
  clearLogFile: vi.fn(),
  clearSceneHistory: vi.fn(),
  clearDebugLog: vi.fn(),
  setDetectedGame: vi.fn(),
  pushSceneSnapshot: vi.fn(),
  incrementBlockStat: vi.fn(),
}));

vi.mock('$lib/commentary/streaming-audio', () => ({
  StreamingAudioPlayer: { isSupported: () => false },
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd: string) => {
    if (cmd === 'grab_frame') return { data_uri: 'data:image/png;base64,fakeframe', width: 1920, height: 1080 };
    if (cmd === 'append_debug_log') return '/tmp/debug.log';
    if (cmd === 'clear_debug_log') return;
    return null;
  }),
}));

import { MessagePipeline } from '$lib/commentary/pipeline';
import { ConversationHistory } from '$lib/commentary/history';
import { EngineEventBus } from '$lib/commentary/events';
import type { MessageRequest } from '$lib/commentary/types';

class MockTts {
  calls: unknown[] = [];
  async playTTS(opts: unknown) {
    this.calls.push(opts);
  }
}

describe('Multi-Character Conversations (processMulti)', () => {
  let pipeline: MessagePipeline;
  let events: EngineEventBus;
  let collector: EventCollector;
  let history: ConversationHistory;
  let mockTts: MockTts;

  beforeEach(() => {
    events = new EngineEventBus();
    history = new ConversationHistory();
    mockTts = new MockTts();
    pipeline = new MessagePipeline(events, history, mockTts as any);
    collector = new EventCollector(events);
  });

  afterEach(() => {
    collector.destroy();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function makeRequest(overrides?: Partial<MessageRequest>): MessageRequest {
    return {
      id: 'test-req-1',
      character: fakeCharacter(),
      trigger: 'timed',
      participants: [fakeCharacter(), fakeCharacter2()],
      blockType: 'quip_banter',
      blockPrompt: 'Have a quick exchange.',
      ...overrides,
    };
  }

  it('returns structured lines when edge function returns JSON lines', async () => {
    vi.stubGlobal('fetch', createMockFetch(new Map([
      ['generate-commentary', {
        body: {
          lines: [
            { character: 'TestChar', line: 'Nice shot!' },
            { character: 'ReactorBot', line: 'I could do better.' },
          ],
          text: '[{"character":"TestChar","line":"Nice shot!"},{"character":"ReactorBot","line":"I could do better."}]',
          usage: { input_tokens: 100, output_tokens: 40 },
        },
      }],
    ])));
    vi.stubGlobal('Audio', class { src = ''; onended: (() => void) | null = null; play() { queueMicrotask(() => this.onended?.()); return Promise.resolve(); } });
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} });

    const result = await pipeline.processMulti(makeRequest());

    expect(result.lines.length).toBe(2);
    expect(result.lines[0].characterName).toBe('TestChar');
    expect(result.lines[0].text).toBe('Nice shot!');
    expect(result.lines[1].characterName).toBe('ReactorBot');
    expect(result.lines[1].text).toBe('I could do better.');
  });

  it('emits chat-message and overlay events for each line', async () => {
    vi.stubGlobal('fetch', createMockFetch(new Map([
      ['generate-commentary', {
        body: {
          lines: [
            { character: 'TestChar', line: 'First line!' },
            { character: 'ReactorBot', line: 'Second line!' },
          ],
          text: '...',
          usage: { input_tokens: 80, output_tokens: 30 },
        },
      }],
    ])));
    vi.stubGlobal('Audio', class { src = ''; onended: (() => void) | null = null; play() { queueMicrotask(() => this.onended?.()); return Promise.resolve(); } });
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} });

    await pipeline.processMulti(makeRequest());

    const chatMessages = collector.getEvents('chat-message');
    expect(chatMessages.length).toBe(2);

    const overlayShows = collector.getEvents('overlay-show');
    expect(overlayShows.length).toBe(2);

    const overlayDismisses = collector.getEvents('overlay-dismiss');
    expect(overlayDismisses.length).toBe(2);
  });

  it('falls back to single character when text response (no lines)', async () => {
    vi.stubGlobal('fetch', createMockFetch(new Map([
      ['generate-commentary', {
        body: {
          text: 'A plain text response with no JSON lines.',
          usage: { input_tokens: 50, output_tokens: 15 },
        },
      }],
    ])));
    vi.stubGlobal('Audio', class { src = ''; onended: (() => void) | null = null; play() { queueMicrotask(() => this.onended?.()); return Promise.resolve(); } });
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} });

    const result = await pipeline.processMulti(makeRequest());

    expect(result.lines.length).toBe(1);
    expect(result.lines[0].characterName).toBe('TestChar');
    expect(result.lines[0].text).toBe('A plain text response with no JSON lines.');
  });

  it('falls back to process() when fewer than 2 participants', async () => {
    vi.stubGlobal('fetch', createMockFetch(new Map([
      ['generate-commentary', {
        body: { text: 'Solo response', usage: { input_tokens: 30, output_tokens: 10 } },
      }],
      ['generative-tts', { status: 200, body: new Blob(['audio']), text: '' }],
    ])));
    vi.stubGlobal('Audio', class { src = ''; onended: (() => void) | null = null; play() { queueMicrotask(() => this.onended?.()); return Promise.resolve(); } });
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} });

    const result = await pipeline.processMulti(makeRequest({
      participants: [fakeCharacter()], // only 1
    }));

    expect(result.lines.length).toBe(1);
    expect(result.lines[0].text).toBe('Solo response');
  });

  it('returns empty lines when response is empty', async () => {
    vi.stubGlobal('fetch', createMockFetch(new Map([
      ['generate-commentary', {
        body: { text: '', usage: { input_tokens: 20, output_tokens: 0 } },
      }],
    ])));

    const result = await pipeline.processMulti(makeRequest());

    expect(result.lines.length).toBe(0);
  });

  it('plays TTS for each line with voice_id', async () => {
    vi.stubGlobal('fetch', createMockFetch(new Map([
      ['generate-commentary', {
        body: {
          lines: [
            { character: 'TestChar', line: 'Line 1' },
            { character: 'ReactorBot', line: 'Line 2' },
          ],
          text: '...',
          usage: { input_tokens: 60, output_tokens: 20 },
        },
      }],
    ])));
    vi.stubGlobal('Audio', class { src = ''; onended: (() => void) | null = null; play() { queueMicrotask(() => this.onended?.()); return Promise.resolve(); } });
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} });

    await pipeline.processMulti(makeRequest());

    expect(mockTts.calls.length).toBe(2);
  });

  it('handles 3-character hype_chain', async () => {
    vi.stubGlobal('fetch', createMockFetch(new Map([
      ['generate-commentary', {
        body: {
          lines: [
            { character: 'TestChar', line: 'LETS GO!' },
            { character: 'ReactorBot', line: 'NO WAY!' },
            { character: 'ThirdWheel', line: 'INCREDIBLE!' },
          ],
          text: '...',
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      }],
    ])));
    vi.stubGlobal('Audio', class { src = ''; onended: (() => void) | null = null; play() { queueMicrotask(() => this.onended?.()); return Promise.resolve(); } });
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} });

    const result = await pipeline.processMulti(makeRequest({
      participants: [fakeCharacter(), fakeCharacter2(), fakeCharacter3()],
      blockType: 'hype_chain',
    }));

    expect(result.lines.length).toBe(3);
    expect(result.lines[2].characterName).toBe('ThirdWheel');
  });
});
