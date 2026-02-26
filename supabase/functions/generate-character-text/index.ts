import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  handleCors,
  jsonResponse,
  errorResponse,
  getRequestUser,
  getServiceClient,
  rollTokenPools,
  buildDirective,
} from "../_shared/mod.ts";
import type { TokenPools } from "../_shared/mod.ts";

const DASHSCOPE_API_KEY = Deno.env.get("DASHSCOPE_API_KEY") ?? "";
const DASHSCOPE_BASE_URL =
  Deno.env.get("DASHSCOPE_BASE_URL") ??
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";

interface GenerateTextRequest {
  rarity: string;
  tokenRoll?: Record<string, string>;
}

function parseJsonResponse(text: string): Record<string, unknown> {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "");
  }
  return JSON.parse(cleaned);
}

function clampTraits(
  personality: Record<string, number>,
  min: number,
  max: number,
): Record<string, number> {
  const traits = [
    "energy",
    "positivity",
    "formality",
    "talkativeness",
    "attitude",
    "humor",
  ];
  const clamped: Record<string, number> = {};
  for (const t of traits) {
    const val = typeof personality[t] === "number" ? personality[t] : 50;
    clamped[t] = Math.max(min, Math.min(max, Math.round(val)));
  }
  return clamped;
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = await getRequestUser(req);
    if ("error" in auth) return auth.error;

    let rarity = "common";
    let clientTokenRoll: Record<string, string> | undefined;
    try {
      const body: GenerateTextRequest = await req.json();
      if (body.rarity) rarity = body.rarity;
      if (body.tokenRoll && typeof body.tokenRoll === "object") {
        clientTokenRoll = body.tokenRoll;
      }
    } catch {
      // Default to common
    }

    const serviceClient = getServiceClient();

    // Fetch gacha config
    const { data: configRow, error: configError } = await serviceClient
      .from("gacha_config")
      .select("config")
      .eq("id", "default")
      .single();

    if (configError || !configRow) {
      return errorResponse("Gacha config not found");
    }

    const config = configRow.config as Record<string, unknown>;
    const traitRanges = config.traitRanges as Record<
      string,
      { min: number; max: number }
    >;
    const promptQuality = config.promptQuality as Record<
      string,
      { maxTokens: number; tempBoost: number }
    >;
    const rarityGuidance = config.rarityGuidance as Record<string, string>;
    const baseTemp = (config.baseTemperature as number) ?? 0.9;
    const model = (config.model as string) ?? "qwen-plus";
    const generationPrompt = (config.generationPrompt as string) ?? "";

    const quality = promptQuality[rarity] ?? { maxTokens: 800, tempBoost: 0 };
    const guidance = rarityGuidance[rarity] ?? "";
    const range = traitRanges[rarity] ?? { min: 25, max: 75 };

    const systemPrompt = `${generationPrompt}\n\nRarity: ${rarity.toUpperCase()}\n${guidance}\n\nPersonality trait values must be integers between ${range.min} and ${range.max}.\n\nAlso include a "tagline" field: a short catchphrase (max 10 words) that captures the character's personality — this appears on their card.\n\nIMPORTANT: Every character MUST be completely different from any previous generation. Do not repeat names, archetypes, or themes. Be wildly creative.`;
    const temperature = baseTemp + quality.tempBoost;

    // Fetch recently created character names to explicitly exclude them
    const { data: recentChars } = await serviceClient
      .from("characters")
      .select("name")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const recentNames = (recentChars ?? []).map(
      (c: { name: string }) => c.name,
    );
    const avoidClause =
      recentNames.length > 0
        ? `\n\nDo NOT reuse or closely resemble any of these existing character names: ${recentNames.join(", ")}. Create something completely different.`
        : "";

    // Use client-provided token roll if available, otherwise roll server-side
    const tokenPools = config.tokenPools as TokenPools | undefined;
    const tokenRoll = clientTokenRoll
      ? clientTokenRoll
      : tokenPools
        ? rollTokenPools(tokenPools)
        : null;
    const directive = tokenRoll ? buildDirective(tokenRoll) : "";

    // Build the Dashscope request — random seed ensures different sampling each call
    const dashscopeRequest = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Generate a ${rarity} rarity character.${directive}${avoidClause} Return ONLY valid JSON.`,
        },
      ],
      max_tokens: quality.maxTokens,
      temperature,
      seed: Math.floor(Math.random() * 2147483647),
    };

    // Build a Set of existing names for duplicate detection
    const existingNames = new Set(
      recentNames.map((n: string) => n.toLowerCase()),
    );

    let lastError: Error | null = null;
    let dashscopeResponse: Record<string, unknown> | null = null;
    let character: Record<string, unknown> | null = null;

    // Up to 3 attempts: retry on parse failure OR duplicate name
    for (let attempt = 0; attempt < 3; attempt++) {
      // Use a fresh seed each attempt
      dashscopeRequest.seed = Math.floor(Math.random() * 2147483647);

      const res = await fetch(`${DASHSCOPE_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        },
        body: JSON.stringify(dashscopeRequest),
      });

      const data = await res.json();
      dashscopeResponse = data;
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        lastError = new Error("No content in Dashscope response");
        continue;
      }

      try {
        const parsed = parseJsonResponse(content);
        const personality = clampTraits(
          (parsed.personality as Record<string, number>) ?? {},
          range.min,
          range.max,
        );

        const generatedName = (parsed.name as string) ?? "Unknown";

        // Check for duplicate name — retry if collision
        if (existingNames.has(generatedName.toLowerCase())) {
          console.log(
            `[generate-character-text] Duplicate name "${generatedName}" on attempt ${attempt + 1}, retrying...`,
          );
          lastError = new Error(`Duplicate name: ${generatedName}`);
          continue;
        }

        character = {
          name: generatedName,
          description: parsed.description ?? "",
          backstory: parsed.backstory ?? "",
          system_prompt: parsed.system_prompt ?? "",
          tagline: parsed.tagline ?? "",
          personality,
          rarity,
        };
        break;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }

    // Final fallback: if still a duplicate name after retries, append a suffix
    if (
      character &&
      existingNames.has((character.name as string).toLowerCase())
    ) {
      const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
      character.name = `${character.name} ${suffix}`;
      console.log(
        `[generate-character-text] All retries produced duplicates, using suffix: ${character.name}`,
      );
    }

    if (!character) {
      throw lastError ?? new Error("Failed to generate character text");
    }

    // Build generation metadata for step 1
    const step1Metadata = {
      request: dashscopeRequest,
      response: dashscopeResponse ?? {},
      timestamp: new Date().toISOString(),
      ...(tokenRoll ? { tokenRoll } : {}),
    };

    // Insert character (text only — no image or voice)
    const { data: inserted, error: insertError } = await serviceClient
      .from("characters")
      .insert({
        user_id: auth.user.id,
        name: character.name as string,
        description: character.description as string,
        backstory: character.backstory as string,
        system_prompt: character.system_prompt as string,
        tagline: (character.tagline as string) || "",
        personality: character.personality,
        rarity,
        generation_metadata: { step1_text: step1Metadata },
      })
      .select()
      .single();

    if (insertError) return errorResponse(insertError.message);

    return jsonResponse(inserted);
  } catch (err) {
    console.error("[generate-character-text]", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message);
  }
});
