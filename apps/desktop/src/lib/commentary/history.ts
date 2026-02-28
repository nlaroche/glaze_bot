import type { HistoryEntry } from './types';

const MAX_HISTORY = 10; // 10 turns = 20 messages

export class ConversationHistory {
  private histories = new Map<string, HistoryEntry[]>();

  get(characterId: string): HistoryEntry[] {
    return this.histories.get(characterId) ?? [];
  }

  append(
    characterId: string,
    userContent: string,
    assistantContent: string,
  ): void {
    const history = this.histories.get(characterId) ?? [];
    history.push({ role: 'user', content: userContent });
    history.push({ role: 'assistant', content: assistantContent });
    while (history.length > MAX_HISTORY * 2) {
      history.shift();
      history.shift();
    }
    this.histories.set(characterId, history);
  }

  getAll(): Map<string, HistoryEntry[]> {
    return this.histories;
  }

  clear(): void {
    this.histories.clear();
  }
}
