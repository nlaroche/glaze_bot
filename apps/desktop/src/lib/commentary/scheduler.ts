import type { GachaCharacter } from '@glazebot/shared-types';
import { DEFAULT_TOPIC_WEIGHTS } from '@glazebot/shared-types';
import type { TopicType, TopicWeights, TopicPrompts, ScheduledTopic, HistoryEntry } from './types';

export const DEFAULT_TOPIC_PROMPTS: TopicPrompts = {
  solo_observation: 'React to what you see on screen. Be specific about ONE thing.',
  emotional_reaction: 'Express a pure emotional reaction. Don\'t describe the screen. Just FEEL it. Use emote_burst or screen_flash if it fits the moment.',
  question: 'Ask the player a question or wonder something aloud about what\'s happening.',
  backstory_reference: 'Subtly reference your own backstory or lore in the context of what you see.',
  quip_banter: 'Two characters talk TO EACH OTHER about what just happened. One reacts, the other responds — disagree, tease, or riff.',
  callback: 'Reference something from earlier in this session that connects to what\'s happening now.',
  hype_chain: 'Two characters react to the same moment — the second one responds to the first, not just the screen.',
  encouragement: 'Be emotionally supportive. Encourage the player, hype them up, or empathize if things are going badly. Be genuine, not sarcastic.',
  hot_take: 'Drop a bold, opinionated take — about the game, a mechanic, a character design, a strategy, pop culture, anything. Be confident and slightly controversial.',
  tangent: 'Something on screen reminds you of something completely unrelated. Go off on a brief tangent that reveals your personality. Don\'t force a game connection.',
};

// Backward-compat aliases
export const DEFAULT_BLOCK_WEIGHTS = DEFAULT_TOPIC_WEIGHTS;
export const DEFAULT_BLOCK_PROMPTS = DEFAULT_TOPIC_PROMPTS;

const BUILTIN_TOPIC_TYPES: TopicType[] = [
  'solo_observation',
  'emotional_reaction',
  'question',
  'backstory_reference',
  'quip_banter',
  'callback',
  'hype_chain',
  'encouragement',
  'hot_take',
  'tangent',
  'silence',
];

export class TopicScheduler {
  private weights: TopicWeights;
  private prompts: TopicPrompts;

  constructor(weights?: Partial<TopicWeights>, prompts?: Partial<TopicPrompts>) {
    this.weights = { ...DEFAULT_TOPIC_WEIGHTS, ...weights };
    this.prompts = { ...DEFAULT_TOPIC_PROMPTS, ...prompts };
  }

  pickTopic(
    party: GachaCharacter[],
    history: Map<string, HistoryEntry[]>,
  ): ScheduledTopic {
    // Pick primary character first, then use their topic_assignments if available
    const primary = party[Math.floor(Math.random() * party.length)];

    // Get effective weights: per-character assignments if present, else global
    let effectiveWeights = this.weights;
    if (primary.topic_assignments && Object.keys(primary.topic_assignments).length > 0) {
      effectiveWeights = { ...primary.topic_assignments };
      // Merge in custom_topics weights for legendary characters
      if (primary.custom_topics) {
        for (const ct of primary.custom_topics) {
          effectiveWeights[ct.key] = ct.weight;
        }
      }
    }

    const eligible = this.getEligibleTopics(party, history, effectiveWeights, primary);
    const type = this.weightedRandom(eligible, effectiveWeights);

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

  getPrompt(type: TopicType, character?: GachaCharacter): string | undefined {
    if (type === 'silence') return undefined;
    // Check character's custom_topics first (for custom keys)
    if (character?.custom_topics) {
      const custom = character.custom_topics.find((ct) => ct.key === type);
      if (custom) return custom.prompt;
    }
    return this.prompts[type];
  }

  getDistribution(): Record<string, number> {
    const types = this.getTopicKeys();
    const total = types.reduce((sum, t) => sum + (this.weights[t] ?? 0), 0);
    if (total === 0) {
      const even = 1 / types.length;
      return Object.fromEntries(types.map((t) => [t, even]));
    }
    return Object.fromEntries(
      types.map((t) => [t, (this.weights[t] ?? 0) / total]),
    );
  }

  updateWeights(weights: Partial<TopicWeights>): void {
    this.weights = { ...this.weights, ...weights };
  }

  updatePrompts(prompts: Partial<TopicPrompts>): void {
    this.prompts = { ...this.prompts, ...prompts };
  }

  /** Simulate N ticks and return distribution counts */
  simulate(
    n: number,
    party: GachaCharacter[],
    history: Map<string, HistoryEntry[]>,
  ): Record<string, number> {
    const types = this.getTopicKeys();
    const counts = Object.fromEntries(types.map((t) => [t, 0]));
    for (let i = 0; i < n; i++) {
      const topic = this.pickTopic(party, history);
      counts[topic.type] = (counts[topic.type] ?? 0) + 1;
    }
    return counts;
  }

  // ── Private ────────────────────────────────────────────────────

  private getTopicKeys(): TopicType[] {
    // Start with built-in types, then add any additional keys from weights
    const keys = new Set<TopicType>(BUILTIN_TOPIC_TYPES);
    for (const key of Object.keys(this.weights)) {
      keys.add(key);
    }
    return Array.from(keys);
  }

  private getEligibleTopics(
    party: GachaCharacter[],
    history: Map<string, HistoryEntry[]>,
    weights: TopicWeights,
    _primary: GachaCharacter,
  ): TopicType[] {
    const eligible: TopicType[] = [];

    for (const type of Object.keys(weights)) {
      if ((weights[type] ?? 0) <= 0) continue;

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

  private weightedRandom(eligible: TopicType[], weights: TopicWeights): TopicType {
    const w = eligible.map((t) => weights[t] ?? 0);
    const total = w.reduce((a, b) => a + b, 0);

    if (total === 0) {
      return eligible[Math.floor(Math.random() * eligible.length)];
    }

    let roll = Math.random() * total;
    for (let i = 0; i < eligible.length; i++) {
      roll -= w[i];
      if (roll <= 0) return eligible[i];
    }

    return eligible[eligible.length - 1];
  }
}

// Backward-compat alias
export const BlockScheduler = TopicScheduler;
