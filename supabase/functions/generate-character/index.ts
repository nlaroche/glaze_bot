import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  handleCors,
  jsonResponse,
  errorResponse,
  getRequestUser,
  getServiceClient,
  uploadToPublicBucket,
  characterPortraitKey,
  characterTaglineKey,
  rollTokenPools,
  buildDirective,
} from "../_shared/mod.ts";
import type { TokenPools } from "../_shared/mod.ts";

const DASHSCOPE_API_KEY = Deno.env.get("DASHSCOPE_API_KEY") ?? "";
const DASHSCOPE_BASE_URL =
  Deno.env.get("DASHSCOPE_BASE_URL") ??
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const FISH_AUDIO_API_KEY = Deno.env.get("FISH_AUDIO_API_KEY") ?? "";
const PIXELLAB_API_KEY = Deno.env.get("PIXELLAB_API_KEY") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

interface GenerateRequest {
  rarity: string;
}

async function fetchVoices(): Promise<{ id: string; name: string }[]> {
  try {
    const res = await fetch(
      "https://api.fish.audio/model?page_size=100&self=true",
      { headers: { Authorization: `Bearer ${FISH_AUDIO_API_KEY}` } },
    );
    const data = await res.json();
    return (data.items ?? []).map((v: { _id: string; title: string }) => ({
      id: v._id,
      name: v.title,
    }));
  } catch {
    return [];
  }
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

const RACES = ["robot", "human", "elf", "goblin", "catfolk", "dragon-kin", "skeleton", "slime"];
const ACCESSORIES = [
  "wearing headphones", "with a gaming controller", "holding a microphone",
  "with glowing eyes", "wearing a crown", "with a tiny pet",
  "wearing sunglasses", "with a cape", "holding a trophy", "with floating sparkles",
];

function buildSpritePrompt(description: string, rarity: string): string {
  const race = RACES[Math.floor(Math.random() * RACES.length)];
  const accessory = ACCESSORIES[Math.floor(Math.random() * ACCESSORIES.length)];
  const rarityStyle: Record<string, string> = {
    common: "simple pixel art style, clean colors",
    rare: "detailed pixel art, slightly glowing outline",
    epic: "elaborate pixel art, magical aura, vibrant colors",
    legendary: "premium pixel art, golden accents, radiant glow, legendary aura",
  };
  return `A ${race} character, ${description}, ${accessory}, sitting at a gaming desk, ${rarityStyle[rarity] ?? "pixel art style"}, front-facing portrait, 128x128 sprite`;
}

function buildGeminiSpritePrompt(description: string, rarity: string): string {
  const race = RACES[Math.floor(Math.random() * RACES.length)];
  const accessory = ACCESSORIES[Math.floor(Math.random() * ACCESSORIES.length)];
  const rarityStyle: Record<string, string> = {
    common: "clean and simple design with solid colors",
    rare: "polished design with a subtle glow effect around the character",
    epic: "elaborate design with magical aura effects and vibrant, saturated colors",
    legendary: "premium design with golden accents, radiant glow, and a legendary aura emanating from the character",
  };
  return `Generate a character portrait of a ${race}, ${description}, ${accessory}, sitting at a gaming desk. Style: ${rarityStyle[rarity] ?? "stylized character art"}. The portrait should be front-facing, centered, with a clean background. Pixel art style, suitable for a game avatar.`;
}

async function generateSpritePixelLab(
  characterId: string,
  prompt: string,
): Promise<string | null> {
  if (!PIXELLAB_API_KEY) return null;

  const pixelRes = await fetch("https://api.pixellab.ai/v1/generate-image-pixflux", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PIXELLAB_API_KEY}`,
    },
    body: JSON.stringify({ description: prompt, image_size: { width: 128, height: 128 }, no_background: true }),
  });

  if (!pixelRes.ok) return null;

  const pixelData = await pixelRes.json();
  const base64Str: string = pixelData.image?.base64 ?? "";
  const raw = base64Str.includes(",") ? base64Str.split(",")[1] : base64Str;
  const imageBytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  const r2Key = characterPortraitKey(characterId);
  return await uploadToPublicBucket(r2Key, imageBytes, "image/png");
}

async function generateSpriteGemini(
  characterId: string,
  prompt: string,
  geminiModel?: string,
  imageConfig?: { imageSize?: string; aspectRatio?: string },
): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;

  const model = geminiModel || "gemini-2.0-flash-preview-image-generation";
  const imageSize = imageConfig?.imageSize ?? "1024x1024";
  const aspectRatio = imageConfig?.aspectRatio ?? "1:1";

  const geminiRequest = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageGenerationConfig: { imageSize, aspectRatio },
    },
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const geminiRes = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(geminiRequest),
  });

  if (!geminiRes.ok) return null;

  const geminiData = await geminiRes.json();
  const parts = geminiData.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find(
    (p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData?.mimeType?.startsWith("image/"),
  );
  if (!imagePart?.inlineData?.data) return null;

  const imageBytes = Uint8Array.from(atob(imagePart.inlineData.data), (c) => c.charCodeAt(0));
  const r2Key = characterPortraitKey(characterId);
  return await uploadToPublicBucket(r2Key, imageBytes, "image/png");
}

async function generateSprite(
  characterId: string,
  description: string,
  rarity: string,
  config: Record<string, unknown>,
): Promise<string | null> {
  const imageProvider = (config.imageProvider as string) ?? "pixellab";
  const imageModel = config.imageModel as string | undefined;
  const imageConfig = config.imageConfig as { imageSize?: string; aspectRatio?: string } | undefined;

  try {
    if (imageProvider === "gemini") {
      const prompt = buildGeminiSpritePrompt(description, rarity);
      return await generateSpriteGemini(characterId, prompt, imageModel, imageConfig);
    } else {
      const prompt = buildSpritePrompt(description, rarity);
      return await generateSpritePixelLab(characterId, prompt);
    }
  } catch {
    return null;
  }
}

async function generateCharacter(
  rarity: string,
  config: Record<string, unknown>,
): Promise<Record<string, unknown>> {
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

  const systemPrompt = `${generationPrompt}\n\nRarity: ${rarity.toUpperCase()}\n${guidance}\n\nPersonality trait values must be integers between ${range.min} and ${range.max}.\n\nAlso include a "tagline" field: a short catchphrase (max 10 words) that captures the character's personality — this appears on their card.`;
  const temperature = baseTemp + quality.tempBoost;

  // Roll token pools for diversity (if configured)
  const tokenPools = config.tokenPools as TokenPools | undefined;
  const tokenRoll = tokenPools ? rollTokenPools(tokenPools) : null;
  const directive = tokenRoll ? buildDirective(tokenRoll) : "";

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${DASHSCOPE_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Generate a ${rarity} rarity character.${directive} Return ONLY valid JSON.`,
          },
        ],
        max_tokens: quality.maxTokens,
        temperature,
      }),
    });

    const data = await res.json();
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

      return {
        name: parsed.name ?? "Unknown",
        description: parsed.description ?? "",
        backstory: parsed.backstory ?? "",
        system_prompt: parsed.system_prompt ?? "",
        tagline: parsed.tagline ?? "",
        personality,
        rarity,
      };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastError ?? new Error("Failed to generate character");
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = await getRequestUser(req);
    if ("error" in auth) return auth.error;

    // Parse request body
    let rarity = "common";
    try {
      const body: GenerateRequest = await req.json();
      if (body.rarity) rarity = body.rarity;
    } catch {
      // Default to common if no body
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
    const character = await generateCharacter(rarity, config);

    // Assign random voice from Fish Audio
    const voices = await fetchVoices();
    let voiceId: string | null = null;
    let voiceName: string | null = null;
    if (voices.length > 0) {
      const pick = voices[Math.floor(Math.random() * voices.length)];
      voiceId = pick.id;
      voiceName = pick.name;
    }

    const tagline = (character.tagline as string) || "";

    // Insert character via service role
    const { data: inserted, error: insertError } = await serviceClient
      .from("characters")
      .insert({
        user_id: auth.user.id,
        name: character.name as string,
        description: character.description as string,
        backstory: character.backstory as string,
        system_prompt: character.system_prompt as string,
        tagline,
        personality: character.personality,
        rarity,
        voice_id: voiceId,
        voice_name: voiceName,
      })
      .select()
      .single();

    if (insertError) return errorResponse(insertError.message);

    // Generate sprite image (non-blocking — character is valid without it)
    const avatarUrl = await generateSprite(
      inserted.id,
      (character.description as string) ?? "",
      rarity,
      config,
    );

    const updateFields: Record<string, unknown> = {};
    if (avatarUrl) {
      updateFields.avatar_url = avatarUrl;
      inserted.avatar_url = avatarUrl;
    }

    // Generate tagline voice line via Fish Audio TTS
    if (tagline && voiceId && FISH_AUDIO_API_KEY) {
      try {
        const ttsRes = await fetch("https://api.fish.audio/v1/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${FISH_AUDIO_API_KEY}`,
            model: "s1",
          },
          body: JSON.stringify({
            reference_id: voiceId,
            text: tagline,
            format: "mp3",
          }),
        });
        if (ttsRes.ok) {
          const audioData = new Uint8Array(await ttsRes.arrayBuffer());
          const taglineUrl = await uploadToPublicBucket(
            characterTaglineKey(inserted.id),
            audioData,
            "audio/mpeg",
          );
          updateFields.tagline_url = taglineUrl;
          inserted.tagline_url = taglineUrl;
        }
      } catch (ttsErr) {
        console.error("[generate-character] TTS/R2 upload failed:", ttsErr);
      }
    }

    if (Object.keys(updateFields).length > 0) {
      await serviceClient
        .from("characters")
        .update(updateFields)
        .eq("id", inserted.id);
    }

    return jsonResponse(inserted);
  } catch (err) {
    console.error("[generate-character]", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message);
  }
});
