import type { GachaCharacter } from '@glazebot/shared-types';

export type EngineState = 'idle' | 'processing' | 'stopped';

// ── Topic Scheduler Types ────────────────────────────────────────

export type TopicType =
  | 'solo_observation'
  | 'emotional_reaction'
  | 'question'
  | 'backstory_reference'
  | 'quip_banter'
  | 'callback'
  | 'hype_chain'
  | 'encouragement'
  | 'hot_take'
  | 'tangent'
  | 'silence'
  | string; // allow custom topic keys

export interface TopicWeights {
  [key: string]: number;
}

export interface TopicPrompts {
  [key: string]: string;
}

export interface ScheduledTopic {
  type: TopicType;
  primaryCharacter: GachaCharacter;
  participants?: GachaCharacter[];
}

// Backward-compat aliases
export type BlockType = TopicType;
export type BlockWeights = TopicWeights;
export type BlockPrompts = TopicPrompts;
export type ScheduledBlock = ScheduledTopic;

export interface MultiLineResult {
  lines: Array<{
    characterId: string;
    characterName: string;
    voiceId?: string;
    text: string;
    avatarUrl?: string;
    rarity: string;
  }>;
  usage?: { input_tokens: number; output_tokens: number };
}

export interface HistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatLogEntry {
  id: string;
  characterId: string;
  name: string;
  rarity: string;
  text: string;
  time: string;
  timestamp: string; // ISO timestamp for persistence
  voiceId?: string;
  image?: string;
  isUserMessage?: boolean;
  topicType?: string;
}

export interface MessageRequest {
  id: string;                    // unique per-cycle, used as bubbleId
  character: GachaCharacter;
  trigger: 'timed' | 'user' | 'reaction' | 'direct';
  frameB64?: string;
  frameDims?: { width: number; height: number };
  playerText?: string;
  reactTo?: { name: string; text: string };
  sceneContext?: { game_name?: string; descriptions: string[] };
  enableVisuals?: boolean;
  signal?: AbortSignal;
  debugFrameId?: number;
  topicType?: TopicType;
  topicPrompt?: string;
  // Backward-compat aliases (deprecated — use topicType/topicPrompt)
  blockType?: TopicType;
  blockPrompt?: string;
  participants?: GachaCharacter[];
  memories?: string[];
}

export interface PipelineResult {
  text: string;
  visuals?: Record<string, unknown>[];
  usage?: { input_tokens: number; output_tokens: number };
}

/** Capture bounds for window captures — maps capture-space coords to screen-space */
export interface CaptureBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  screen_width: number;
  screen_height: number;
}

/** Return type from Rust grab_frame command */
export interface FrameResult {
  data_uri: string;
  width: number;
  height: number;
  capture_bounds?: CaptureBounds;
}

export interface SceneContext {
  game_name?: string;
  descriptions: string[];
}
