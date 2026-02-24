import type { VisionProvider, Character, ChatMessage } from "@glazebot/shared-types";
import { buildSystemPrompt, buildUserPrompt, buildHistorySummary, trimHistory, isSilence } from "../../llm.js";

export class DashscopeVisionProvider implements VisionProvider {
  id = "dashscope";

  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private maxTokens: number;

  constructor(opts?: { apiKey?: string; baseUrl?: string; model?: string; maxTokens?: number }) {
    this.apiKey = opts?.apiKey ?? process.env.DASHSCOPE_API_KEY ?? "";
    this.baseUrl = opts?.baseUrl ?? process.env.DASHSCOPE_BASE_URL ?? "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
    this.model = opts?.model ?? process.env.VISION_MODEL ?? "qwen3-vl-flash";
    this.maxTokens = opts?.maxTokens ?? 150;
  }

  async chat(opts: {
    image: string;
    playerText?: string;
    character: Character;
    reactTo?: { name: string; text: string };
    gameHint?: string;
    history: ChatMessage[];
  }): Promise<string | null> {
    const systemPrompt = buildSystemPrompt(opts.character);
    const userText = buildUserPrompt({
      playerText: opts.playerText,
      reactTo: opts.reactTo,
      gameHint: opts.gameHint,
    });

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...opts.history,
      {
        role: "user" as const,
        content: [
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${opts.image}` } },
          { type: "text", text: userText },
        ],
      },
    ];

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: this.maxTokens,
        temperature: 1.2,
        presence_penalty: 2.0,
        frequency_penalty: 1.0,
      }),
    });

    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    const reply = data.choices[0].message.content.trim();
    return isSilence(reply) ? null : reply;
  }
}
