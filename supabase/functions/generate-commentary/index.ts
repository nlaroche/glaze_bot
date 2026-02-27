import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  handleCors,
  jsonResponse,
  errorResponse,
  getRequestUser,
  getServiceClient,
} from "../_shared/mod.ts";
import {
  toProviderTools,
  parseToolCalls,
  buildVisualSystemAddendum,
} from "../_shared/visual-tools.ts";

const DASHSCOPE_API_KEY = Deno.env.get("DASHSCOPE_API_KEY") ?? "";
const DASHSCOPE_BASE_URL =
  Deno.env.get("VISION_BASE_URL") ??
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const VISION_MODEL = Deno.env.get("VISION_MODEL") ?? "qwen3-vl-flash";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

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
const DEFAULT_RESPONSE_INSTRUCTION =
  "1-2 sentences max, under 30 words. React to the screen. No roleplay, no emojis, no catchphrases. If nothing is happening: [SILENCE]";

interface Personality {
  energy: number;
  positivity: number;
  formality: number;
  talkativeness: number;
  attitude: number;
  humor: number;
}

interface CommentaryRequest {
  frame_b64?: string;
  frame_dims?: { width: number; height: number };
  system_prompt: string;
  personality?: Personality;
  history?: { role: string; content: string }[];
  player_text?: string;
  react_to?: { name: string; text: string };
  game_hint?: string;
  scene_context?: { game_name?: string; descriptions: string[] };
  enable_visuals?: boolean;
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
      frame_dims,
      system_prompt,
      personality,
      history,
      player_text,
      react_to,
      game_hint,
      scene_context,
      enable_visuals,
    } = body;

    if (!frame_b64 && !player_text && !react_to) {
      return errorResponse("At least one of frame_b64, player_text, or react_to is required", 400);
    }
    if (!system_prompt) {
      return errorResponse("system_prompt is required", 400);
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
    const responseInstruction =
      (commentary.responseInstruction as string) ?? DEFAULT_RESPONSE_INSTRUCTION;
    const visionProvider =
      (commentary.visionProvider as string) ?? "dashscope";
    const visionModel =
      (commentary.visionModel as string) ??
      (visionProvider === "anthropic"
        ? "claude-haiku-4-5-20251001"
        : visionProvider === "gemini"
          ? "gemini-2.5-flash"
          : VISION_MODEL);

    if (visionProvider === "anthropic" && !ANTHROPIC_API_KEY) {
      return errorResponse("Anthropic API key not configured", 500);
    }
    if (visionProvider === "gemini" && !GEMINI_API_KEY) {
      return errorResponse("Gemini API key not configured", 500);
    }
    if (visionProvider === "dashscope" && !DASHSCOPE_API_KEY) {
      return errorResponse("Dashscope API key not configured", 500);
    }

    // Build full system prompt: character persona + commentary instructions
    const commentaryDirective = `\n${directive}${buildPersonalityModifier(personality)}`;

    let fullSystemPrompt = system_prompt + "\n\n" + commentaryDirective;
    if (enable_visuals) {
      fullSystemPrompt += buildVisualSystemAddendum(frame_dims);
    }

    // Bump max tokens when visuals enabled (tool call args consume tokens)
    const effectiveMaxTokens = enable_visuals ? Math.max(maxTokens, 200) : maxTokens;

    // Get provider-specific tool definitions
    const providerTools = enable_visuals
      ? toProviderTools(visionProvider as "dashscope" | "anthropic" | "gemini")
      : null;

    // Pick a random style nudge
    const nudge = nudges[Math.floor(Math.random() * nudges.length)];

    // Build text context for the user message
    const textParts: string[] = [];
    if (scene_context) {
      if (scene_context.game_name) {
        textParts.push(`Game detected: ${scene_context.game_name}`);
      }
      if (scene_context.descriptions.length > 0) {
        textParts.push("Recent scene context:");
        for (const desc of scene_context.descriptions) {
          textParts.push(`- ${desc}`);
        }
      }
    } else if (game_hint) {
      textParts.push(`Game: ${game_hint}`);
    }
    if (react_to) {
      textParts.push(
        `Co-caster ${react_to.name} just said: "${react_to.text}"`,
      );
    }
    if (player_text) {
      textParts.push(`Player said: "${player_text}"`);
      const interactionInstruction = (commentary.interactionInstruction as string) ??
        'When the player speaks to you, respond directly and conversationally. Acknowledge what they said, stay in character. Keep it brief.';
      textParts.push(`[${interactionInstruction}]`);
    }
    textParts.push(`[${nudge}]`);
    textParts.push("/no_think");
    textParts.push(responseInstruction);

    // ── Provider-specific API helpers ──────────────────────────────

    interface VisionResult {
      text: string;
      visuals: Array<Record<string, unknown>>;
      usage: { input_tokens: number; output_tokens: number };
    }

    async function callDashscope(): Promise<VisionResult> {
      const userContent: Array<Record<string, unknown>> = [];
      if (frame_b64) {
        userContent.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${frame_b64}` } });
      }
      userContent.push({ type: "text", text: textParts.join("\n") });
      const messages: Array<Record<string, unknown>> = [
        { role: "system", content: fullSystemPrompt },
      ];
      if (history?.length) {
        for (const entry of history) messages.push({ role: entry.role, content: entry.content });
      }
      messages.push({ role: "user", content: userContent });

      const reqBody: Record<string, unknown> = {
        model: visionModel,
        messages,
        max_tokens: effectiveMaxTokens,
        temperature,
        presence_penalty: presencePenalty,
        frequency_penalty: frequencyPenalty,
      };
      if (providerTools) {
        reqBody.tools = providerTools;
        reqBody.tool_choice = "auto";
      }

      const res = await fetch(`${DASHSCOPE_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${DASHSCOPE_API_KEY}` },
        body: JSON.stringify(reqBody),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Dashscope ${res.status}: ${errText}`);
      }
      const data = await res.json();
      const reply = (data.choices?.[0]?.message?.content?.trim() ?? "")
        .replace(/<think>[\s\S]*?<\/think>/g, "")
        .trim();
      const visuals = enable_visuals
        ? parseToolCalls("dashscope", data)
        : [];
      return {
        text: reply,
        visuals,
        usage: { input_tokens: data.usage?.prompt_tokens ?? 0, output_tokens: data.usage?.completion_tokens ?? 0 },
      };
    }

    async function callAnthropic(): Promise<VisionResult> {
      // Anthropic Messages API — no /no_think, no presence/frequency penalty
      const anthropicTextParts = textParts.filter((p) => p !== "/no_think");
      const userBlocks: Array<Record<string, unknown>> = [];
      if (frame_b64) {
        userBlocks.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: frame_b64 } });
      }
      userBlocks.push({ type: "text", text: anthropicTextParts.join("\n") });
      const messages: Array<Record<string, unknown>> = [];
      if (history?.length) {
        for (const entry of history) messages.push({ role: entry.role, content: entry.content });
      }
      messages.push({ role: "user", content: userBlocks });

      const reqBody: Record<string, unknown> = {
        model: visionModel,
        max_tokens: effectiveMaxTokens,
        temperature,
        system: fullSystemPrompt,
        messages,
      };
      if (providerTools) {
        reqBody.tools = providerTools;
        reqBody.tool_choice = { type: "auto" };
      }

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(reqBody),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Anthropic ${res.status}: ${errText}`);
      }
      const data = await res.json();
      // Extract text from content blocks (skip tool_use blocks)
      const textBlocks = (data.content ?? []).filter((b: { type: string }) => b.type === "text");
      const reply = textBlocks.map((b: { text: string }) => b.text?.trim()).join(" ").trim();
      const visuals = enable_visuals
        ? parseToolCalls("anthropic", data)
        : [];
      return {
        text: reply,
        visuals,
        usage: { input_tokens: data.usage?.input_tokens ?? 0, output_tokens: data.usage?.output_tokens ?? 0 },
      };
    }

    async function callGemini(): Promise<VisionResult> {
      // Gemini uses OpenAI-compatible format via generativelanguage endpoint
      const userContent: Array<Record<string, unknown>> = [];
      if (frame_b64) {
        userContent.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${frame_b64}` } });
      }
      userContent.push({ type: "text", text: textParts.filter((p) => p !== "/no_think").join("\n") });
      const messages: Array<Record<string, unknown>> = [
        { role: "system", content: fullSystemPrompt },
      ];
      if (history?.length) {
        for (const entry of history) messages.push({ role: entry.role, content: entry.content });
      }
      messages.push({ role: "user", content: userContent });

      const reqBody: Record<string, unknown> = {
        model: visionModel,
        messages,
        max_tokens: effectiveMaxTokens,
        temperature,
      };
      if (providerTools) {
        reqBody.tools = providerTools;
        reqBody.tool_choice = "auto";
      }

      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${GEMINI_API_KEY}` },
          body: JSON.stringify(reqBody),
        },
      );
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini ${res.status}: ${errText}`);
      }
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content?.trim() ?? "";
      const visuals = enable_visuals
        ? parseToolCalls("gemini", data)
        : [];
      return {
        text: reply,
        visuals,
        usage: { input_tokens: data.usage?.prompt_tokens ?? 0, output_tokens: data.usage?.completion_tokens ?? 0 },
      };
    }

    // ── Call the selected provider ──────────────────────────────────

    let result: VisionResult;
    try {
      if (visionProvider === "anthropic") {
        result = await callAnthropic();
      } else if (visionProvider === "gemini") {
        result = await callGemini();
      } else {
        result = await callDashscope();
      }
    } catch (providerErr) {
      const msg = providerErr instanceof Error ? providerErr.message : String(providerErr);
      console.error(`[generate-commentary] ${visionProvider} error:`, msg);
      return errorResponse(`Vision API error: ${msg}`, 502);
    }

    // Check for [SILENCE]
    const text =
      result.text.toUpperCase().includes("[SILENCE]") ? null : result.text;

    return jsonResponse({
      text,
      visuals: result.visuals.length > 0 ? result.visuals : undefined,
      usage: result.usage,
    });
  } catch (err) {
    console.error("[generate-commentary]", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message);
  }
});
