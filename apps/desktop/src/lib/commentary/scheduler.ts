import type { GachaCharacter } from '@glazebot/shared-types';
import type { BlockType, BlockWeights, BlockPrompts, ScheduledBlock, HistoryEntry } from './types';

export const DEFAULT_BLOCK_WEIGHTS: BlockWeights = {
  solo_observation: 35,
  emotional_reaction: 20,
  question: 12,
  backstory_reference: 8,
  quip_banter: 4,
  callback: 5,
  hype_chain: 2,
  silence: 14,
};

export const DEFAULT_BLOCK_PROMPTS: BlockPrompts = {
  solo_observation: 'React to what you see on screen. Be specific about ONE thing.',
  emotional_reaction: 'Express a pure emotional reaction. Don\'t describe the screen. Just FEEL it. Use emote_burst or screen_flash if it fits the moment.',
  question: 'Ask the player a question or wonder something aloud about what\'s happening.',
  backstory_reference: 'Subtly reference your own backstory or lore in the context of what you see.',
  quip_banter: 'Have a quick back-and-forth exchange with your co-caster about what just happened.',
  callback: 'Reference something from earlier in this session that connects to what\'s happening now.',
  hype_chain: 'React with rapid-fire energy to this moment. One punchy line.',
};

const BLOCK_TYPES: BlockType[] = [
  'solo_observation',
  'emotional_reaction',
  'question',
  'backstory_reference',
  'quip_banter',
  'callback',
  'hype_chain',
  'silence',
];

export class BlockScheduler {
  private weights: BlockWeights;
  private prompts: BlockPrompts;

  constructor(weights?: Partial<BlockWeights>, prompts?: Partial<BlockPrompts>) {
    this.weights = { ...DEFAULT_BLOCK_WEIGHTS, ...weights };
    this.prompts = { ...DEFAULT_BLOCK_PROMPTS, ...prompts };
  }

  pickBlock(
    party: GachaCharacter[],
    history: Map<string, HistoryEntry[]>,
  ): ScheduledBlock {
    const eligible = this.getEligibleBlocks(party, history);
    const type = this.weightedRandom(eligible);

    const primary = party[Math.floor(Math.random() * party.length)];

    if (type === 'silence') {
      return { type, primaryCharacter: primary };
    }

    if (type === 'quip_banter' || type === 'hype_chain') {
      const others = party.filter((c) => c.id !== primary.id);
      return {
        type,
        primaryCharacter: primary,
        participants: [primary, ...others],
      };
    }

    return { type, primaryCharacter: primary };
  }

  getPrompt(type: BlockType): string | undefined {
    if (type === 'silence') return undefined;
    return this.prompts[type];
  }

  getDistribution(): Record<BlockType, number> {
    const total = BLOCK_TYPES.reduce((sum, t) => sum + this.weights[t], 0);
    if (total === 0) {
      const even = 1 / BLOCK_TYPES.length;
      return Object.fromEntries(BLOCK_TYPES.map((t) => [t, even])) as Record<BlockType, number>;
    }
    return Object.fromEntries(
      BLOCK_TYPES.map((t) => [t, this.weights[t] / total]),
    ) as Record<BlockType, number>;
  }

  updateWeights(weights: Partial<BlockWeights>): void {
    this.weights = { ...this.weights, ...weights };
  }

  updatePrompts(prompts: Partial<BlockPrompts>): void {
    this.prompts = { ...this.prompts, ...prompts };
  }

  /** Simulate N ticks and return distribution counts */
  simulate(
    n: number,
    party: GachaCharacter[],
    history: Map<string, HistoryEntry[]>,
  ): Record<BlockType, number> {
    const counts = Object.fromEntries(BLOCK_TYPES.map((t) => [t, 0])) as Record<BlockType, number>;
    for (let i = 0; i < n; i++) {
      const block = this.pickBlock(party, history);
      counts[block.type]++;
    }
    return counts;
  }

  // ── Private ────────────────────────────────────────────────────

  private getEligibleBlocks(
    party: GachaCharacter[],
    history: Map<string, HistoryEntry[]>,
  ): BlockType[] {
    const eligible: BlockType[] = [];

    for (const type of BLOCK_TYPES) {
      if (this.weights[type] <= 0) continue;

      // quip_banter and hype_chain need 2+ party members
      if ((type === 'quip_banter' || type === 'hype_chain') && party.length < 2) continue;

      // callback needs 3+ history turns across any character
      if (type === 'callback') {
        const totalTurns = Array.from(history.values())
          .reduce((sum, h) => sum + Math.floor(h.length / 2), 0);
        if (totalTurns < 3) continue;
      }

      // backstory_reference needs at least one character with backstory
      if (type === 'backstory_reference') {
        const hasBackstory = party.some((c) => c.backstory && c.backstory.trim().length > 0);
        if (!hasBackstory) continue;
      }

      eligible.push(type);
    }

    // Fallback: always allow solo_observation
    if (eligible.length === 0) {
      eligible.push('solo_observation');
    }

    return eligible;
  }

  private weightedRandom(eligible: BlockType[]): BlockType {
    const weights = eligible.map((t) => this.weights[t]);
    const total = weights.reduce((a, b) => a + b, 0);

    if (total === 0) {
      return eligible[Math.floor(Math.random() * eligible.length)];
    }

    let roll = Math.random() * total;
    for (let i = 0; i < eligible.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return eligible[i];
    }

    return eligible[eligible.length - 1];
  }
}
