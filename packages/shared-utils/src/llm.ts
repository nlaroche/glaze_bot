import type { Character, ChatMessage, Personality } from "@glazebot/shared-types";

/** Random style nudges injected each call to force variety (ported from brain.py) */
const STYLE_NUDGES = [
  "Describe ONE specific thing you see on screen and react to that, not the vibe.",
  "Reference a specific movie, show, or meme that this moment reminds you of.",
  "Make a bold prediction about what will happen in the next 30 seconds.",
  "Roast the player's decision-making with love. Be specific about what they did wrong.",
  "Compare what just happened to something completely unrelated and absurd.",
  "React as if this is the single greatest or worst moment in gaming history.",
  "Ask a rhetorical question that highlights the absurdity of the situation.",
  "Give a backhanded compliment about the play you just witnessed.",
  "Narrate this moment as if it is the climax of a documentary about the player.",
  "Pick one object or character on screen and fixate on it for your whole response.",
  "React to the player's health, gold, or resources specifically — not just the action.",
  "Say something that would make sense as commentary on a nature documentary.",
  "Imagine you are commentating this for someone who cannot see the screen.",
  "Pretend this exact moment will be in a montage, describe why.",
  "React to the PACE of what is happening — is it frantic, slow, building tension?",
  "Notice something small or in the background that nobody else would comment on.",
  "Express a strong opinion about something on screen that does not matter at all.",
  "Compare the player to a specific fictional character based on what they just did.",
];

/** Trait labels mapping trait name → [low description, high description] */
const TRAIT_LABELS: Record<string, [string, string]> = {
  energy: ["very calm and low-energy", "very high-energy and hyped up"],
  positivity: ["cynical and pessimistic", "optimistic and upbeat"],
  formality: ["very casual and informal", "very formal and proper"],
  talkativeness: ["terse and brief", "chatty and verbose"],
  attitude: ["hostile and aggressive", "friendly and warm"],
  humor: ["dead serious", "silly and goofy"],
};

/**
 * Build a personality modifier string from trait values.
 * Only includes non-neutral traits (those deviating from 50).
 * Ported from brain.py _build_personality_modifier.
 */
export function buildPersonalityModifier(
  personality: Personality | undefined,
): string {
  if (!personality) return "";

  const parts: string[] = [];
  for (const [trait, [lowDesc, highDesc]] of Object.entries(TRAIT_LABELS)) {
    const val = (personality as unknown as Record<string, number>)[trait] ?? 50;
    if (val < 30) {
      parts.push(`Be ${lowDesc}`);
    } else if (val < 45) {
      parts.push(`Be somewhat ${lowDesc}`);
    } else if (val > 70) {
      parts.push(`Be ${highDesc}`);
    } else if (val > 55) {
      parts.push(`Be somewhat ${highDesc}`);
    }
  }

  if (parts.length === 0) return "";
  return `\n[Personality adjustment: ${parts.join(". ")}.]`;
}

/** Pick a random style nudge */
export function pickStyleNudge(): string {
  return STYLE_NUDGES[Math.floor(Math.random() * STYLE_NUDGES.length)];
}

/** Options for building user content */
export interface UserContentOptions {
  playerText?: string;
  reactTo?: { name: string; text: string };
  gameHint?: string;
}

/**
 * Build the text prompt to accompany a screenshot.
 * Ported from brain.py _build_user_content (text portion only —
 * image attachment is provider-specific).
 */
export function buildUserPrompt(opts: UserContentOptions): string {
  const nudge = pickStyleNudge();
  const prefix = opts.gameHint ? `[Game: ${opts.gameHint}] ` : "";

  if (opts.reactTo) {
    return (
      `${prefix}${opts.reactTo.name} just said: "${opts.reactTo.text}" — ` +
      `React to what they said, agree or disagree or riff on it. ` +
      `Stay in your own character. Style hint: ${nudge}`
    );
  }

  if (opts.playerText) {
    return `${prefix}The player said: "${opts.playerText}" — respond to them. Style hint: ${nudge}`;
  }

  return `${prefix}React to what you see on screen. Style hint: ${nudge}`;
}

/**
 * Build the full system prompt for a character, including personality modifiers.
 */
export function buildSystemPrompt(character: Character): string {
  return character.system_prompt + buildPersonalityModifier(character.personality);
}

/**
 * Build a text-only summary for conversation history
 * (saves tokens by not storing image data in history).
 */
export function buildHistorySummary(opts: UserContentOptions): string {
  if (opts.reactTo) {
    return `${opts.reactTo.name} said: "${opts.reactTo.text}"`;
  }
  return opts.playerText || "(screen only)";
}

/**
 * Trim conversation history to a maximum number of exchanges.
 * Each exchange is a user + assistant message pair.
 */
export function trimHistory(
  history: ChatMessage[],
  maxExchanges: number = 10,
): ChatMessage[] {
  const maxMessages = maxExchanges * 2;
  if (history.length <= maxMessages) return history;
  return history.slice(history.length - maxMessages);
}

/**
 * Check if a response indicates silence.
 */
export function isSilence(reply: string): boolean {
  return reply.toUpperCase().includes("[SILENCE]");
}

/** Provider pricing per million tokens */
export const PROVIDER_PRICING: Record<string, { input: number; output: number }> = {
  dashscope: { input: 0.065, output: 0.52 },
  anthropic: { input: 0.80, output: 4.0 },
};

/**
 * Estimate session cost in USD.
 */
export function estimateCost(
  provider: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = PROVIDER_PRICING[provider] ?? PROVIDER_PRICING.dashscope;
  return (
    (inputTokens * pricing.input) / 1_000_000 +
    (outputTokens * pricing.output) / 1_000_000
  );
}
