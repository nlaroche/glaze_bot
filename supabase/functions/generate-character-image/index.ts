import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  handleCors,
  jsonResponse,
  errorResponse,
  getRequestUser,
  getServiceClient,
  uploadToPublicBucket,
  characterPortraitKey,
} from "../_shared/mod.ts";

const PIXELLAB_API_KEY = Deno.env.get("PIXELLAB_API_KEY") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

interface ImageRequest {
  character_id: string;
  prompt: string;
  provider?: "pixellab" | "gemini";
  model?: string;
  imageConfig?: {
    imageSize?: string;
    aspectRatio?: string;
  };
}

// ─── PixelLab Provider ──────────────────────────────────────────────

async function generateWithPixelLab(
  prompt: string,
): Promise<{ imageBytes: Uint8Array; metadata: Record<string, unknown> }> {
  if (!PIXELLAB_API_KEY) {
    throw new Error("PixelLab API key not configured");
  }

  const pixelLabRequest = {
    description: prompt,
    image_size: { width: 128, height: 128 },
    no_background: true,
  };

  const pixelRes = await fetch("https://api.pixellab.ai/v1/generate-image-pixflux", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PIXELLAB_API_KEY}`,
    },
    body: JSON.stringify(pixelLabRequest),
  });

  if (!pixelRes.ok) {
    const errText = await pixelRes.text();
    console.error(`[generate-character-image] PixelLab ${pixelRes.status}: ${errText}`);
    throw new Error(`PixelLab API error: ${errText}`);
  }

  const pixelData = await pixelRes.json();
  const base64Str: string = pixelData.image?.base64 ?? "";
  const raw = base64Str.includes(",") ? base64Str.split(",")[1] : base64Str;
  const imageBytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));

  return {
    imageBytes,
    metadata: {
      provider: "pixellab",
      request: pixelLabRequest,
      response: { status: pixelRes.status, size: imageBytes.byteLength },
    },
  };
}

// ─── Gemini Provider ────────────────────────────────────────────────

async function generateWithGemini(
  prompt: string,
  model: string,
  imageConfig?: { imageSize?: string; aspectRatio?: string },
): Promise<{ imageBytes: Uint8Array; metadata: Record<string, unknown> }> {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key not configured");
  }

  const geminiModel = model || "gemini-2.0-flash-preview-image-generation";
  const imageSize = imageConfig?.imageSize ?? "1024x1024";
  const aspectRatio = imageConfig?.aspectRatio ?? "1:1";

  const geminiRequest = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageGenerationConfig: {
        imageSize,
        aspectRatio,
      },
    },
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`;

  const geminiRes = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(geminiRequest),
  });

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    console.error(`[generate-character-image] Gemini ${geminiRes.status}: ${errText}`);
    throw new Error(`Gemini API error: ${errText}`);
  }

  const geminiData = await geminiRes.json();

  // Extract image from response parts
  const candidates = geminiData.candidates ?? [];
  const parts = candidates[0]?.content?.parts ?? [];
  const imagePart = parts.find(
    (p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData?.mimeType?.startsWith("image/"),
  );

  if (!imagePart?.inlineData?.data) {
    console.error("[generate-character-image] Gemini response had no image data:", JSON.stringify(geminiData).slice(0, 500));
    throw new Error("Gemini returned no image data");
  }

  const imageBytes = Uint8Array.from(atob(imagePart.inlineData.data), (c) => c.charCodeAt(0));

  return {
    imageBytes,
    metadata: {
      provider: "gemini",
      model: geminiModel,
      imageSize,
      aspectRatio,
      response: { status: geminiRes.status, size: imageBytes.byteLength },
    },
  };
}

// ─── Main Handler ───────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = await getRequestUser(req);
    if ("error" in auth) return auth.error;

    const body: ImageRequest = await req.json();
    const { character_id, prompt, provider = "pixellab", model, imageConfig } = body;

    if (!character_id) {
      return errorResponse("character_id is required", 400);
    }

    if (!prompt) {
      return errorResponse("prompt is required", 400);
    }

    // Route to the selected provider
    let result: { imageBytes: Uint8Array; metadata: Record<string, unknown> };
    if (provider === "gemini") {
      result = await generateWithGemini(prompt, model ?? "", imageConfig);
    } else {
      result = await generateWithPixelLab(prompt);
    }

    const serviceClient = getServiceClient();

    // Upload to R2
    const r2Key = characterPortraitKey(character_id);
    const avatarUrl = await uploadToPublicBucket(r2Key, result.imageBytes, "image/png");

    // Build step 2 metadata
    const step2Metadata = {
      ...result.metadata,
      storage: { provider: "r2", key: r2Key },
      timestamp: new Date().toISOString(),
    };

    // Fetch existing metadata to merge
    const { data: existing } = await serviceClient
      .from("characters")
      .select("generation_metadata")
      .eq("id", character_id)
      .single();

    const existingMetadata = (existing?.generation_metadata as Record<string, unknown>) ?? {};

    // Update character record with avatar URL and metadata
    const { error: updateError } = await serviceClient
      .from("characters")
      .update({
        avatar_url: avatarUrl,
        generation_metadata: { ...existingMetadata, step2_image: step2Metadata },
      })
      .eq("id", character_id);

    if (updateError) {
      return errorResponse(`Failed to update character: ${updateError.message}`);
    }

    return jsonResponse({ avatar_url: avatarUrl });
  } catch (err) {
    console.error("[generate-character-image]", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message);
  }
});
