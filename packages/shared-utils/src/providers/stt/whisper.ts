import type { STTProvider } from "@glazebot/shared-types";

/**
 * Whisper STT provider stub.
 * The actual implementation lives in Rust (src-tauri/src/audio.rs).
 * This stub exists so the provider registry has a consistent interface.
 * In the desktop app, calls to transcribe() are routed through Tauri commands.
 */
export class WhisperSTTProvider implements STTProvider {
  id = "whisper-local";

  async transcribe(_audio: Float32Array, _sampleRate: number): Promise<string> {
    throw new Error(
      "Whisper STT is implemented natively in Rust. Use Tauri invoke('stt_transcribe') instead.",
    );
  }
}
