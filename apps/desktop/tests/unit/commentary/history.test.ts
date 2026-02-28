import { describe, it, expect } from 'vitest';
import { ConversationHistory } from '$lib/commentary/history';

describe('ConversationHistory', () => {
  it('get() returns empty array for unknown character', () => {
    const history = new ConversationHistory();
    expect(history.get('unknown-id')).toEqual([]);
  });

  it('append() stores user + assistant pair', () => {
    const history = new ConversationHistory();
    history.append('char-1', 'Hello', 'Hi there!');

    const entries = history.get('char-1');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ role: 'user', content: 'Hello' });
    expect(entries[1]).toEqual({ role: 'assistant', content: 'Hi there!' });
  });

  it('history caps at MAX_HISTORY * 2 entries (10 turns = 20 messages)', () => {
    const history = new ConversationHistory();

    // Add 12 turns (24 messages) — should cap at 20
    for (let i = 0; i < 12; i++) {
      history.append('char-1', `User msg ${i}`, `Assistant msg ${i}`);
    }

    const entries = history.get('char-1');
    expect(entries).toHaveLength(20);
    // First 2 turns (4 messages) should have been trimmed
    expect(entries[0].content).toBe('User msg 2');
    expect(entries[1].content).toBe('Assistant msg 2');
    // Last entry should be the most recent
    expect(entries[entries.length - 1].content).toBe('Assistant msg 11');
  });

  it('clear() wipes all characters', () => {
    const history = new ConversationHistory();
    history.append('char-1', 'Hello', 'Hi');
    history.append('char-2', 'Yo', 'Sup');

    history.clear();

    expect(history.get('char-1')).toEqual([]);
    expect(history.get('char-2')).toEqual([]);
  });

  it('multiple characters maintain separate histories', () => {
    const history = new ConversationHistory();
    history.append('char-1', 'Hello', 'Hi');
    history.append('char-2', 'Yo', 'Sup');

    const entries1 = history.get('char-1');
    const entries2 = history.get('char-2');

    expect(entries1).toHaveLength(2);
    expect(entries2).toHaveLength(2);
    expect(entries1[0].content).toBe('Hello');
    expect(entries2[0].content).toBe('Yo');
  });
});
