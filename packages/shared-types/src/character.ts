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
  voice: string;
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
