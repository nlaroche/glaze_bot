import type { VisionProvider, Character, ChatMessage } from "@glazebot/shared-types";
import { buildSystemPrompt, buildUserPrompt, isSilence } from "../../llm.js";

export class AnthropicVisionProvider implements VisionProvider {
  id = "anthropic";

  private apiKey: string;
  private model: string;
  private maxTokens: number;

  constructor(opts?: { apiKey?: string; model?: string; maxTokens?: number }) {
    this.apiKey = opts?.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";
    this.model = opts?.model ?? process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
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
      ...opts.history,
      {
        role: "user" as const,
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: opts.image,
            },
          },
          { type: "text", text: userText },
        ],
      },
    ];

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        system: systemPrompt,
        messages,
        max_tokens: this.maxTokens,
      }),
    });

    const data = (await res.json()) as {
      content: { type: string; text: string }[];
    };
    const reply = data.content[0].text.trim();
    return isSilence(reply) ? null : reply;
  }
}
