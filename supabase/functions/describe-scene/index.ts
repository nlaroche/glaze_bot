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
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

const DEFAULT_PROMPT =
  "Describe what is happening on screen in 1-2 sentences. Focus on the game state, player actions, and any notable events.";
const DEFAULT_MAX_TOKENS = 100;

interface DescribeSceneRequest {
  frame_b64: string;
  previous_description?: string;
  game_name?: string;
}

interface VisionResult {
  text: string;
  usage: { input_tokens: number; output_tokens: number };
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = await getRequestUser(req);
    if ("error" in auth) return auth.error;

    const body: DescribeSceneRequest = await req.json();
    const { frame_b64, previous_description, game_name } = body;

    if (!frame_b64) {
      return errorResponse("frame_b64 is required", 400);
    }

    // Fetch context config from gacha_config
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
    const contextCfg =
      (commentary.context as Record<string, unknown> | undefined) ?? {};

    const provider = (contextCfg.provider as string) ?? "dashscope";
    const model =
      (contextCfg.model as string) ??
      (provider === "anthropic"
        ? "claude-haiku-4-5-20251001"
        : provider === "gemini"
          ? "gemini-2.5-flash"
          : "qwen3-vl-flash");
    const prompt = (contextCfg.prompt as string) ?? DEFAULT_PROMPT;
    const maxTokens = (contextCfg.maxTokens as number) ?? DEFAULT_MAX_TOKENS;

    if (provider === "anthropic" && !ANTHROPIC_API_KEY) {
      return errorResponse("Anthropic API key not configured", 500);
    }
    if (provider === "gemini" && !GEMINI_API_KEY) {
      return errorResponse("Gemini API key not configured", 500);
    }
    if (provider === "dashscope" && !DASHSCOPE_API_KEY) {
      return errorResponse("Dashscope API key not configured", 500);
    }

    // Build the analysis prompt
    let analysisPrompt = prompt;
    if (!game_name) {
      analysisPrompt += "\nAlso identify the game being played.";
    }
    if (previous_description) {
      analysisPrompt += `\nPrevious scene: ${previous_description}. What changed?`;
    }

    analysisPrompt += "\n/no_think";

    // ── Provider-specific API helpers ──────────────────────────────

    async function callDashscope(): Promise<VisionResult> {
      const userContent: Array<Record<string, unknown>> = [
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${frame_b64}` },
        },
        { type: "text", text: analysisPrompt },
      ];
      const messages: Array<Record<string, unknown>> = [
        { role: "user", content: userContent },
      ];

      const res = await fetch(`${DASHSCOPE_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature: 0.3,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Dashscope ${res.status}: ${errText}`);
      }
      const data = await res.json();
      const reply = (data.choices?.[0]?.message?.content?.trim() ?? "")
        .replace(/<think>[\s\S]*?<\/think>/g, "")
        .trim();
      return {
        text: reply,
        usage: {
          input_tokens: data.usage?.prompt_tokens ?? 0,
          output_tokens: data.usage?.completion_tokens ?? 0,
        },
      };
    }

    async function callAnthropic(): Promise<VisionResult> {
      const anthropicPrompt = analysisPrompt.replace("/no_think", "").trim();
      const userBlocks: Array<Record<string, unknown>> = [
        {
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: frame_b64 },
        },
        { type: "text", text: anthropicPrompt },
      ];
      const messages: Array<Record<string, unknown>> = [
        { role: "user", content: userBlocks },
      ];

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature: 0.3,
          messages,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Anthropic ${res.status}: ${errText}`);
      }
      const data = await res.json();
      const reply = data.content?.[0]?.text?.trim() ?? "";
      return {
        text: reply,
        usage: {
          input_tokens: data.usage?.input_tokens ?? 0,
          output_tokens: data.usage?.output_tokens ?? 0,
        },
      };
    }

    async function callGemini(): Promise<VisionResult> {
      const geminiPrompt = analysisPrompt.replace("/no_think", "").trim();
      const userContent: Array<Record<string, unknown>> = [
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${frame_b64}` },
        },
        { type: "text", text: geminiPrompt },
      ];
      const messages: Array<Record<string, unknown>> = [
        { role: "user", content: userContent },
      ];

      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GEMINI_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature: 0.3,
          }),
        },
      );
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini ${res.status}: ${errText}`);
      }
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content?.trim() ?? "";
      return {
        text: reply,
        usage: {
          input_tokens: data.usage?.prompt_tokens ?? 0,
          output_tokens: data.usage?.completion_tokens ?? 0,
        },
      };
    }

    // ── Call the selected provider ──────────────────────────────────

    let result: VisionResult;
    try {
      if (provider === "anthropic") {
        result = await callAnthropic();
      } else if (provider === "gemini") {
        result = await callGemini();
      } else {
        result = await callDashscope();
      }
    } catch (providerErr) {
      const msg =
        providerErr instanceof Error
          ? providerErr.message
          : String(providerErr);
      console.error(`[describe-scene] ${provider} error:`, msg);
      return errorResponse(`Vision API error: ${msg}`, 502);
    }

    // Try to extract game name from response if we asked for it
    let detectedGame: string | undefined;
    if (!game_name) {
      const gameMatch = result.text.match(
        /(?:game[:\s]+|playing[:\s]+|this (?:is|looks like)[:\s]+)["']?([^"'\n.]+)/i,
      );
      if (gameMatch) {
        detectedGame = gameMatch[1].trim();
      }
    }

    return jsonResponse({
      description: result.text,
      game_name: detectedGame,
      usage: result.usage,
    });
  } catch (err) {
    console.error("[describe-scene]", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message);
  }
});
