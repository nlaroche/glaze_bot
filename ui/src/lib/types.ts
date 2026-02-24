export interface PersonalityTraits {
  energy: number;
  positivity: number;
  formality: number;
  talkativeness: number;
  attitude: number;
  humor: number;
}

export interface Character {
  name: string;
  description: string;
  voice: string;
  personality?: PersonalityTraits;
}

export interface LogEntry {
  source: string;
  text: string;
}

export interface AppState {
  characters: Character[];
  active_characters: string[];
  paused: boolean;
  mic_mode: string;
  interval: number;
  interaction_mode: boolean;
  interaction_chance: number;
  min_gap: number;
  parties: Record<string, string[]>;
  ai_provider: string;
  vision_model: string;
  capture_scale: number;
  capture_quality: number;
  game_hint: string;
  capture_source_type: string | null;
  capture_source_name: string;
}

export interface CaptureSource {
  type: "monitor" | "window";
  id: number;
  name: string;
  thumbnail?: string;
}

export interface CostInfo {
  cost: number;
  calls: number;
}

export interface PollResult {
  logs: LogEntry[];
  paused: boolean;
  active_characters: string[];
  speaking: string;
  min_gap: number;
  interval: number;
  mic_mode: string;
  interaction_mode: boolean;
  interaction_chance: number;
  ai_provider: string;
  vision_model: string;
  capture_scale: number;
  capture_quality: number;
  game_hint: string;
  capture_source_type: string | null;
  capture_source_name: string;
}
