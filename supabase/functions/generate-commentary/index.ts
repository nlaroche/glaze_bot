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
  extractSearchToolCall,
} from "../_shared/visual-tools.ts";

const DASHSCOPE_API_KEY = Deno.env.get("DASHSCOPE_API_KEY") ?? "";
const DASHSCOPE_BASE_URL =
  Deno.env.get("VISION_BASE_URL") ??
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const VISION_MODEL = Deno.env.get("VISION_MODEL") ?? "qwen3-vl-flash";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

const DEFAULT_MAX_TOKENS = 50;
const DEFAULT_TEMPERATURE = 0.9;
const DEFAULT_PRESENCE_PENALTY = 1.5;
const DEFAULT_FREQUENCY_PENALTY = 0.8;

/** Hard word-count cap — safety net because some models ignore max_tokens for text. */
const MAX_WORDS = 35;

function truncateToWordLimit(text: string, limit: number): string {
  const words = text.split(/\s+/);
  if (words.length <= limit) return text;
  // Find the last sentence boundary within the limit
  const truncated = words.slice(0, limit).join(" ");
  const lastSentence = truncated.match(/^(.*[.!?])\s*/);
  return lastSentence ? lastSentence[1] : truncated;
}

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
  topic_type?: string;
  topic_prompt?: string;
  block_type?: string;   // backward compat
  block_prompt?: string; // backward compat
  memories?: string[];
  participants?: Array<{ name: string; system_prompt: string; personality?: Personality; voice_id?: string; avatar_url?: string; rarity?: string; id?: string }>;
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
      topic_type: raw_topic_type,
      topic_prompt: raw_topic_prompt,
      block_type: raw_block_type,
      block_prompt: raw_block_prompt,
      memories,
      participants,
    } = body;

    // Accept both new (topic_*) and old (block_*) field names
    const block_type = raw_topic_type ?? raw_block_type;
    const block_prompt = raw_topic_prompt ?? raw_block_prompt;

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
    const maxTokens =
      (commentary.maxTokens as number) ?? DEFAULT_MAX_TOKENS;
    const temperature =
      (commentary.temperature as number) ?? DEFAULT_TEMPERATURE;
    const presencePenalty =
      (commentary.presencePenalty as number) ?? DEFAULT_PRESENCE_PENALTY;
    const frequencyPenalty =
      (commentary.frequencyPenalty as number) ?? DEFAULT_FREQUENCY_PENALTY;
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

    // ── Handle multi-character blocks (quip_banter / hype_chain) ──
    if ((block_type === "quip_banter" || block_type === "hype_chain") && participants && participants.length >= 2) {
      const characterDescs = participants.map((p) => {
        const mod = buildPersonalityModifier(p.personality);
        return `- ${p.name}: ${p.system_prompt?.slice(0, 300) ?? "A commentator."}${mod}`;
      }).join("\n");

      // Find personality contrasts to seed the interaction
      const p1 = participants[0].personality;
      const p2 = participants[1].personality;
      let contrastHint = "";
      if (p1 && p2) {
        const contrasts: string[] = [];
        if (Math.abs((p1.positivity ?? 50) - (p2.positivity ?? 50)) > 25)
          contrasts.push(`${participants[0].name} is ${(p1.positivity ?? 50) > 50 ? "optimistic" : "cynical"}, ${participants[1].name} is ${(p2.positivity ?? 50) > 50 ? "optimistic" : "cynical"}`);
        if (Math.abs((p1.energy ?? 50) - (p2.energy ?? 50)) > 25)
          contrasts.push(`${participants[0].name} is ${(p1.energy ?? 50) > 50 ? "hyped" : "calm"}, ${participants[1].name} is ${(p2.energy ?? 50) > 50 ? "hyped" : "calm"}`);
        if (Math.abs((p1.humor ?? 50) - (p2.humor ?? 50)) > 25)
          contrasts.push(`${participants[0].name} is ${(p1.humor ?? 50) > 50 ? "goofy" : "serious"}, ${participants[1].name} is ${(p2.humor ?? 50) > 50 ? "goofy" : "serious"}`);
        if (contrasts.length > 0) contrastHint = `\nPersonality friction: ${contrasts.join("; ")}. USE this tension.`;
      }

      const multiDirective = block_type === "quip_banter"
        ? `Two co-casters are watching a game together. Write a 2-line exchange where they TALK TO EACH OTHER — not just react to the screen separately. One says something, the other RESPONDS to what they said. They can disagree, tease, build on each other's point, or have their personalities clash. The screen is context, but the exchange is between THEM.${contrastHint}\n\nCharacters:\n${characterDescs}`
        : `Two co-casters react to the SAME moment on screen. Character A says something, then Character B responds DIRECTLY to A's take — agreeing loudly, pushing back, one-upping, or riffing off it. They must acknowledge each other, not just independently comment.${contrastHint}\n\nCharacters:\n${characterDescs}`;

      const multiSystemPrompt = `${multiDirective}\n\nRULES:\n- Each line: 1 sentence, under 20 words. Spoken aloud via TTS.\n- The second line MUST reference or respond to the first line.\n- Stay in character voice but react to EACH OTHER.\n\nReturn ONLY a JSON array: [{\"character\": \"Name\", \"line\": \"their line\"}, ...]\nNo other text. No markdown fences. Just the JSON array.`;

      const multiTextParts: string[] = [];
      if (scene_context) {
        if (scene_context.game_name) multiTextParts.push(`Game: ${scene_context.game_name}`);
        if (scene_context.descriptions.length > 0) {
          multiTextParts.push("Scene: " + scene_context.descriptions.join("; "));
        }
      }
      if (block_prompt) multiTextParts.push(`[${block_prompt}]`);
      if (memories && memories.length > 0) {
        multiTextParts.push("[MEMORIES]\n" + memories.map((m) => `- ${m}`).join("\n"));
      }
      multiTextParts.push("Write the exchange now.");

      const multiUserContent: Array<Record<string, unknown>> = [];
      if (frame_b64) {
        multiUserContent.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${frame_b64}` } });
      }
      multiUserContent.push({ type: "text", text: multiTextParts.join("\n") });

      const multiMessages = [
        { role: "system", content: multiSystemPrompt },
        { role: "user", content: multiUserContent },
      ];

      // Use the same provider dispatch, but with multi-character prompt
      let multiResult: { text: string; usage: { input_tokens: number; output_tokens: number } };
      // Scale max tokens for multi-character: need room for N lines of JSON,
      // but respect the user's configured maxTokens as a per-line budget.
      const participantCount = participants.length;
      const multiMaxTokens = maxTokens * participantCount + 40; // +40 for JSON array wrapper
      const multiReqBody: Record<string, unknown> = {
        model: visionModel,
        messages: multiMessages,
        max_tokens: multiMaxTokens,
        temperature,
      };

      if (visionProvider === "anthropic") {
        // Anthropic format
        const anthropicBlocks: Array<Record<string, unknown>> = [];
        if (frame_b64) {
          anthropicBlocks.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: frame_b64 } });
        }
        anthropicBlocks.push({ type: "text", text: multiTextParts.join("\n") });

        const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: visionModel, max_tokens: multiMaxTokens, temperature, system: multiSystemPrompt, messages: [{ role: "user", content: anthropicBlocks }] }),
        });
        if (!anthropicRes.ok) {
          const errText = await anthropicRes.text();
          return errorResponse(`Multi-character API error: ${errText}`, 502);
        }
        const aData = await anthropicRes.json();
        const aText = (aData.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join(" ").trim();
        multiResult = { text: aText, usage: { input_tokens: aData.usage?.input_tokens ?? 0, output_tokens: aData.usage?.output_tokens ?? 0 } };
      } else if (visionProvider === "gemini") {
        const gRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${GEMINI_API_KEY}` },
          body: JSON.stringify(multiReqBody),
        });
        if (!gRes.ok) { const e = await gRes.text(); return errorResponse(`Multi-character API error: ${e}`, 502); }
        const gData = await gRes.json();
        multiResult = { text: gData.choices?.[0]?.message?.content?.trim() ?? "", usage: { input_tokens: gData.usage?.prompt_tokens ?? 0, output_tokens: gData.usage?.completion_tokens ?? 0 } };
      } else {
        const dRes = await fetch(`${DASHSCOPE_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${DASHSCOPE_API_KEY}` },
          body: JSON.stringify({ ...multiReqBody, presence_penalty: presencePenalty, frequency_penalty: frequencyPenalty }),
        });
        if (!dRes.ok) { const e = await dRes.text(); return errorResponse(`Multi-character API error: ${e}`, 502); }
        const dData = await dRes.json();
        const dRaw = dData.choices?.[0]?.message?.content?.trim() ?? "";
        let dText = dRaw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        // If think-stripping emptied the response, try extracting from think block
        if (!dText && dRaw.includes("<think>")) {
          const m = dRaw.match(/<think>([\s\S]*?)<\/think>/);
          if (m) dText = m[1].trim();
        }
        multiResult = { text: dText, usage: { input_tokens: dData.usage?.prompt_tokens ?? 0, output_tokens: dData.usage?.completion_tokens ?? 0 } };
      }

      // Try to parse JSON array from response
      let parsed: Array<{ character: string; line: string }> | null = null;
      try {
        const jsonMatch = multiResult.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const arr = JSON.parse(jsonMatch[0]);
          if (Array.isArray(arr) && arr.length > 0 && arr[0].character && arr[0].line) {
            parsed = arr as Array<{ character: string; line: string }>;
          }
        }
      } catch {
        console.error("[generate-commentary] Failed to parse multi-character JSON:", multiResult.text.slice(0, 200));
      }

      if (parsed && parsed.length > 0) {
        return jsonResponse({ lines: parsed, text: multiResult.text, usage: multiResult.usage });
      }

      // Fallback: JSON parse failed or LLM returned plain text.
      // Never return raw JSON to the user — attribute the whole response
      // to the primary character, stripping any JSON artifacts.
      const fallbackText = multiResult.text
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .replace(/^\s*\[[\s\S]*\]\s*$/, "") // If it's ONLY a JSON array, discard entirely
        .trim();

      if (!fallbackText || fallbackText.startsWith("[") || fallbackText.startsWith("{")) {
        // Still looks like JSON — return silence rather than leaking JSON to the user
        return jsonResponse({ text: null, usage: multiResult.usage });
      }

      return jsonResponse({ text: fallbackText, usage: multiResult.usage });
    }

    // System prompt = character persona + personality modifier + output constraints.
    // What to actually SAY comes from the topic prompt in the user message.
    const personalityMod = buildPersonalityModifier(personality);

    let fullSystemPrompt = system_prompt + personalityMod
      + `\n\nYou are watching a player's screen and commentating live. Your responses are spoken aloud via TTS.`
      + `\n\n[OUTPUT FORMAT]\n1-2 sentences max, under 30 words. No emojis. If nothing is happening: [SILENCE]`;

    // Inject memories from past sessions
    if (memories && memories.length > 0) {
      fullSystemPrompt += "\n\n[MEMORIES FROM PAST SESSIONS]\n" + memories.map((m) => `- ${m}`).join("\n");
    }

    // Anti-repetition: extract recent assistant responses and instruct model to avoid them
    if (history && history.length > 0) {
      const recentResponses = history
        .filter((h) => h.role === "assistant")
        .slice(-3)
        .map((h) => h.content);
      if (recentResponses.length > 0) {
        fullSystemPrompt += "\n\n[DO NOT REPEAT]\nYou already said these things recently. Say something DIFFERENT:\n" +
          recentResponses.map((r) => `- "${r}"`).join("\n");
      }
    }

    if (enable_visuals) {
      fullSystemPrompt += buildVisualSystemAddendum(frame_dims);
    }

    // Only add token headroom when tool calls are forced (player interaction).
    // For auto tool_choice, the model can choose text-only within the normal budget.
    const forceVisuals = !!(enable_visuals && player_text && frame_b64);
    const effectiveMaxTokens = forceVisuals ? maxTokens + 120 : maxTokens;

    // Get provider-specific tool definitions
    // Include request_search tool when Gemini key is available (used for web search grounding)
    const includeSearch = !!GEMINI_API_KEY;
    const providerTools = enable_visuals
      ? toProviderTools(visionProvider as "dashscope" | "anthropic" | "gemini", includeSearch)
      : null;

    // Build text context for the user message
    const textParts: string[] = [];
    if (scene_context) {
      if (scene_context.game_name) {
        textParts.push(`Game: ${scene_context.game_name}`);
      }
      if (scene_context.descriptions.length > 0) {
        textParts.push("Scene: " + scene_context.descriptions.join("; "));
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
      // Direct player message — no topic constraint, respond freely
      textParts.push(`Player said: "${player_text}"`);
      textParts.push(`Respond directly and conversationally. Stay in character. Keep it brief.`);
      if (enable_visuals && frame_b64) {
        textParts.push('If they ask about anything on screen, use arrow or circle to point at it.');
      }
    }
    // The topic prompt from the scheduler is THE instruction.
    if (block_prompt) {
      textParts.push(`[YOUR TASK: ${block_prompt}]`);
    }
    textParts.push("/no_think");

    // ── Provider-specific API helpers ──────────────────────────────

    interface VisionResult {
      text: string;
      visuals: Array<Record<string, unknown>>;
      usage: { input_tokens: number; output_tokens: number };
      searchQuery?: string;
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
        reqBody.tool_choice = forceVisuals ? "required" : "auto";
      }

      // Log request (omit frame_b64 to keep logs readable)
      const logMessages = messages.map((m) => {
        if (m.role === "user" && Array.isArray(m.content)) {
          return { role: m.role, content: (m.content as Array<Record<string, unknown>>).map((c) =>
            c.type === "image_url" ? { type: "image_url", size: "omitted" } : c
          )};
        }
        return m;
      });
      console.log("[generate-commentary] REQUEST", JSON.stringify({
        model: visionModel,
        provider: "dashscope",
        max_tokens: effectiveMaxTokens,
        temperature,
        block_type,
        block_prompt,
        has_tools: !!providerTools,
        force_visuals: forceVisuals,
        message_count: messages.length,
        system_prompt_length: fullSystemPrompt.length,
        user_text: textParts.join(" | "),
      }));

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

      // Log response
      console.log("[generate-commentary] RESPONSE", JSON.stringify({
        model: visionModel,
        finish_reason: data.choices?.[0]?.finish_reason,
        usage: data.usage,
        raw_content_length: (data.choices?.[0]?.message?.content ?? "").length,
        has_tool_calls: !!(data.choices?.[0]?.message?.tool_calls?.length),
        raw_content_preview: (data.choices?.[0]?.message?.content ?? "").slice(0, 300),
      }));

      const rawContent = data.choices?.[0]?.message?.content?.trim() ?? "";
      let reply = rawContent.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      // Qwen sometimes wraps the entire response in <think> despite /no_think.
      // If stripping left us empty but there was content, extract from the think block.
      if (!reply && rawContent.includes("<think>")) {
        const thinkMatch = rawContent.match(/<think>([\s\S]*?)<\/think>/);
        if (thinkMatch) {
          // Take the last line from the think block — often the actual commentary
          const thinkLines = thinkMatch[1].trim().split("\n").filter((l: string) => l.trim());
          const lastLine = thinkLines[thinkLines.length - 1]?.trim() ?? "";
          // Only use it if it looks like commentary (not reasoning/planning)
          if (lastLine.length > 5 && lastLine.length < 200 && !lastLine.startsWith("I need") && !lastLine.startsWith("The user")) {
            reply = lastLine;
          }
        }
      }
      const visuals = enable_visuals
        ? parseToolCalls("dashscope", data)
        : [];
      const search = enable_visuals ? extractSearchToolCall("dashscope", data) : null;
      return {
        text: reply,
        visuals,
        usage: { input_tokens: data.usage?.prompt_tokens ?? 0, output_tokens: data.usage?.completion_tokens ?? 0 },
        searchQuery: search?.query,
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
        reqBody.tool_choice = forceVisuals ? { type: "any" } : { type: "auto" };
      }

      console.log("[generate-commentary] REQUEST", JSON.stringify({
        model: visionModel, provider: "anthropic", max_tokens: effectiveMaxTokens,
        temperature, block_type, block_prompt, has_tools: !!providerTools,
        system_prompt_length: fullSystemPrompt.length, user_text: textParts.join(" | "),
      }));

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

      console.log("[generate-commentary] RESPONSE", JSON.stringify({
        model: visionModel, finish_reason: data.stop_reason,
        usage: data.usage, content_blocks: (data.content ?? []).length,
        raw_text_preview: (data.content ?? []).filter((b: {type:string}) => b.type === "text").map((b: {text:string}) => b.text).join(" ").slice(0, 300),
      }));

      // Extract text from content blocks (skip tool_use blocks)
      const textBlocks = (data.content ?? []).filter((b: { type: string }) => b.type === "text");
      const reply = textBlocks.map((b: { text: string }) => b.text?.trim()).join(" ").trim();
      const visuals = enable_visuals
        ? parseToolCalls("anthropic", data)
        : [];
      const search = enable_visuals ? extractSearchToolCall("anthropic", data) : null;
      return {
        text: reply,
        visuals,
        usage: { input_tokens: data.usage?.input_tokens ?? 0, output_tokens: data.usage?.output_tokens ?? 0 },
        searchQuery: search?.query,
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
        reqBody.tool_choice = forceVisuals ? "required" : "auto";
      }

      console.log("[generate-commentary] REQUEST", JSON.stringify({
        model: visionModel, provider: "gemini", max_tokens: effectiveMaxTokens,
        temperature, block_type, block_prompt, has_tools: !!providerTools,
        system_prompt_length: fullSystemPrompt.length, user_text: textParts.join(" | "),
      }));

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

      console.log("[generate-commentary] RESPONSE", JSON.stringify({
        model: visionModel, finish_reason: data.choices?.[0]?.finish_reason,
        usage: data.usage, raw_content_preview: (data.choices?.[0]?.message?.content ?? "").slice(0, 300),
      }));

      const reply = data.choices?.[0]?.message?.content?.trim() ?? "";
      const visuals = enable_visuals
        ? parseToolCalls("gemini", data)
        : [];
      const search = enable_visuals ? extractSearchToolCall("gemini", data) : null;
      return {
        text: reply,
        visuals,
        usage: { input_tokens: data.usage?.prompt_tokens ?? 0, output_tokens: data.usage?.completion_tokens ?? 0 },
        searchQuery: search?.query,
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

    // ── Handle request_search → Gemini search grounding ────────────
    if (result.searchQuery && GEMINI_API_KEY) {
      try {
        const searchRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `Answer concisely: ${result.searchQuery}` }] }],
              tools: [{ google_search: {} }],
              generationConfig: { maxOutputTokens: 300, temperature: 0.3 },
            }),
          },
        );
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          // Extract summary text from response
          const summaryParts = searchData.candidates?.[0]?.content?.parts ?? [];
          const summary = summaryParts
            .map((p: { text?: string }) => p.text ?? "")
            .join("")
            .trim();
          // Extract source URLs from grounding metadata
          const groundingChunks =
            searchData.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
          const sources: Array<{ title: string; uri: string }> = [];
          for (const chunk of groundingChunks) {
            if (chunk.web?.uri) {
              sources.push({
                title: chunk.web.title ?? chunk.web.uri,
                uri: chunk.web.uri,
              });
            }
          }
          if (summary) {
            result.visuals.push({
              id: `search-${crypto.randomUUID().slice(0, 8)}`,
              primitive: "search_panel",
              query: result.searchQuery,
              summary,
              sources: sources.slice(0, 8),
              position: "top-right",
              pinned: true,
              duration_ms: 60000,
            });
          }
        } else {
          console.error(`[generate-commentary] Search grounding ${searchRes.status}: ${await searchRes.text()}`);
        }
      } catch (searchErr) {
        console.error("[generate-commentary] Search grounding failed:", searchErr);
      }
    }

    // Check for [SILENCE]
    let text: string | null =
      result.text.toUpperCase().includes("[SILENCE]") ? null : result.text;

    // Hard word-count cap — models (especially Qwen3) often ignore max_tokens for text
    if (text) {
      const before = text;
      text = truncateToWordLimit(text, MAX_WORDS);
      if (text !== before) {
        console.log("[generate-commentary] TRUNCATED", JSON.stringify({
          original_words: before.split(/\s+/).length,
          truncated_words: text.split(/\s+/).length,
          original_preview: before.slice(0, 200),
        }));
      }
    }

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
