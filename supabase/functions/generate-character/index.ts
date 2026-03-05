// Edge function: generate-character (batch_id + voice dedup support)
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
  ActivityLogger,
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
  batch_id?: string;
  exclude_voice_ids?: string[];
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

  if (!pixelRes.ok) {
    const body = await pixelRes.text().catch(() => "");
    console.error(`[generateSpritePixelLab] ${pixelRes.status} ${pixelRes.statusText}: ${body}`);
    return null;
  }

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

  const model = geminiModel || "gemini-3.1-flash-image-preview";
  const imageSize = imageConfig?.imageSize ?? "1K";
  const aspectRatio = imageConfig?.aspectRatio ?? "1:1";

  const geminiRequest = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: { imageSize, aspectRatio },
    },
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const geminiRes = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(geminiRequest),
  });

  if (!geminiRes.ok) {
    const body = await geminiRes.text().catch(() => "");
    console.error(`[generateSpriteGemini] ${geminiRes.status} ${geminiRes.statusText}: ${body}`);
    return null;
  }

  const geminiData = await geminiRes.json();
  const parts = geminiData.candidates?.[0]?.content?.parts ?? [];
  // deno-lint-ignore no-explicit-any
  const imagePart = parts.find((p: any) =>
    (p.inline_data ?? p.inlineData)?.mime_type?.startsWith("image/") ||
    (p.inline_data ?? p.inlineData)?.mimeType?.startsWith("image/"),
  );
  const imageData = imagePart?.inline_data ?? imagePart?.inlineData;
  if (!imageData?.data) return null;

  const imageBytes = Uint8Array.from(atob(imageData.data), (c) => c.charCodeAt(0));
  const r2Key = characterPortraitKey(characterId);
  return await uploadToPublicBucket(r2Key, imageBytes, "image/png");
}

/** Generate sprite with retry (up to 2 attempts, 1s backoff). */
async function generateSpriteWithRetry(
  characterId: string,
  description: string,
  rarity: string,
  config: Record<string, unknown>,
  logger: ActivityLogger,
): Promise<string | null> {
  const imageProvider = (config.imageProvider as string) ?? "pixellab";
  const imageModel = config.imageModel as string | undefined;
  const imageConfig = config.imageConfig as { imageSize?: string; aspectRatio?: string } | undefined;
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    logger.log("sprite.generate.start", { attempt, provider: imageProvider });

    try {
      let url: string | null = null;
      if (imageProvider === "gemini") {
        const prompt = buildGeminiSpritePrompt(description, rarity);
        url = await generateSpriteGemini(characterId, prompt, imageModel, imageConfig);
      } else {
        const prompt = buildSpritePrompt(description, rarity);
        url = await generateSpritePixelLab(characterId, prompt);
      }

      if (url) {
        logger.log("sprite.generate.success", { attempt, provider: imageProvider, url });
        return url;
      }

      // null return means API returned non-ok or no image data
      const isLast = attempt === maxAttempts;
      if (isLast) {
        logger.error("sprite.generate.fail", { attempt, provider: imageProvider, reason: "null result" });
      } else {
        logger.warn("sprite.generate.fail", { attempt, provider: imageProvider, reason: "null result" });
      }
    } catch (err) {
      const isLast = attempt === maxAttempts;
      const errMsg = err instanceof Error ? err.message : String(err);
      if (isLast) {
        logger.error("sprite.generate.fail", { attempt, provider: imageProvider, error: errMsg });
      } else {
        logger.warn("sprite.generate.fail", { attempt, provider: imageProvider, error: errMsg });
      }
    }

    // Backoff before retry (skip on last attempt)
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return null;
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

/** Assign per-character topics based on rarity and global weights, then refine via LLM. */
async function assignTopics(
  character: Record<string, unknown>,
  config: Record<string, unknown>,
): Promise<{ topic_assignments: Record<string, number>; custom_topics: { key: string; label: string; prompt: string; weight: number }[] }> {
  const rarity = (character.rarity as string) ?? "common";
  const personality = (character.personality as Record<string, number>) ?? {};
  const commentary = (config.commentary as Record<string, unknown>) ?? {};

  // Read config
  const globalWeights = ((commentary.topicWeights ?? commentary.blockWeights) as Record<string, number>) ?? {};
  const topicCountByRarity = (config.topicCountByRarity as Record<string, { min: number; max: number }>) ?? {
    common: { min: 3, max: 4 },
    rare: { min: 5, max: 6 },
    epic: { min: 7, max: 8 },
    legendary: { min: 9, max: 10 },
  };
  const legendaryCustomTopicCount = (config.legendaryCustomTopicCount as number) ?? 2;
  const range = topicCountByRarity[rarity] ?? { min: 3, max: 4 };
  const targetCount = range.min + Math.floor(Math.random() * (range.max - range.min + 1));

  // Always include baseline topics if they exist
  const baselines = ["solo_observation", "silence"];
  const selectedKeys = new Set<string>();
  for (const key of baselines) {
    if (key in globalWeights) selectedKeys.add(key);
  }

  // Weighted random selection for remaining slots
  const candidates = Object.entries(globalWeights).filter(([k]) => !selectedKeys.has(k));
  const totalWeight = candidates.reduce((sum, [, w]) => sum + w, 0);
  while (selectedKeys.size < targetCount && candidates.length > 0) {
    let roll = Math.random() * totalWeight;
    for (let i = 0; i < candidates.length; i++) {
      roll -= candidates[i][1];
      if (roll <= 0) {
        selectedKeys.add(candidates[i][0]);
        candidates.splice(i, 1);
        break;
      }
    }
  }

  // Assign weights using global weight as the starting point
  const topic_assignments: Record<string, number> = {};
  for (const key of selectedKeys) {
    topic_assignments[key] = globalWeights[key] ?? 5;
  }

  // LLM weight refinement — brief call to tune weights to character personality
  const model = (config.model as string) ?? "qwen-plus";
  try {
    const topicList = Object.entries(topic_assignments)
      .map(([k, w]) => `- ${k} (current weight: ${w})`)
      .join("\n");
    const traitSummary = Object.entries(personality)
      .map(([t, v]) => `${t}: ${v}`)
      .join(", ");

    const refineRes = await fetch(`${DASHSCOPE_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You assign topic weights for a gaming commentary character. Return ONLY valid JSON: { \"topic_key\": weight_number, ... }. Weights should be 1-100.",
          },
          {
            role: "user",
            content: `Given this character's personality, adjust the weights for these commentary topics:\n\nCharacter: ${character.name}, ${character.description}\nPersonality: ${traitSummary}\n\nTopics:\n${topicList}\n\nReturn JSON with adjusted weights (1-100) for each topic. Keep the same keys.`,
          },
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    const refineData = await refineRes.json();
    const refineContent = refineData.choices?.[0]?.message?.content;
    if (refineContent) {
      const refined = parseJsonResponse(refineContent) as Record<string, number>;
      for (const [key, weight] of Object.entries(refined)) {
        if (key in topic_assignments && typeof weight === "number") {
          topic_assignments[key] = Math.max(1, Math.min(100, Math.round(weight)));
        }
      }
    }
  } catch {
    // LLM refinement failed — use algorithmic weights, which is fine
  }

  // Legendary custom topics
  const custom_topics: { key: string; label: string; prompt: string; weight: number }[] = [];
  if (rarity === "legendary" && legendaryCustomTopicCount > 0) {
    try {
      const customRes = await fetch(`${DASHSCOPE_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: `You create unique commentary topics for legendary gaming commentator characters. Return ONLY a valid JSON array of objects with fields: key (snake_case identifier), label (display name), prompt (instruction for the AI when this topic is selected, 1-2 sentences), weight (1-100).`,
            },
            {
              role: "user",
              content: `Generate ${legendaryCustomTopicCount} unique commentary topics for this legendary character:\n\nName: ${character.name}\nBackstory: ${character.backstory}\nDescription: ${character.description}\nPersonality: ${Object.entries(personality).map(([t, v]) => `${t}: ${v}`).join(", ")}\n\nThese topics should be unique to this character and reflect their personality, background, or interests. Return a JSON array.`,
            },
          ],
          max_tokens: 500,
          temperature: 0.9,
        }),
      });

      const customData = await customRes.json();
      const customContent = customData.choices?.[0]?.message?.content;
      if (customContent) {
        const parsed = JSON.parse(
          customContent.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, ""),
        );
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item.key && item.label && item.prompt) {
              custom_topics.push({
                key: String(item.key),
                label: String(item.label),
                prompt: String(item.prompt),
                weight: Math.max(1, Math.min(100, Math.round(Number(item.weight) || 20))),
              });
            }
          }
        }
      }
    } catch {
      // Custom topic generation failed — legendary still works, just no custom topics
    }
  }

  return { topic_assignments, custom_topics };
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const serviceClient = getServiceClient();
  let logger: ActivityLogger | null = null;

  try {
    const auth = await getRequestUser(req);
    if ("error" in auth) return auth.error;

    // Parse request body
    let rarity = "common";
    let batchId: string | undefined;
    let excludeVoiceIds: string[] = [];
    try {
      const body: GenerateRequest = await req.json();
      if (body.rarity) rarity = body.rarity;
      if (body.batch_id) batchId = body.batch_id;
      if (body.exclude_voice_ids) excludeVoiceIds = body.exclude_voice_ids;
    } catch {
      // Default to common if no body
    }

    const requestId = crypto.randomUUID();
    logger = new ActivityLogger(serviceClient, auth.user.id, {
      scope: "character",
      requestId,
    });

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

    // Generate character text
    let character: Record<string, unknown>;
    try {
      character = await generateCharacter(rarity, config);
      logger.log("text.generate.success", {
        rarity,
        name: character.name,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error("text.generate.fail", { rarity, error: errMsg });
      await logger.flush();
      throw err;
    }

    // Assign per-character topics
    let topicResult: { topic_assignments: Record<string, number>; custom_topics: { key: string; label: string; prompt: string; weight: number }[] } = { topic_assignments: {}, custom_topics: [] };
    try {
      topicResult = await assignTopics(character, config);
      logger.log("topics.assign.success", {
        rarity,
        topicCount: Object.keys(topicResult.topic_assignments).length,
        customCount: topicResult.custom_topics.length,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.warn("topics.assign.fail", { rarity, error: errMsg });
      // Non-fatal — character works without topic assignments
    }

    // Assign random voice from Fish Audio (excluding already-used voices)
    const voices = await fetchVoices();
    const excludeSet = new Set(excludeVoiceIds);
    const available = excludeSet.size > 0
      ? voices.filter((v) => !excludeSet.has(v.id))
      : voices;
    let voiceId: string | null = null;
    let voiceName: string | null = null;
    const voicePool = available.length > 0 ? available : voices; // fallback to all if none left
    if (voicePool.length > 0) {
      const pick = voicePool[Math.floor(Math.random() * voicePool.length)];
      voiceId = pick.id;
      voiceName = pick.name;
      logger.log("voice.assign.success", { voiceId, voiceName, excluded: excludeSet.size });
    } else {
      logger.warn("voice.assign.skip", { reason: "no voices available" });
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
        topic_assignments: topicResult.topic_assignments,
        custom_topics: topicResult.custom_topics,
        ...(batchId ? { batch_id: batchId } : {}),
      })
      .select()
      .single();

    if (insertError) {
      logger.error("db.insert.fail", { error: insertError.message });
      await logger.flush();
      return errorResponse(insertError.message);
    }

    logger.setCharacterId(inserted.id);
    logger.log("db.insert.success", { characterId: inserted.id });

    // Generate sprite image with retry (up to 2 attempts)
    const avatarUrl = await generateSpriteWithRetry(
      inserted.id,
      (character.description as string) ?? "",
      rarity,
      config,
      logger,
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
          logger.log("tts.tagline.success", { taglineUrl });
        } else {
          const body = await ttsRes.text().catch(() => "");
          logger.error("tts.tagline.fail", { status: ttsRes.status, body });
        }
      } catch (ttsErr) {
        const errMsg = ttsErr instanceof Error ? ttsErr.message : String(ttsErr);
        console.error("[generate-character] TTS/R2 upload failed:", ttsErr);
        logger.error("tts.tagline.fail", { error: errMsg });
      }
    }

    if (Object.keys(updateFields).length > 0) {
      await serviceClient
        .from("characters")
        .update(updateFields)
        .eq("id", inserted.id);
    }

    await logger.flush();
    return jsonResponse(inserted);
  } catch (err) {
    console.error("[generate-character]", err);
    if (logger) {
      await logger.flush();
    }
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message);
  }
});
