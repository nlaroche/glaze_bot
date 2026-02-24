import type { TTSProvider, Voice } from "@glazebot/shared-types";

export class FishAudioTTSProvider implements TTSProvider {
  id = "fish";

  private apiKey: string;
  private baseUrl: string;

  constructor(opts?: { apiKey?: string; baseUrl?: string }) {
    this.apiKey = opts?.apiKey ?? process.env.FISH_AUDIO_API_KEY ?? "";
    this.baseUrl = opts?.baseUrl ?? "https://api.fish.audio";
  }

  async speak(text: string, voiceId: string): Promise<ArrayBuffer> {
    const res = await fetch(`${this.baseUrl}/v1/tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        text,
        reference_id: voiceId,
      }),
    });
    return res.arrayBuffer();
  }

  async listVoices(): Promise<Voice[]> {
    const res = await fetch(`${this.baseUrl}/model?page_size=100&self=true`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    const data = (await res.json()) as {
      items: { _id: string; title: string }[];
    };
    return data.items.map((v) => ({ id: v._id, name: v.title }));
  }
}
