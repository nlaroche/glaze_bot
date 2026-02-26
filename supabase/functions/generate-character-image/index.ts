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

interface ImageRequest {
  character_id: string;
  prompt: string;
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = await getRequestUser(req);
    if ("error" in auth) return auth.error;

    const body: ImageRequest = await req.json();
    const { character_id, prompt } = body;

    if (!character_id) {
      return errorResponse("character_id is required", 400);
    }

    if (!prompt) {
      return errorResponse("prompt is required", 400);
    }

    if (!PIXELLAB_API_KEY) {
      return errorResponse("PixelLab API key not configured", 500);
    }

    const pixelLabRequest = {
      description: prompt,
      image_size: { width: 128, height: 128 },
      no_background: true,
    };

    // Call PixelLab API
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
      return errorResponse(`PixelLab API error: ${errText}`, 502);
    }

    // PixelLab returns JSON with base64-encoded image
    const pixelData = await pixelRes.json();
    const base64Str: string = pixelData.image?.base64 ?? "";
    // Strip data URI prefix if present (e.g. "data:image/png;base64,...")
    const raw = base64Str.includes(",") ? base64Str.split(",")[1] : base64Str;
    const imageBytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));

    const serviceClient = getServiceClient();

    // Upload to R2
    const r2Key = characterPortraitKey(character_id);
    const avatarUrl = await uploadToPublicBucket(r2Key, imageBytes, "image/png");

    // Build step 2 metadata
    const step2Metadata = {
      request: pixelLabRequest,
      response: { status: pixelRes.status, size: imageBytes.byteLength },
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
