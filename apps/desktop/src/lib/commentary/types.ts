import type { GachaCharacter } from '@glazebot/shared-types';

export type EngineState = 'idle' | 'processing' | 'stopped';

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
}

export interface PipelineResult {
  text: string;
  visuals?: Record<string, unknown>[];
  usage?: { input_tokens: number; output_tokens: number };
}

/** Return type from Rust grab_frame command */
export interface FrameResult {
  data_uri: string;
  width: number;
  height: number;
}

export interface SceneContext {
  game_name?: string;
  descriptions: string[];
}
