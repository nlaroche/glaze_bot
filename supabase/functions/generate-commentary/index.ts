import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  handleCors,
  jsonResponse,
  errorResponse,
  getRequestUser,
  getServiceClient,
} from "../_shared/mod.ts";

const DASHSCOPE_API_KEY = Deno.env.get("DASHSCOPE_API_KEY") ?? "";
const DASHSCOPE_BASE_URL =
  Deno.env.get("VISION_BASE_URL") ??
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const VISION_MODEL = Deno.env.get("VISION_MODEL") ?? "qwen3-vl-flash";

/** Default style nudges — one is picked at random per call for variety */
const DEFAULT_STYLE_NUDGES = [
  "React to ONE specific thing you see on screen.",
  "Reference a movie, show, or meme this reminds you of.",
  "Make a bold prediction about what happens next.",
  "Roast the player's decision. Be specific.",
  "Ask a rhetorical question about what just happened.",
  "Give a backhanded compliment about the play.",
  "Pick one thing on screen and fixate on it.",
  "React to health, gold, or resources — not just the action.",
  "Notice something small in the background nobody else would.",
  "Express a strong opinion about something on screen that doesn't matter.",
  "Compare the player to a fictional character based on what they did.",
  "React to the PACE — is it frantic, slow, tense?",
];

const DEFAULT_DIRECTIVE = `You are a live gaming commentator watching the player's screen. Your CHARACTER VOICE is flavor — it should color HOW you say things, not WHAT you talk about. DO NOT roleplay or narrate in-character. DO NOT address the player with in-character nicknames or catchphrases. DO NOT use emojis.

Your job: react to what is ACTUALLY HAPPENING on screen right now. Be specific. Name the things you see. If someone dies, say they died. If the player makes a mistake, call it out. If something cool happens, hype it.

Think of yourself as a Twitch co-caster, not a D&D character.`;

const DEFAULT_MAX_TOKENS = 80;
const DEFAULT_TEMPERATURE = 0.9;
const DEFAULT_PRESENCE_PENALTY = 1.5;
const DEFAULT_FREQUENCY_PENALTY = 0.8;

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

    // Fetch commentary config from gacha_config (same pattern as generate-character)
    const serviceClient = getServiceClient();
    const { data: configRow } = await serviceClient
      .from("gacha_config")
      .select("config")
      .eq("id", "default")
      .single();

    const commentary =
      ((configRow?.config as Record<string, unknown>)?.commentary as
        | Record<string, unknown>
        | undefined) ?? {};
    const directive = (commentary.directive as string) ?? DEFAULT_DIRECTIVE;
    const nudges =
      (commentary.styleNudges as string[]) ?? DEFAULT_STYLE_NUDGES;
    const maxTokens =
      (commentary.maxTokens as number) ?? DEFAULT_MAX_TOKENS;
    const temperature =
      (commentary.temperature as number) ?? DEFAULT_TEMPERATURE;
    const presencePenalty =
      (commentary.presencePenalty as number) ?? DEFAULT_PRESENCE_PENALTY;
    const frequencyPenalty =
      (commentary.frequencyPenalty as number) ?? DEFAULT_FREQUENCY_PENALTY;

    // Build full system prompt: character persona + commentary instructions
    const commentaryDirective = `\n${directive}${buildPersonalityModifier(personality)}`;

    const fullSystemPrompt = system_prompt + "\n\n" + commentaryDirective;

    // Pick a random style nudge
    const nudge = nudges[Math.floor(Math.random() * nudges.length)];

    // Build text context for the user message
    const textParts: string[] = [];
    if (game_hint) {
      textParts.push(`Game: ${game_hint}`);
    }
    if (react_to) {
      textParts.push(
        `Co-caster ${react_to.name} just said: "${react_to.text}"`,
      );
    }
    if (player_text) {
      textParts.push(`Player said: "${player_text}"`);
    }
    textParts.push(`[${nudge}]`);
    textParts.push("/no_think");
    textParts.push(
      "1-2 sentences max, under 30 words. React to the screen. No roleplay, no emojis, no catchphrases. If nothing is happening: [SILENCE]",
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
          max_tokens: maxTokens,
          temperature,
          presence_penalty: presencePenalty,
          frequency_penalty: frequencyPenalty,
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
