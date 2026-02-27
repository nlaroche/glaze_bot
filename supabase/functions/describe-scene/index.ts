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
      analysisPrompt +=
        '\nIMPORTANT: Identify the EXACT game title (not the genre) from visual cues — look for logos, UI style, HUD layout, character designs, fonts, and any on-screen text. For example: "Hades", "Slay the Spire", "League of Legends" — NOT "roguelike dungeon crawler". If it\'s not a game, identify the application (e.g. "Google Chrome", "Discord", "Windows Desktop"). On the LAST line write exactly: DETECTED: <title>';
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

    // ── Gemini search-grounded game identification ────────────────
    // Uses Gemini with Google Search grounding to identify the game
    // from the screenshot. This works even for brand-new games the
    // LLM wasn't trained on, because it can search the web.

    async function identifyGameWithSearch(): Promise<string | undefined> {
      if (!GEMINI_API_KEY) return undefined;

      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      inline_data: {
                        mime_type: "image/jpeg",
                        data: frame_b64,
                      },
                    },
                    {
                      text: "What is the exact name of this video game? Search the web if needed. Reply with ONLY the game title, nothing else. If this is not a game, reply with the application name (e.g. 'Google Chrome', 'Discord'). If you cannot identify it, reply 'Unknown'.",
                    },
                  ],
                },
              ],
              tools: [{ google_search: {} }],
              generationConfig: {
                maxOutputTokens: 30,
                temperature: 0.1,
              },
            }),
          },
        );

        if (!res.ok) {
          console.error(`[describe-scene] Gemini search ${res.status}: ${await res.text()}`);
          return undefined;
        }

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? "")
          .join("")
          .trim();

        if (!text || text.toLowerCase() === "unknown") return undefined;
        // Clean up common formatting artifacts
        return text.replace(/^["']|["']$/g, "").replace(/[.!]+$/, "").trim() || undefined;
      } catch (err) {
        console.error("[describe-scene] Game search failed:", err);
        return undefined;
      }
    }

    // ── Call the selected provider ──────────────────────────────────

    // Run scene description and game identification in parallel when
    // we don't have a game name yet
    let result: VisionResult;
    let searchGameName: string | undefined;

    try {
      if (!game_name && GEMINI_API_KEY) {
        // Run both in parallel — scene description + web-search game ID
        const descriptionPromise = (async () => {
          if (provider === "anthropic") return callAnthropic();
          if (provider === "gemini") return callGemini();
          return callDashscope();
        })();
        const [descResult, gameResult] = await Promise.all([
          descriptionPromise,
          identifyGameWithSearch(),
        ]);
        result = descResult;
        searchGameName = gameResult;
      } else {
        if (provider === "anthropic") {
          result = await callAnthropic();
        } else if (provider === "gemini") {
          result = await callGemini();
        } else {
          result = await callDashscope();
        }
      }
    } catch (providerErr) {
      const msg =
        providerErr instanceof Error
          ? providerErr.message
          : String(providerErr);
      console.error(`[describe-scene] ${provider} error:`, msg);
      return errorResponse(`Vision API error: ${msg}`, 502);
    }

    // Determine game name — prefer search-grounded result, fall back to DETECTED: tag
    let detectedGame: string | undefined = searchGameName;
    let description = result.text;

    if (!detectedGame && !game_name) {
      const detectedMatch = result.text.match(/DETECTED:\s*(.+)/i);
      if (detectedMatch) {
        const raw = detectedMatch[1].trim();
        detectedGame = raw.replace(/[.!]+$/, '').trim() || undefined;
      }
    }
    // Always strip the DETECTED: line from description
    description = result.text.replace(/\n?DETECTED:\s*.+/i, '').trim();

    return jsonResponse({
      description,
      game_name: detectedGame,
      usage: result.usage,
    });
  } catch (err) {
    console.error("[describe-scene]", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message);
  }
});
