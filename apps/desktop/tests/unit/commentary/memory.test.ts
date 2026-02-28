import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  addMemory,
  getMemories,
  deleteMemory,
  clearCharacterMemories,
  getMemoryCount,
  formatMemoriesForPrompt,
  type CharacterMemory,
} from '$lib/stores/characterMemory';

describe('Character Memory Store', () => {
  beforeEach(async () => {
    // Clear all memories between tests
    // We clear by deleting all for known test character IDs
    await clearCharacterMemories('char-1').catch(() => {});
    await clearCharacterMemories('char-2').catch(() => {});
  });

  // ── addMemory ──

  it('adds a memory and returns it with id and createdAt', async () => {
    const mem = await addMemory({
      characterId: 'char-1',
      type: 'notable_moment',
      content: 'The player pulled off an amazing combo.',
      importance: 4,
    });

    expect(mem.id).toBeDefined();
    expect(mem.createdAt).toBeDefined();
    expect(mem.characterId).toBe('char-1');
    expect(mem.content).toBe('The player pulled off an amazing combo.');
    expect(mem.importance).toBe(4);
  });

  it('adds a memory with gameName', async () => {
    const mem = await addMemory({
      characterId: 'char-1',
      type: 'game_played',
      content: 'Played a round of Elden Ring.',
      gameName: 'Elden Ring',
      importance: 3,
    });

    expect(mem.gameName).toBe('Elden Ring');
  });

  // ── getMemories ──

  it('returns memories sorted by importance then recency', async () => {
    await addMemory({ characterId: 'char-1', type: 'general', content: 'Low importance', importance: 1 });
    await addMemory({ characterId: 'char-1', type: 'general', content: 'High importance', importance: 5 });
    await addMemory({ characterId: 'char-1', type: 'general', content: 'Medium importance', importance: 3 });

    const memories = await getMemories('char-1');
    expect(memories[0].importance).toBe(5);
    expect(memories[1].importance).toBe(3);
    expect(memories[2].importance).toBe(1);
  });

  it('respects limit parameter', async () => {
    for (let i = 0; i < 10; i++) {
      await addMemory({ characterId: 'char-1', type: 'general', content: `Memory ${i}`, importance: i % 5 + 1 });
    }

    const limited = await getMemories('char-1', 3);
    expect(limited.length).toBe(3);
  });

  it('returns empty array for unknown character', async () => {
    const memories = await getMemories('nonexistent');
    expect(memories).toEqual([]);
  });

  it('only returns memories for the requested character', async () => {
    await addMemory({ characterId: 'char-1', type: 'general', content: 'Char 1 memory', importance: 3 });
    await addMemory({ characterId: 'char-2', type: 'general', content: 'Char 2 memory', importance: 3 });

    const char1Mems = await getMemories('char-1');
    expect(char1Mems.length).toBe(1);
    expect(char1Mems[0].content).toBe('Char 1 memory');
  });

  // ── deleteMemory ──

  it('deletes a specific memory by id', async () => {
    const mem = await addMemory({ characterId: 'char-1', type: 'general', content: 'To delete', importance: 2 });
    await addMemory({ characterId: 'char-1', type: 'general', content: 'To keep', importance: 3 });

    await deleteMemory(mem.id);

    const remaining = await getMemories('char-1');
    expect(remaining.length).toBe(1);
    expect(remaining[0].content).toBe('To keep');
  });

  // ── clearCharacterMemories ──

  it('clears all memories for a character', async () => {
    await addMemory({ characterId: 'char-1', type: 'general', content: 'Mem 1', importance: 1 });
    await addMemory({ characterId: 'char-1', type: 'general', content: 'Mem 2', importance: 2 });
    await addMemory({ characterId: 'char-2', type: 'general', content: 'Other char', importance: 3 });

    await clearCharacterMemories('char-1');

    expect(await getMemoryCount('char-1')).toBe(0);
    expect(await getMemoryCount('char-2')).toBe(1);
  });

  it('does not error when clearing memories for character with no memories', async () => {
    await expect(clearCharacterMemories('nonexistent')).resolves.not.toThrow();
  });

  // ── getMemoryCount ──

  it('returns correct count', async () => {
    expect(await getMemoryCount('char-1')).toBe(0);

    await addMemory({ characterId: 'char-1', type: 'general', content: 'Mem 1', importance: 1 });
    await addMemory({ characterId: 'char-1', type: 'general', content: 'Mem 2', importance: 2 });

    expect(await getMemoryCount('char-1')).toBe(2);
  });

  // ── formatMemoriesForPrompt ──

  it('formats memories without game name', () => {
    const memories: CharacterMemory[] = [
      { id: '1', characterId: 'char-1', type: 'general', content: 'Player rushes in without thinking', importance: 3, createdAt: new Date().toISOString() },
    ];
    const formatted = formatMemoriesForPrompt(memories);
    expect(formatted).toEqual(['Player rushes in without thinking']);
  });

  it('formats memories with game name prefix', () => {
    const memories: CharacterMemory[] = [
      { id: '1', characterId: 'char-1', type: 'game_played', content: 'Player grinded upgrades for hours', gameName: 'Wood Upgrades', importance: 4, createdAt: new Date().toISOString() },
    ];
    const formatted = formatMemoriesForPrompt(memories);
    expect(formatted).toEqual(['[Wood Upgrades] Player grinded upgrades for hours']);
  });

  it('formats empty array', () => {
    expect(formatMemoriesForPrompt([])).toEqual([]);
  });

  it('formats multiple memories', () => {
    const memories: CharacterMemory[] = [
      { id: '1', characterId: 'char-1', type: 'notable_moment', content: 'Epic boss kill', importance: 5, createdAt: new Date().toISOString() },
      { id: '2', characterId: 'char-1', type: 'player_comment', content: 'Asked about backstory', gameName: 'Elden Ring', importance: 3, createdAt: new Date().toISOString() },
    ];
    const formatted = formatMemoriesForPrompt(memories);
    expect(formatted.length).toBe(2);
    expect(formatted[0]).toBe('Epic boss kill');
    expect(formatted[1]).toBe('[Elden Ring] Asked about backstory');
  });
});
