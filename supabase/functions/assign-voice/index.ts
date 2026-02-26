import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  handleCors,
  jsonResponse,
  errorResponse,
  getRequestUser,
  getServiceClient,
  uploadToPublicBucket,
  characterTaglineKey,
} from "../_shared/mod.ts";

const FISH_AUDIO_API_KEY = Deno.env.get("FISH_AUDIO_API_KEY") ?? "";

interface AssignVoiceRequest {
  character_id: string;
  voice_id?: string;
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

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = await getRequestUser(req);
    if ("error" in auth) return auth.error;

    const body: AssignVoiceRequest = await req.json();
    const { character_id, voice_id: requestedVoiceId } = body;

    if (!character_id) {
      return errorResponse("character_id is required", 400);
    }

    if (!FISH_AUDIO_API_KEY) {
      return errorResponse("Fish Audio API key not configured", 500);
    }

    // Fetch available voices
    const voices = await fetchVoices();
    if (voices.length === 0) {
      return errorResponse("No voices available from Fish Audio");
    }

    // Pick voice: use requested ID or random
    let selectedVoice: { id: string; name: string };
    if (requestedVoiceId) {
      const found = voices.find((v) => v.id === requestedVoiceId);
      if (!found) {
        return errorResponse("Requested voice not found", 404);
      }
      selectedVoice = found;
    } else {
      selectedVoice = voices[Math.floor(Math.random() * voices.length)];
    }

    const serviceClient = getServiceClient();

    // Fetch character to get tagline and existing metadata
    const { data: existing } = await serviceClient
      .from("characters")
      .select("tagline, generation_metadata")
      .eq("id", character_id)
      .single();

    const existingMetadata = (existing?.generation_metadata as Record<string, unknown>) ?? {};
    const tagline = (existing?.tagline as string) ?? "";

    // Generate tagline voice line if tagline exists
    let taglineUrl: string | null = null;
    let ttsInfo: Record<string, unknown> = {};
    if (tagline) {
      try {
        const ttsRes = await fetch("https://api.fish.audio/v1/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${FISH_AUDIO_API_KEY}`,
          },
          body: JSON.stringify({
            reference_id: selectedVoice.id,
            text: tagline,
            format: "mp3",
          }),
        });

        if (ttsRes.ok) {
          const audioData = new Uint8Array(await ttsRes.arrayBuffer());
          const r2Key = characterTaglineKey(character_id);
          taglineUrl = await uploadToPublicBucket(r2Key, audioData, "audio/mpeg");
          ttsInfo = { tagline_tts: { size: audioData.byteLength, key: r2Key } };
        } else {
          const errText = await ttsRes.text().catch(() => "");
          console.error(`[assign-voice] TTS returned ${ttsRes.status}: ${errText}`);
        }
      } catch (ttsErr) {
        console.error("[assign-voice] TTS/R2 upload failed:", ttsErr);
        // TTS failure is non-fatal — voice is still assigned
      }
    }

    // Build step 3 metadata
    const step3Metadata = {
      request: { character_id, voice_id: requestedVoiceId ?? "random" },
      response: { selected_voice: selectedVoice, available_count: voices.length, ...ttsInfo },
      timestamp: new Date().toISOString(),
    };

    // Update character
    const updateFields: Record<string, unknown> = {
      voice_id: selectedVoice.id,
      voice_name: selectedVoice.name,
      generation_metadata: { ...existingMetadata, step3_voice: step3Metadata },
    };
    if (taglineUrl) {
      updateFields.tagline_url = taglineUrl;
    }

    const { error: updateError } = await serviceClient
      .from("characters")
      .update(updateFields)
      .eq("id", character_id);

    if (updateError) {
      return errorResponse(`Failed to update character: ${updateError.message}`);
    }

    return jsonResponse({
      voice_id: selectedVoice.id,
      voice_name: selectedVoice.name,
      tagline_url: taglineUrl,
      voices,
    });
  } catch (err) {
    console.error("[assign-voice]", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message);
  }
});
