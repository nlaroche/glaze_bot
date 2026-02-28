// ─── GlazeBot Config Schema ─────────────────────────────────────────
// Typed shape for the gacha_config.config JSONB column.
// DEFAULT_CONFIG provides sensible defaults and doubles as the schema
// for validateConfig() — any key in DEFAULT_CONFIG is required.

export interface TokenPoolConfig {
  label: string;
  description: string;
  entries: { value: string; weight: number }[];
  conditionalOn?: { pool: string; values: string[] };
}

export interface ContextConfig {
  provider: string;
  model: string;
  prompt: string;
  maxTokens: number;
  interval: number;
  bufferSize: number;
}

export interface MemoryConfig {
  enabled: boolean;
  extractionIntervalMinutes: number;
  maxMemoriesPerCharacter: number;
  memoriesPerPrompt: number;
  extractionPrompt: string;
}

export interface CommentaryConfig {
  visionProvider: string;
  visionModel: string;
  directive: string;
  maxTokens: number;
  temperature: number;
  presencePenalty: number;
  frequencyPenalty: number;
  styleNudges: string[];
  responseInstruction: string;
  interactionInstruction: string;
  context: ContextConfig;
  blockWeights: Record<string, number>;
  blockPrompts: Record<string, string>;
  memory: MemoryConfig;
}

export interface GlazeBotConfig {
  // Character generation
  dropRates: { common: number; rare: number; epic: number; legendary: number };
  baseTemperature: number;
  model: string;
  cardGenProvider: string;
  cardGenModel: string;
  packsPerDay: number;
  cardsPerPack: number;
  generationPrompt: string;
  imageSystemInfo: string;
  imageProvider: "pixellab" | "gemini";
  imageModel: string;
  imageConfig: { imageSize: string; aspectRatio: string };

  // Token pools
  tokenPools: Record<string, TokenPoolConfig>;

  // Rarity tuning (pass-through, no UI yet)
  traitRanges?: Record<string, { min: number; max: number }>;
  promptQuality?: Record<string, { maxTokens: number; tempBoost: number }>;
  rarityGuidance?: Record<string, string>;

  // Commentary
  commentary: CommentaryConfig;
}

// ─── Default Config ────────────────────────────────────────────────
// Used as both a fallback and as the schema source for validateConfig().

export const DEFAULT_CONFIG: GlazeBotConfig = {
  dropRates: { common: 0.6, rare: 0.25, epic: 0.12, legendary: 0.03 },
  baseTemperature: 0.9,
  model: "qwen-plus",
  cardGenProvider: "dashscope",
  cardGenModel: "qwen-plus",
  packsPerDay: 3,
  cardsPerPack: 3,
  generationPrompt: "",
  imageSystemInfo:
    "facing south, sitting at a table, 128x128 pixel art sprite, no background",
  imageProvider: "pixellab",
  imageModel: "gemini-2.0-flash-preview-image-generation",
  imageConfig: { imageSize: "1024x1024", aspectRatio: "1:1" },
  tokenPools: {},
  commentary: {
    visionProvider: "dashscope",
    visionModel: "qwen3-vl-flash",
    directive: "",
    maxTokens: 80,
    temperature: 0.9,
    presencePenalty: 1.5,
    frequencyPenalty: 0.8,
    styleNudges: [],
    responseInstruction:
      "1-2 sentences max, under 30 words. React to the screen. No roleplay, no emojis, no catchphrases. If nothing is happening: [SILENCE]",
    interactionInstruction:
      "When the player speaks to you, respond directly and conversationally. Acknowledge what they said, stay in character. Keep it brief.",
    context: {
      provider: "dashscope",
      model: "qwen3-vl-flash",
      prompt:
        "Describe what is happening on screen in 1-2 sentences. Focus on the game state, player actions, and any notable events.",
      maxTokens: 100,
      interval: 3,
      bufferSize: 10,
    },
    blockWeights: {
      solo_observation: 35,
      emotional_reaction: 20,
      question: 12,
      backstory_reference: 8,
      quip_banter: 4,
      callback: 5,
      hype_chain: 2,
      silence: 14,
    },
    blockPrompts: {
      solo_observation:
        "React to what you see on screen. Be specific about ONE thing.",
      emotional_reaction:
        "Express a pure emotional reaction. Don't describe the screen. Just FEEL it.",
      question:
        "Ask the player a question or wonder something aloud about what's happening.",
      backstory_reference:
        "Subtly reference your own backstory or lore in the context of what you see.",
      quip_banter:
        "Have a quick back-and-forth exchange with your co-caster about what just happened.",
      callback:
        "Reference something from earlier in this session that connects to what's happening now.",
      hype_chain:
        "React with rapid-fire energy to this moment. One punchy line.",
    },
    memory: {
      enabled: true,
      extractionIntervalMinutes: 10,
      maxMemoriesPerCharacter: 100,
      memoriesPerPrompt: 10,
      extractionPrompt:
        "Review the conversation and extract 1-3 key memories worth remembering.",
    },
  },
};

// ─── Validation ────────────────────────────────────────────────────
// Walks DEFAULT_CONFIG recursively. Returns a human-readable error
// string listing missing key paths, or null if valid.

function collectMissingKeys(
  schema: Record<string, unknown>,
  target: Record<string, unknown>,
  prefix: string,
): string[] {
  const missing: string[] = [];
  for (const key of Object.keys(schema)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!(key in target)) {
      missing.push(path);
      continue;
    }
    const schemaVal = schema[key];
    const targetVal = target[key];
    // Recurse into plain objects (not arrays, not null)
    if (
      schemaVal !== null &&
      typeof schemaVal === "object" &&
      !Array.isArray(schemaVal) &&
      targetVal !== null &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal)
    ) {
      // Skip Record<string, ...> fields where we don't know the keys ahead of time
      // (tokenPools, blockWeights, blockPrompts, traitRanges, promptQuality, rarityGuidance)
      const recordKeys = new Set([
        "tokenPools",
        "blockWeights",
        "blockPrompts",
        "traitRanges",
        "promptQuality",
        "rarityGuidance",
      ]);
      if (!recordKeys.has(key)) {
        missing.push(
          ...collectMissingKeys(
            schemaVal as Record<string, unknown>,
            targetVal as Record<string, unknown>,
            path,
          ),
        );
      }
    }
  }
  return missing;
}

/**
 * Validate a config object against the GlazeBotConfig shape.
 * Returns a human-readable error string listing missing keys, or null if valid.
 * Uses DEFAULT_CONFIG as the schema — any new field added there is automatically checked.
 *
 * Optional keys (traitRanges, promptQuality, rarityGuidance) are skipped.
 */
export function validateConfig(cfg: unknown): string | null {
  if (cfg === null || typeof cfg !== "object" || Array.isArray(cfg)) {
    return "Config must be a plain object";
  }
  const target = cfg as Record<string, unknown>;
  const schema = DEFAULT_CONFIG as unknown as Record<string, unknown>;

  // Optional top-level keys that don't need to exist
  const optionalKeys = new Set([
    "traitRanges",
    "promptQuality",
    "rarityGuidance",
  ]);

  const missing: string[] = [];
  for (const key of Object.keys(schema)) {
    if (optionalKeys.has(key)) continue;
    const path = key;
    if (!(key in target)) {
      missing.push(path);
      continue;
    }
    const schemaVal = schema[key];
    const targetVal = target[key];
    if (
      schemaVal !== null &&
      typeof schemaVal === "object" &&
      !Array.isArray(schemaVal) &&
      targetVal !== null &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal)
    ) {
      const recordKeys = new Set([
        "tokenPools",
        "blockWeights",
        "blockPrompts",
        "traitRanges",
        "promptQuality",
        "rarityGuidance",
      ]);
      if (!recordKeys.has(key)) {
        missing.push(
          ...collectMissingKeys(
            schemaVal as Record<string, unknown>,
            targetVal as Record<string, unknown>,
            path,
          ),
        );
      }
    }
  }

  if (missing.length === 0) return null;
  return `Missing keys: ${missing.join(", ")}`;
}
