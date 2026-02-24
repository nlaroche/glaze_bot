import type { TTSProvider, Voice } from "@glazebot/shared-types";

export class ElevenLabsTTSProvider implements TTSProvider {
  id = "elevenlabs";

  private apiKey: string;

  constructor(opts?: { apiKey?: string }) {
    this.apiKey = opts?.apiKey ?? process.env.ELEVENLABS_API_KEY ?? "";
  }

  async speak(text: string, voiceId: string): Promise<ArrayBuffer> {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": this.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      },
    );
    return res.arrayBuffer();
  }

  async listVoices(): Promise<Voice[]> {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": this.apiKey },
    });
    const data = (await res.json()) as {
      voices: { voice_id: string; name: string }[];
    };
    return data.voices.map((v) => ({ id: v.voice_id, name: v.name }));
  }
}
