import type { TTSProvider } from "@glazebot/shared-types";

/**
 * Kokoro TTS provider stub.
 * The actual implementation lives in Rust (src-tauri/src/tts.rs).
 * This stub exists so the provider registry has a consistent interface.
 * In the desktop app, calls to speak() are routed through Tauri commands.
 */
export class KokoroTTSProvider implements TTSProvider {
  id = "kokoro";

  async speak(_text: string, _voiceId: string): Promise<ArrayBuffer> {
    throw new Error(
      "Kokoro TTS is implemented natively in Rust. Use Tauri invoke('tts_speak') instead.",
    );
  }
}
