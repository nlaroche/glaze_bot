import type { Character, ChatMessage } from "./character.js";

/** Vision LLM — analyzes screenshots + generates character responses */
export interface VisionProvider {
  id: string;
  chat(opts: {
    image: string;
    playerText?: string;
    character: Character;
    reactTo?: { name: string; text: string };
    gameHint?: string;
    history: ChatMessage[];
  }): Promise<string | null>;
}

/** Voice definition returned by TTS providers */
export interface Voice {
  id: string;
  name: string;
}

/** Text-to-Speech — converts character replies to audio */
export interface TTSProvider {
  id: string;
  speak(text: string, voiceId: string): Promise<ArrayBuffer>;
  listVoices?(): Promise<Voice[]>;
}

/** Speech-to-Text — transcribes player mic input */
export interface STTProvider {
  id: string;
  transcribe(audio: Float32Array, sampleRate: number): Promise<string>;
}

/** A capture source (monitor or window) */
export interface CaptureSource {
  id: string;
  name: string;
  type: "monitor" | "window";
}

/** Screen Capture — grabs frames from monitor/window */
export interface CaptureProvider {
  id: string;
  listSources(): Promise<CaptureSource[]>;
  setSource(source: CaptureSource): void;
  grabFrame(): Promise<string>;
  hasChanged(threshold: number): boolean;
}
