/**
 * Comprehensive scenario tests for the commentary engine overhaul.
 *
 * Covers:
 * - Happy paths for all block types
 * - Edge cases (empty party, no backstory, no history, all-zero weights)
 * - Error cases (LLM failures, malformed responses, auth failures)
 * - Different party sizes (1, 2, 3 members)
 * - Scheduler + Pipeline + Memory integration
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { BlockScheduler, DEFAULT_BLOCK_WEIGHTS, DEFAULT_BLOCK_PROMPTS } from '$lib/commentary/scheduler';
import {
  addMemory,
  getMemories,
  clearCharacterMemories,
  formatMemoriesForPrompt,
  getMemoryCount,
  deleteMemory,
} from '$lib/stores/characterMemory';
import { fakeCharacter, fakeCharacter2, fakeCharacter3 } from '../../helpers/fixtures';
import { EventCollector } from '../../helpers/event-collector';
import { createMockFetch } from '../../helpers/mock-fetch';
import type { HistoryEntry, BlockType } from '$lib/commentary/types';

// ── Mocks for pipeline tests ──
vi.mock('@glazebot/supabase-client', () => ({
  getSupabaseUrl: () => 'http://test.supabase.co',
  getSession: vi.fn(async () => ({ access_token: 'test-token' })),
}));

vi.mock('$lib/stores/debug.svelte', () => ({
  getDebugStore: () => ({
    commentaryGap: 0,
    ttsStreaming: false,
    customSystemInstructions: '',
    gameHint: '',
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

vi.mock('$lib/commentary/streaming-audio', () => ({
  StreamingAudioPlayer: { isSupported: () => false },
}));

import { EngineEventBus } from '$lib/commentary/events';
import { ConversationHistory } from '$lib/commentary/history';
import { MessagePipeline } from '$lib/commentary/pipeline';
import type { MessageRequest } from '$lib/commentary/types';

class MockTts {
  calls: unknown[] = [];
  shouldFail = false;
  async playTTS(opts: unknown) {
    this.calls.push(opts);
    if (this.shouldFail) throw new Error('TTS failed');
  }
}

// ══════════════════════════════════════════════════════════════
// SCHEDULER SCENARIOS
// ══════════════════════════════════════════════════════════════

describe('Scheduler Scenarios', () => {
  function emptyHistory(): Map<string, HistoryEntry[]> { return new Map(); }
  function richHistory(turns = 5): Map<string, HistoryEntry[]> {
    const h = new Map<string, HistoryEntry[]>();
    const entries: HistoryEntry[] = [];
    for (let i = 0; i < turns; i++) {
      entries.push({ role: 'user', content: `(screen ${i})` });
      entries.push({ role: 'assistant', content: `Response ${i}` });
    }
    h.set('char-1', entries);
    return h;
  }

  // ── Happy paths: every block type can be selected ──

  describe('Happy Paths — All Block Types', () => {
    const blockTypes: BlockType[] = [
      'solo_observation', 'emotional_reaction', 'question',
      'backstory_reference', 'quip_banter', 'callback',
      'hype_chain', 'silence',
    ];

    for (const bt of blockTypes) {
      it(`can select ${bt} when conditions are met`, () => {
        // Set weight to 100 for target, 0 for everything else
        const weights: Record<string, number> = {};
        for (const t of blockTypes) weights[t] = t === bt ? 100 : 0;

        const scheduler = new BlockScheduler(weights);
        const party = [
          fakeCharacter({ backstory: 'A long backstory about wars and glory.' }),
          fakeCharacter2(),
          fakeCharacter3(),
        ];

        const block = scheduler.pickBlock(party, richHistory());
        expect(block.type).toBe(bt);
      });
    }
  });

  // ── Solo party (1 member) ──

  describe('Solo Party (1 member)', () => {
    const soloParty = [fakeCharacter({ backstory: 'Has backstory.' })];

    it('never produces multi-character blocks', () => {
      const scheduler = new BlockScheduler();
      const counts = scheduler.simulate(500, soloParty, richHistory());
      expect(counts.quip_banter).toBe(0);
      expect(counts.hype_chain).toBe(0);
    });

    it('still produces solo_observation, emotional_reaction, question, silence', () => {
      const scheduler = new BlockScheduler();
      const counts = scheduler.simulate(1000, soloParty, richHistory());
      expect(counts.solo_observation).toBeGreaterThan(0);
      expect(counts.emotional_reaction).toBeGreaterThan(0);
      expect(counts.question).toBeGreaterThan(0);
      expect(counts.silence).toBeGreaterThan(0);
    });

    it('produces backstory_reference when character has backstory', () => {
      const scheduler = new BlockScheduler({ backstory_reference: 100, solo_observation: 0, emotional_reaction: 0, question: 0, quip_banter: 0, callback: 0, hype_chain: 0, silence: 0 });
      const block = scheduler.pickBlock(soloParty, emptyHistory());
      expect(block.type).toBe('backstory_reference');
    });

    it('produces callback when history is rich enough', () => {
      const scheduler = new BlockScheduler({ callback: 100, solo_observation: 0, emotional_reaction: 0, question: 0, backstory_reference: 0, quip_banter: 0, hype_chain: 0, silence: 0 });
      const block = scheduler.pickBlock(soloParty, richHistory());
      expect(block.type).toBe('callback');
    });
  });

  // ── Duo party (2 members) ──

  describe('Duo Party (2 members)', () => {
    const duoParty = [fakeCharacter(), fakeCharacter2()];

    it('produces quip_banter with 2 participants', () => {
      const scheduler = new BlockScheduler({ quip_banter: 100, solo_observation: 0, emotional_reaction: 0, question: 0, backstory_reference: 0, callback: 0, hype_chain: 0, silence: 0 });
      const block = scheduler.pickBlock(duoParty, richHistory());
      expect(block.type).toBe('quip_banter');
      expect(block.participants?.length).toBe(2);
    });

    it('produces hype_chain with 2 participants', () => {
      const scheduler = new BlockScheduler({ hype_chain: 100, solo_observation: 0, emotional_reaction: 0, question: 0, backstory_reference: 0, quip_banter: 0, callback: 0, silence: 0 });
      const block = scheduler.pickBlock(duoParty, emptyHistory());
      expect(block.type).toBe('hype_chain');
      expect(block.participants?.length).toBe(2);
    });
  });

  // ── Trio party (3 members) ──

  describe('Trio Party (3 members)', () => {
    const trioParty = [fakeCharacter(), fakeCharacter2(), fakeCharacter3()];

    it('hype_chain includes all 3 participants', () => {
      const scheduler = new BlockScheduler({ hype_chain: 100, solo_observation: 0, emotional_reaction: 0, question: 0, backstory_reference: 0, quip_banter: 0, callback: 0, silence: 0 });
      const block = scheduler.pickBlock(trioParty, emptyHistory());
      expect(block.type).toBe('hype_chain');
      expect(block.participants?.length).toBe(3);
    });

    it('simulation covers all block types with default weights', () => {
      const scheduler = new BlockScheduler();
      const counts = scheduler.simulate(5000, trioParty, richHistory());
      // With enough samples, all types should appear
      expect(counts.solo_observation).toBeGreaterThan(100);
      expect(counts.emotional_reaction).toBeGreaterThan(10);
      expect(counts.question).toBeGreaterThan(10);
      expect(counts.quip_banter).toBeGreaterThan(10);
      expect(counts.hype_chain).toBeGreaterThan(5);
      expect(counts.silence).toBeGreaterThan(10);
    });
  });

  // ── Edge cases ──

  describe('Edge Cases', () => {
    it('no backstory on any character → backstory_reference never selected', () => {
      const party = [fakeCharacter({ backstory: '' }), fakeCharacter2({ backstory: '' })];
      const scheduler = new BlockScheduler({ backstory_reference: 100, solo_observation: 1 });
      const counts = scheduler.simulate(100, party, emptyHistory());
      expect(counts.backstory_reference).toBe(0);
    });

    it('empty history → callback never selected', () => {
      const party = [fakeCharacter()];
      const scheduler = new BlockScheduler({ callback: 100, solo_observation: 1 });
      const counts = scheduler.simulate(100, party, emptyHistory());
      expect(counts.callback).toBe(0);
    });

    it('all weights zero → falls back to solo_observation', () => {
      const scheduler = new BlockScheduler(
        Object.fromEntries(Object.keys(DEFAULT_BLOCK_WEIGHTS).map((k) => [k, 0])) as any,
      );
      const party = [fakeCharacter()];
      for (let i = 0; i < 20; i++) {
        const block = scheduler.pickBlock(party, emptyHistory());
        expect(block.type).toBe('solo_observation');
      }
    });

    it('single very high weight dominates distribution', () => {
      const scheduler = new BlockScheduler({ solo_observation: 1000, silence: 1 });
      const dist = scheduler.getDistribution();
      expect(dist.solo_observation).toBeGreaterThan(0.9);
    });

    it('updateWeights mid-session changes behavior', () => {
      // Start with only solo_observation
      const allZero = Object.fromEntries(Object.keys(DEFAULT_BLOCK_WEIGHTS).map((k) => [k, 0])) as any;
      const scheduler = new BlockScheduler({ ...allZero, solo_observation: 100 });
      let counts = scheduler.simulate(100, [fakeCharacter()], emptyHistory());
      expect(counts.silence).toBe(0);
      expect(counts.solo_observation).toBe(100);

      // Switch to only silence
      scheduler.updateWeights({ solo_observation: 0, silence: 100 });
      counts = scheduler.simulate(100, [fakeCharacter()], emptyHistory());
      expect(counts.silence).toBe(100);
      expect(counts.solo_observation).toBe(0);
    });

    it('updatePrompts changes returned prompt', () => {
      const scheduler = new BlockScheduler();
      const original = scheduler.getPrompt('question');
      scheduler.updatePrompts({ question: 'CUSTOM PROMPT' });
      expect(scheduler.getPrompt('question')).toBe('CUSTOM PROMPT');
      expect(scheduler.getPrompt('question')).not.toBe(original);
    });
  });
});

// ══════════════════════════════════════════════════════════════
// MEMORY SCENARIOS
// ══════════════════════════════════════════════════════════════

describe('Memory Scenarios', () => {
  beforeEach(async () => {
    await clearCharacterMemories('char-1').catch(() => {});
    await clearCharacterMemories('char-2').catch(() => {});
    await clearCharacterMemories('char-3').catch(() => {});
  });

  // ── Happy paths ──

  describe('Happy Paths', () => {
    it('stores and retrieves memories across multiple characters', async () => {
      await addMemory({ characterId: 'char-1', type: 'game_played', content: 'Played Elden Ring', importance: 3 });
      await addMemory({ characterId: 'char-2', type: 'notable_moment', content: 'Boss kill', importance: 5 });

      const c1 = await getMemories('char-1');
      const c2 = await getMemories('char-2');
      expect(c1.length).toBe(1);
      expect(c2.length).toBe(1);
      expect(c1[0].content).toBe('Played Elden Ring');
      expect(c2[0].content).toBe('Boss kill');
    });

    it('higher importance memories come first', async () => {
      await addMemory({ characterId: 'char-1', type: 'general', content: 'Low', importance: 1 });
      await addMemory({ characterId: 'char-1', type: 'general', content: 'High', importance: 5 });
      await addMemory({ characterId: 'char-1', type: 'general', content: 'Mid', importance: 3 });

      const mems = await getMemories('char-1');
      expect(mems[0].content).toBe('High');
      expect(mems[1].content).toBe('Mid');
      expect(mems[2].content).toBe('Low');
    });

    it('formatMemoriesForPrompt creates prompt-ready strings', async () => {
      await addMemory({ characterId: 'char-1', type: 'game_played', content: 'Played League', gameName: 'League of Legends', importance: 3 });
      await addMemory({ characterId: 'char-1', type: 'player_comment', content: 'Player is aggressive', importance: 4 });

      const mems = await getMemories('char-1');
      const formatted = formatMemoriesForPrompt(mems);
      expect(formatted.length).toBe(2);
      expect(formatted.some((f) => f.includes('[League of Legends]'))).toBe(true);
      expect(formatted.some((f) => f.includes('Player is aggressive'))).toBe(true);
    });
  });

  // ── Edge cases ──

  describe('Edge Cases', () => {
    it('getMemories with limit=0 returns empty', async () => {
      await addMemory({ characterId: 'char-1', type: 'general', content: 'Test', importance: 3 });
      const mems = await getMemories('char-1', 0);
      expect(mems.length).toBe(0);
    });

    it('handles many memories efficiently (100+)', async () => {
      for (let i = 0; i < 120; i++) {
        await addMemory({ characterId: 'char-1', type: 'general', content: `Memory ${i}`, importance: (i % 5) + 1 });
      }
      const count = await getMemoryCount('char-1');
      expect(count).toBe(120);

      const top10 = await getMemories('char-1', 10);
      expect(top10.length).toBe(10);
      // All returned should be importance 5 (highest)
      expect(top10.every((m) => m.importance === 5)).toBe(true);
    });

    it('deleteMemory on non-existent id does not throw', async () => {
      await expect(deleteMemory('non-existent-id')).resolves.not.toThrow();
    });

    it('clearCharacterMemories is idempotent', async () => {
      await clearCharacterMemories('char-1');
      await clearCharacterMemories('char-1'); // second call
      expect(await getMemoryCount('char-1')).toBe(0);
    });

    it('memories preserve all types correctly', async () => {
      const types = ['game_played', 'notable_moment', 'player_comment', 'question_asked', 'general'] as const;
      for (const t of types) {
        await addMemory({ characterId: 'char-1', type: t, content: `Type: ${t}`, importance: 3 });
      }
      const mems = await getMemories('char-1');
      const storedTypes = mems.map((m) => m.type).sort();
      expect(storedTypes).toEqual([...types].sort());
    });
  });
});

// ══════════════════════════════════════════════════════════════
// PIPELINE SCENARIOS (processMulti)
// ══════════════════════════════════════════════════════════════

describe('Pipeline Scenarios', () => {
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

    vi.stubGlobal('Audio', class {
      src = '';
      onended: (() => void) | null = null;
      play() { queueMicrotask(() => this.onended?.()); return Promise.resolve(); }
    });
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} });
  });

  afterEach(() => {
    collector.destroy();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function makeRequest(overrides?: Partial<MessageRequest>): MessageRequest {
    return {
      id: 'req-1',
      character: fakeCharacter(),
      trigger: 'timed',
      ...overrides,
    };
  }

  // ── Happy paths ──

  describe('Happy Paths', () => {
    it('single character process with block type and prompt', async () => {
      vi.stubGlobal('fetch', createMockFetch(new Map([
        ['generate-commentary', { body: { text: 'Emotional response!', usage: { input_tokens: 40, output_tokens: 12 } } }],
        ['generative-tts', { status: 200, body: new Blob(['audio']), text: '' }],
      ])));

      const result = await pipeline.process(makeRequest({
        blockType: 'emotional_reaction',
        blockPrompt: 'Express pure emotion!',
      }));

      expect(result.text).toBe('Emotional response!');
      const chatMsgs = collector.getEvents('chat-message');
      expect(chatMsgs.length).toBe(1);
    });

    it('process with memories injects them into request body', async () => {
      let capturedBody: Record<string, unknown> = {};
      vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
        if (url.includes('generate-commentary')) {
          capturedBody = JSON.parse(init.body as string);
          return {
            ok: true,
            status: 200,
            json: async () => ({ text: 'I remember this!', usage: { input_tokens: 60, output_tokens: 15 } }),
            text: async () => '',
          };
        }
        return { ok: true, status: 200, blob: async () => new Blob(['audio']), text: async () => '' };
      }));

      await pipeline.process(makeRequest({
        memories: ['Player rushes in without thinking', 'Played Elden Ring last time'],
        blockType: 'callback',
      }));

      expect(capturedBody.memories).toEqual(['Player rushes in without thinking', 'Played Elden Ring last time']);
      expect(capturedBody.block_type).toBe('callback');
    });

    it('processMulti with quip_banter — 2 characters exchange lines', async () => {
      vi.stubGlobal('fetch', createMockFetch(new Map([
        ['generate-commentary', {
          body: {
            lines: [
              { character: 'TestChar', line: 'That was bold!' },
              { character: 'ReactorBot', line: 'Bold? That was stupid.' },
            ],
            text: '...',
            usage: { input_tokens: 100, output_tokens: 40 },
          },
        }],
      ])));

      const result = await pipeline.processMulti(makeRequest({
        participants: [fakeCharacter(), fakeCharacter2()],
        blockType: 'quip_banter',
        blockPrompt: 'Exchange about the play.',
      }));

      expect(result.lines.length).toBe(2);
      expect(result.lines[0].characterName).toBe('TestChar');
      expect(result.lines[1].characterName).toBe('ReactorBot');

      // Each line gets its own overlay show/dismiss
      expect(collector.getEvents('overlay-show').length).toBe(2);
      expect(collector.getEvents('overlay-dismiss').length).toBe(2);
    });

    it('processMulti with hype_chain — 3 characters get one line each', async () => {
      vi.stubGlobal('fetch', createMockFetch(new Map([
        ['generate-commentary', {
          body: {
            lines: [
              { character: 'TestChar', line: 'WHAT!' },
              { character: 'ReactorBot', line: 'NO WAY!' },
              { character: 'ThirdWheel', line: 'INCREDIBLE!' },
            ],
            text: '...',
            usage: { input_tokens: 120, output_tokens: 30 },
          },
        }],
      ])));

      const result = await pipeline.processMulti(makeRequest({
        participants: [fakeCharacter(), fakeCharacter2(), fakeCharacter3()],
        blockType: 'hype_chain',
      }));

      expect(result.lines.length).toBe(3);
      expect(mockTts.calls.length).toBe(3);
    });
  });

  // ── Error cases ──

  describe('Error Cases', () => {
    it('LLM returns 500 — pipeline emits error, returns empty', async () => {
      vi.stubGlobal('fetch', createMockFetch(new Map([
        ['generate-commentary', { status: 500, body: { error: 'Internal error' }, text: 'Server error' }],
      ])));

      const result = await pipeline.process(makeRequest());

      expect(result.text).toBe('');
      expect(collector.getEvents('pipeline:llm-error').length).toBe(1);
    });

    it('LLM returns 401 (unauthorized) — pipeline emits error', async () => {
      vi.stubGlobal('fetch', createMockFetch(new Map([
        ['generate-commentary', { status: 401, body: { error: 'Unauthorized' }, text: 'Unauthorized' }],
      ])));

      const result = await pipeline.process(makeRequest());

      expect(result.text).toBe('');
      const errors = collector.getEvents('pipeline:llm-error');
      expect(errors.length).toBe(1);
    });

    it('auth session is null — returns empty with error', async () => {
      const { getSession } = await import('@glazebot/supabase-client');
      (getSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const result = await pipeline.process(makeRequest());

      expect(result.text).toBe('');
      expect(collector.getEvents('pipeline:llm-error').length).toBe(1);
    });

    it('processMulti with malformed JSON response — falls back to single character', async () => {
      vi.stubGlobal('fetch', createMockFetch(new Map([
        ['generate-commentary', {
          body: { text: 'This is not valid JSON lines, just plain text.', usage: { input_tokens: 50, output_tokens: 20 } },
        }],
      ])));

      const result = await pipeline.processMulti(makeRequest({
        participants: [fakeCharacter(), fakeCharacter2()],
        blockType: 'quip_banter',
      }));

      // Falls back: attributes entire response to primary character
      expect(result.lines.length).toBe(1);
      expect(result.lines[0].characterName).toBe('TestChar');
    });

    it('TTS fails during processMulti — overlay still dismisses', async () => {
      vi.stubGlobal('fetch', createMockFetch(new Map([
        ['generate-commentary', {
          body: {
            lines: [{ character: 'TestChar', line: 'Test line' }],
            text: '...',
            usage: { input_tokens: 40, output_tokens: 10 },
          },
        }],
      ])));
      mockTts.shouldFail = true;

      // processMulti should not throw even when TTS fails
      try {
        await pipeline.processMulti(makeRequest({
          participants: [fakeCharacter(), fakeCharacter2()],
          blockType: 'quip_banter',
        }));
      } catch {
        // TTS error may propagate, that's OK
      }

      // Overlay dismiss should still fire (try/finally guarantee)
      expect(collector.getEvents('overlay-dismiss').length).toBeGreaterThanOrEqual(1);
    });

    it('processMulti with empty response — returns empty lines', async () => {
      vi.stubGlobal('fetch', createMockFetch(new Map([
        ['generate-commentary', {
          body: { text: '', usage: { input_tokens: 20, output_tokens: 0 } },
        }],
      ])));

      const result = await pipeline.processMulti(makeRequest({
        participants: [fakeCharacter(), fakeCharacter2()],
        blockType: 'quip_banter',
      }));

      expect(result.lines.length).toBe(0);
      expect(collector.getEvents('pipeline:silence').length).toBe(1);
    });
  });

  // ── Party size variations ──

  describe('Party Size Variations', () => {
    it('processMulti with 1 participant falls back to process()', async () => {
      vi.stubGlobal('fetch', createMockFetch(new Map([
        ['generate-commentary', { body: { text: 'Solo fallback', usage: { input_tokens: 30, output_tokens: 8 } } }],
        ['generative-tts', { status: 200, body: new Blob(['audio']), text: '' }],
      ])));

      const result = await pipeline.processMulti(makeRequest({
        participants: [fakeCharacter()],
        blockType: 'quip_banter',
      }));

      expect(result.lines.length).toBe(1);
      expect(result.lines[0].text).toBe('Solo fallback');
    });

    it('processMulti with undefined participants falls back to process()', async () => {
      vi.stubGlobal('fetch', createMockFetch(new Map([
        ['generate-commentary', { body: { text: 'No participants', usage: { input_tokens: 30, output_tokens: 8 } } }],
        ['generative-tts', { status: 200, body: new Blob(['audio']), text: '' }],
      ])));

      const result = await pipeline.processMulti(makeRequest({
        participants: undefined,
        blockType: 'quip_banter',
      }));

      expect(result.lines.length).toBe(1);
      expect(result.lines[0].text).toBe('No participants');
    });
  });
});

// ══════════════════════════════════════════════════════════════
// INTEGRATION SCENARIOS (Scheduler + Memory + Pipeline wired)
// ══════════════════════════════════════════════════════════════

describe('Integration Scenarios', () => {
  beforeEach(async () => {
    await clearCharacterMemories('char-1').catch(() => {});
    await clearCharacterMemories('char-2').catch(() => {});
  });

  it('memories stored for one character do not leak to another', async () => {
    await addMemory({ characterId: 'char-1', type: 'game_played', content: 'Char 1 only', importance: 5 });
    await addMemory({ characterId: 'char-2', type: 'game_played', content: 'Char 2 only', importance: 5 });

    const c1Mems = await getMemories('char-1');
    const c2Mems = await getMemories('char-2');

    expect(c1Mems.length).toBe(1);
    expect(c1Mems[0].content).toBe('Char 1 only');
    expect(c2Mems.length).toBe(1);
    expect(c2Mems[0].content).toBe('Char 2 only');
  });

  it('scheduler adapts when backstory is added to character mid-session', () => {
    const charNoBackstory = fakeCharacter({ backstory: '' });
    const scheduler = new BlockScheduler({ backstory_reference: 100, solo_observation: 1 });

    // No backstory → cannot select backstory_reference
    let block = scheduler.pickBlock([charNoBackstory], new Map());
    expect(block.type).not.toBe('backstory_reference');

    // Add backstory → now can select backstory_reference
    const charWithBackstory = fakeCharacter({ backstory: 'Now has a story!' });
    block = scheduler.pickBlock([charWithBackstory], new Map());
    expect(block.type).toBe('backstory_reference');
  });

  it('scheduler handles growing history — callback becomes available after 3 turns', () => {
    const scheduler = new BlockScheduler({ callback: 100, solo_observation: 1 });
    const party = [fakeCharacter()];

    // 0 turns
    let block = scheduler.pickBlock(party, new Map());
    expect(block.type).not.toBe('callback');

    // 2 turns (not enough)
    const h2 = new Map<string, HistoryEntry[]>();
    h2.set('char-1', [
      { role: 'user', content: 'a' }, { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' }, { role: 'assistant', content: 'd' },
    ]);
    block = scheduler.pickBlock(party, h2);
    expect(block.type).not.toBe('callback');

    // 3 turns (enough)
    const h3 = new Map<string, HistoryEntry[]>();
    h3.set('char-1', [
      { role: 'user', content: 'a' }, { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' }, { role: 'assistant', content: 'd' },
      { role: 'user', content: 'e' }, { role: 'assistant', content: 'f' },
    ]);
    block = scheduler.pickBlock(party, h3);
    expect(block.type).toBe('callback');
  });

  it('memory count stays bounded when using getMemories with limit', async () => {
    for (let i = 0; i < 50; i++) {
      await addMemory({ characterId: 'char-1', type: 'general', content: `Mem ${i}`, importance: 3 });
    }

    const limited = await getMemories('char-1', 5);
    expect(limited.length).toBe(5);

    const all = await getMemories('char-1', 10000);
    expect(all.length).toBe(50);
  });
});
