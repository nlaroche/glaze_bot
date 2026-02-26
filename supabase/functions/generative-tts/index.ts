import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  handleCors,
  corsHeaders,
  errorResponse,
  getRequestUser,
} from "../_shared/mod.ts";

const FISH_AUDIO_API_KEY = Deno.env.get("FISH_AUDIO_API_KEY") ?? "";

interface GenerativeTtsRequest {
  text: string;
  reference_id?: string | null;
  temperature?: number;
  top_p?: number;
  repetition_penalty?: number;
  speed?: number;
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = await getRequestUser(req);
    if ("error" in auth) return auth.error;

    const body: GenerativeTtsRequest = await req.json();
    const { text, reference_id, temperature, top_p, repetition_penalty, speed } = body;

    if (!text) {
      return errorResponse("text is required", 400);
    }

    if (!FISH_AUDIO_API_KEY) {
      return errorResponse("Fish Audio API key not configured", 500);
    }

    // Build TTS payload — omit reference_id entirely if not provided
    const ttsBody: Record<string, unknown> = {
      text,
      format: "mp3",
    };

    if (reference_id) {
      ttsBody.reference_id = reference_id;
    }
    if (temperature !== undefined) {
      ttsBody.temperature = temperature;
    }
    if (top_p !== undefined) {
      ttsBody.top_p = top_p;
    }
    if (repetition_penalty !== undefined) {
      ttsBody.repetition_penalty = repetition_penalty;
    }
    if (speed !== undefined) {
      ttsBody.prosody = { speed };
    }

    const ttsRes = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FISH_AUDIO_API_KEY}`,
        model: "s1",
      },
      body: JSON.stringify(ttsBody),
    });

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      console.error(`[generative-tts] Fish Audio returned ${ttsRes.status}: ${errText}`);
      return errorResponse(`Fish Audio API error (${ttsRes.status}): ${errText}`, 502);
    }

    const audioData = await ttsRes.arrayBuffer();

    return new Response(audioData, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/octet-stream",
        "Content-Length": String(audioData.byteLength),
      },
    });
  } catch (err) {
    console.error("[generative-tts]", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message);
  }
});
