import { describe, it, expect } from 'vitest';
import { BlockScheduler, DEFAULT_BLOCK_WEIGHTS, DEFAULT_BLOCK_PROMPTS } from '$lib/commentary/scheduler';
import { fakeCharacter, fakeCharacter2, fakeCharacter3 } from '../../helpers/fixtures';
import type { HistoryEntry } from '$lib/commentary/types';

function emptyHistory(): Map<string, HistoryEntry[]> {
  return new Map();
}

function richHistory(): Map<string, HistoryEntry[]> {
  const h = new Map<string, HistoryEntry[]>();
  h.set('char-1', [
    { role: 'user', content: '(screen only)' },
    { role: 'assistant', content: 'Nice move!' },
    { role: 'user', content: '(screen only)' },
    { role: 'assistant', content: 'That was close!' },
    { role: 'user', content: '(screen only)' },
    { role: 'assistant', content: 'Watch out!' },
  ]);
  return h;
}

describe('BlockScheduler', () => {
  // ── Constructor & Defaults ──

  it('uses default weights when none provided', () => {
    const scheduler = new BlockScheduler();
    const dist = scheduler.getDistribution();
    const total = Object.values(DEFAULT_BLOCK_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(dist.solo_observation).toBeCloseTo(DEFAULT_BLOCK_WEIGHTS.solo_observation / total);
  });

  it('accepts custom weights', () => {
    const scheduler = new BlockScheduler({ solo_observation: 100, silence: 0 });
    const dist = scheduler.getDistribution();
    expect(dist.solo_observation).toBeGreaterThan(0.5);
  });

  it('accepts custom prompts', () => {
    const scheduler = new BlockScheduler(undefined, { question: 'Custom question prompt' });
    expect(scheduler.getPrompt('question')).toBe('Custom question prompt');
  });

  // ── pickBlock basic behavior ──

  it('always returns a valid block type', () => {
    const scheduler = new BlockScheduler();
    const party = [fakeCharacter(), fakeCharacter2()];

    for (let i = 0; i < 50; i++) {
      const block = scheduler.pickBlock(party, emptyHistory());
      expect(block.type).toBeDefined();
      expect(block.primaryCharacter).toBeDefined();
    }
  });

  it('returns silence blocks (no participants)', () => {
    const scheduler = new BlockScheduler({ silence: 100, solo_observation: 0, emotional_reaction: 0, question: 0, backstory_reference: 0, quip_banter: 0, callback: 0, hype_chain: 0 });
    const party = [fakeCharacter()];
    const block = scheduler.pickBlock(party, emptyHistory());
    expect(block.type).toBe('silence');
    expect(block.participants).toBeUndefined();
  });

  // ── Solo party (1 member) ──

  it('never picks quip_banter or hype_chain with solo party', () => {
    const scheduler = new BlockScheduler({ quip_banter: 100, hype_chain: 100, solo_observation: 1 });
    const party = [fakeCharacter()];

    for (let i = 0; i < 100; i++) {
      const block = scheduler.pickBlock(party, emptyHistory());
      expect(block.type).not.toBe('quip_banter');
      expect(block.type).not.toBe('hype_chain');
    }
  });

  // ── Multi-party ──

  it('picks quip_banter with 2+ party members and includes participants', () => {
    const scheduler = new BlockScheduler({ quip_banter: 100, solo_observation: 0, emotional_reaction: 0, question: 0, backstory_reference: 0, callback: 0, hype_chain: 0, silence: 0 });
    const party = [fakeCharacter(), fakeCharacter2()];
    const block = scheduler.pickBlock(party, richHistory());
    expect(block.type).toBe('quip_banter');
    expect(block.participants).toBeDefined();
    expect(block.participants!.length).toBe(2);
  });

  it('picks hype_chain with 3 party members', () => {
    const scheduler = new BlockScheduler({ hype_chain: 100, solo_observation: 0, emotional_reaction: 0, question: 0, backstory_reference: 0, quip_banter: 0, callback: 0, silence: 0 });
    const party = [fakeCharacter(), fakeCharacter2(), fakeCharacter3()];
    const block = scheduler.pickBlock(party, emptyHistory());
    expect(block.type).toBe('hype_chain');
    expect(block.participants!.length).toBe(3);
  });

  // ── Callback requires history ──

  it('never picks callback with empty history', () => {
    const scheduler = new BlockScheduler({ callback: 100, solo_observation: 1 });
    const party = [fakeCharacter()];

    for (let i = 0; i < 50; i++) {
      const block = scheduler.pickBlock(party, emptyHistory());
      expect(block.type).not.toBe('callback');
    }
  });

  it('picks callback when enough history exists', () => {
    const scheduler = new BlockScheduler({ callback: 100, solo_observation: 0, emotional_reaction: 0, question: 0, backstory_reference: 0, quip_banter: 0, hype_chain: 0, silence: 0 });
    const party = [fakeCharacter()];
    const block = scheduler.pickBlock(party, richHistory());
    expect(block.type).toBe('callback');
  });

  // ── Backstory requires character backstory ──

  it('never picks backstory_reference when no character has backstory', () => {
    const scheduler = new BlockScheduler({ backstory_reference: 100, solo_observation: 1 });
    const party = [fakeCharacter({ backstory: '' }), fakeCharacter2({ backstory: '' })];

    for (let i = 0; i < 50; i++) {
      const block = scheduler.pickBlock(party, emptyHistory());
      expect(block.type).not.toBe('backstory_reference');
    }
  });

  it('picks backstory_reference when a character has backstory', () => {
    const scheduler = new BlockScheduler({ backstory_reference: 100, solo_observation: 0, emotional_reaction: 0, question: 0, quip_banter: 0, callback: 0, hype_chain: 0, silence: 0 });
    const party = [fakeCharacter({ backstory: 'A brave warrior from the old wars.' })];
    const block = scheduler.pickBlock(party, emptyHistory());
    expect(block.type).toBe('backstory_reference');
  });

  // ── getPrompt ──

  it('returns undefined for silence blocks', () => {
    const scheduler = new BlockScheduler();
    expect(scheduler.getPrompt('silence')).toBeUndefined();
  });

  it('returns prompts for non-silence blocks', () => {
    const scheduler = new BlockScheduler();
    expect(scheduler.getPrompt('solo_observation')).toBe(DEFAULT_BLOCK_PROMPTS.solo_observation);
    expect(scheduler.getPrompt('emotional_reaction')).toBe(DEFAULT_BLOCK_PROMPTS.emotional_reaction);
  });

  // ── getDistribution ──

  it('returns normalized probabilities that sum to 1', () => {
    const scheduler = new BlockScheduler();
    const dist = scheduler.getDistribution();
    const sum = Object.values(dist).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1);
  });

  it('handles all-zero weights gracefully', () => {
    const scheduler = new BlockScheduler({ solo_observation: 0, emotional_reaction: 0, question: 0, backstory_reference: 0, quip_banter: 0, callback: 0, hype_chain: 0, silence: 0 });
    const dist = scheduler.getDistribution();
    const sum = Object.values(dist).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1);
  });

  // ── updateWeights / updatePrompts ──

  it('updateWeights changes distribution', () => {
    const scheduler = new BlockScheduler();
    scheduler.updateWeights({ solo_observation: 0, silence: 100 });
    const dist = scheduler.getDistribution();
    expect(dist.silence).toBeGreaterThan(0.5);
    expect(dist.solo_observation).toBe(0);
  });

  it('updatePrompts changes prompt text', () => {
    const scheduler = new BlockScheduler();
    scheduler.updatePrompts({ question: 'New question prompt!' });
    expect(scheduler.getPrompt('question')).toBe('New question prompt!');
  });

  // ── simulate ──

  it('simulate returns counts for all block types', () => {
    const scheduler = new BlockScheduler();
    const party = [fakeCharacter(), fakeCharacter2()];
    const counts = scheduler.simulate(1000, party, richHistory());

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(1000);

    // solo_observation should be the most common (weight 30)
    expect(counts.solo_observation).toBeGreaterThan(100);
  });

  it('simulate with solo party never produces multi-character blocks', () => {
    const scheduler = new BlockScheduler();
    const party = [fakeCharacter()];
    const counts = scheduler.simulate(500, party, emptyHistory());

    expect(counts.quip_banter).toBe(0);
    expect(counts.hype_chain).toBe(0);
  });

  // ── Edge case: all weights zero, falls back to solo_observation ──

  it('falls back to solo_observation when all weights are zero', () => {
    const scheduler = new BlockScheduler({ solo_observation: 0, emotional_reaction: 0, question: 0, backstory_reference: 0, quip_banter: 0, callback: 0, hype_chain: 0, silence: 0 });
    const party = [fakeCharacter()];
    const block = scheduler.pickBlock(party, emptyHistory());
    expect(block.type).toBe('solo_observation');
  });
});
