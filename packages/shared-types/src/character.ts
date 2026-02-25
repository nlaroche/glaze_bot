/** Personality trait scores (0-100, neutral at 50) */
export interface Personality {
  energy: number;
  positivity: number;
  formality: number;
  talkativeness: number;
  attitude: number;
  humor: number;
}

/** Character definition as stored in JSON files */
export interface Character {
  name: string;
  voice?: string;
  description: string;
  system_prompt: string;
  personality?: Personality;
}

/** A message in the conversation history */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Party configuration */
export interface PartyConfig {
  parties: Record<string, string[]>;
  last_party: string;
}

/** Character rarity tiers */
export type CharacterRarity = "common" | "rare" | "epic" | "legendary";

/** A single generation pipeline step's API call data */
export interface GenerationStep {
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  timestamp: string;
}

/** Metadata from each step of the admin generation pipeline */
export interface GenerationMetadata {
  step1_text?: GenerationStep;
  step2_image?: GenerationStep;
  step3_voice?: GenerationStep;
}

/** A gacha-generated character stored in the database */
export interface GachaCharacter extends Character {
  id: string;
  user_id: string;
  backstory: string;
  rarity: CharacterRarity;
  voice_id?: string;
  voice_name?: string;
  avatar_seed: string;
  avatar_url?: string;
  tagline?: string;
  tagline_url?: string;
  is_active: boolean;
  is_default: boolean;
  deleted_at?: string | null;
  generation_metadata?: GenerationMetadata | null;
  created_at: string;
}

/** Result from opening a booster pack */
export interface BoosterPackResult {
  characters: GachaCharacter[];
  packs_remaining: number;
  resets_at: string;
}
