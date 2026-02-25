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

/** A gacha-generated character stored in the database */
export interface GachaCharacter extends Character {
  id: string;
  user_id: string;
  backstory: string;
  rarity: CharacterRarity;
  voice_id?: string;
  voice_name?: string;
  avatar_seed: string;
  created_at: string;
}

/** Result from opening a booster pack */
export interface BoosterPackResult {
  characters: GachaCharacter[];
  packs_remaining: number;
  resets_at: string;
}
