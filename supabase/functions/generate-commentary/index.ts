import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  handleCors,
  jsonResponse,
  errorResponse,
  getRequestUser,
} from "../_shared/mod.ts";

const DASHSCOPE_API_KEY = Deno.env.get("DASHSCOPE_API_KEY") ?? "";
const DASHSCOPE_BASE_URL =
  Deno.env.get("VISION_BASE_URL") ??
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const VISION_MODEL = Deno.env.get("VISION_MODEL") ?? "qwen3-vl-flash";
const MAX_RESPONSE_TOKENS = parseInt(
  Deno.env.get("MAX_RESPONSE_TOKENS") ?? "150",
  10,
);

/** 18 style nudges — one is picked at random per call for variety */
const STYLE_NUDGES = [
  "Describe ONE specific thing you see on screen and react to that, not the vibe.",
  "Reference a specific movie, show, or meme that this moment reminds you of.",
  "Make a bold prediction about what will happen in the next 30 seconds.",
  "Roast the player's decision-making with love. Be specific about what they did wrong.",
  "Compare what just happened to something completely unrelated and absurd.",
  "React as if this is the single greatest or worst moment in gaming history.",
  "Ask a rhetorical question that highlights the absurdity of the situation.",
  "Give a backhanded compliment about the play you just witnessed.",
  "Narrate this moment as if it is the climax of a documentary about the player.",
  "Pick one object or character on screen and fixate on it for your whole response.",
  "React to the player's health, gold, or resources specifically — not just the action.",
  "Say something that would make sense as commentary on a nature documentary.",
  "Imagine you are commentating this for someone who cannot see the screen.",
  "Pretend this exact moment will be in a montage, describe why.",
  "React to the PACE of what is happening — is it frantic, slow, building tension?",
  "Notice something small or in the background that nobody else would comment on.",
  "Express a strong opinion about something on screen that does not matter at all.",
  "Compare the player to a specific fictional character based on what they just did.",
];

interface Personality {
  energy: number;
  positivity: number;
  formality: number;
  talkativeness: number;
  attitude: number;
  humor: number;
}

interface CommentaryRequest {
  frame_b64: string;
  system_prompt: string;
  personality?: Personality;
  history?: { role: string; content: string }[];
  player_text?: string;
  react_to?: { name: string; text: string };
  game_hint?: string;
}

/** Build personality modifier string from trait values (ported from brain.py) */
function buildPersonalityModifier(personality?: Personality): string {
  if (!personality) return "";

  const labels: Record<string, [string, string]> = {
    energy: ["very calm and low-energy", "very high-energy and hyped up"],
    positivity: ["cynical and pessimistic", "optimistic and upbeat"],
    formality: ["very casual and informal", "very formal and proper"],
    talkativeness: ["terse and brief", "chatty and verbose"],
    attitude: ["hostile and aggressive", "friendly and warm"],
    humor: ["dead serious", "silly and goofy"],
  };

  const parts: string[] = [];
  for (const [trait, [lowDesc, highDesc]] of Object.entries(labels)) {
    const val = (personality as Record<string, number>)[trait] ?? 50;
    if (val < 30) {
      parts.push(`Be ${lowDesc}`);
    } else if (val < 45) {
      parts.push(`Be somewhat ${lowDesc}`);
    } else if (val > 70) {
      parts.push(`Be ${highDesc}`);
    } else if (val > 55) {
      parts.push(`Be somewhat ${highDesc}`);
    }
  }

  if (parts.length === 0) return "";
  return "\n[Personality adjustment: " + parts.join(". ") + ".]";
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = await getRequestUser(req);
    if ("error" in auth) return auth.error;

    const body: CommentaryRequest = await req.json();
    const {
      frame_b64,
      system_prompt,
      personality,
      history,
      player_text,
      react_to,
      game_hint,
    } = body;

    if (!frame_b64) {
      return errorResponse("frame_b64 is required", 400);
    }
    if (!system_prompt) {
      return errorResponse("system_prompt is required", 400);
    }
    if (!DASHSCOPE_API_KEY) {
      return errorResponse("Dashscope API key not configured", 500);
    }

    // Build full system prompt with personality modifier
    const fullSystemPrompt =
      system_prompt + buildPersonalityModifier(personality);

    // Pick a random style nudge
    const nudge = STYLE_NUDGES[Math.floor(Math.random() * STYLE_NUDGES.length)];

    // Build text context for the user message
    const textParts: string[] = [];
    if (game_hint) {
      textParts.push(`The player is playing: ${game_hint}`);
    }
    if (react_to) {
      textParts.push(
        `Your co-caster ${react_to.name} just said: "${react_to.text}" — react to them or the screen.`,
      );
    }
    if (player_text) {
      textParts.push(`The player just said: "${player_text}"`);
    }
    textParts.push(`[Style hint: ${nudge}]`);
    textParts.push(
      "/no_think",
    );
    textParts.push(
      "CRITICAL: Keep your response to 1-2 short sentences MAX (under 40 words). Be punchy and reactive, not descriptive or analytical. If nothing interesting is happening, respond with exactly [SILENCE].",
    );

    // Build multimodal user content (OpenAI-compatible format)
    const userContent: Array<Record<string, unknown>> = [
      {
        type: "image_url",
        image_url: {
          url: `data:image/jpeg;base64,${frame_b64}`,
        },
      },
      {
        type: "text",
        text: textParts.join("\n"),
      },
    ];

    // Build messages array
    const messages: Array<Record<string, unknown>> = [
      { role: "system", content: fullSystemPrompt },
    ];

    // Append conversation history (text-only summaries)
    if (history && history.length > 0) {
      for (const entry of history) {
        messages.push({ role: entry.role, content: entry.content });
      }
    }

    // Add the multimodal user message
    messages.push({ role: "user", content: userContent });

    // Call Dashscope Qwen VL
    const apiRes = await fetch(
      `${DASHSCOPE_BASE_URL}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        },
        body: JSON.stringify({
          model: VISION_MODEL,
          messages,
          max_tokens: MAX_RESPONSE_TOKENS,
          temperature: 1.2,
          presence_penalty: 2.0,
          frequency_penalty: 1.0,
        }),
      },
    );

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error(
        `[generate-commentary] Dashscope returned ${apiRes.status}: ${errText}`,
      );
      return errorResponse(
        `Vision API error (${apiRes.status}): ${errText}`,
        502,
      );
    }

    const apiData = await apiRes.json();
    // Strip any <think>...</think> blocks that qwen3 thinking mode may produce
    let reply = (apiData.choices?.[0]?.message?.content?.trim() ?? "")
      .replace(/<think>[\s\S]*?<\/think>/g, "")
      .trim();
    const inputTokens = apiData.usage?.prompt_tokens ?? 0;
    const outputTokens = apiData.usage?.completion_tokens ?? 0;

    // Check for [SILENCE]
    const text =
      reply.toUpperCase().includes("[SILENCE]") ? null : reply;

    return jsonResponse({
      text,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    });
  } catch (err) {
    console.error("[generate-commentary]", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message);
  }
});
