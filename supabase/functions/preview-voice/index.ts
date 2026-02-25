import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  handleCors,
  corsHeaders,
  errorResponse,
  getRequestUser,
} from "../_shared/mod.ts";

const FISH_AUDIO_API_KEY = Deno.env.get("FISH_AUDIO_API_KEY") ?? "";

interface PreviewRequest {
  voice_id: string;
  text: string;
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = await getRequestUser(req);
    if ("error" in auth) return auth.error;

    const body: PreviewRequest = await req.json();
    const { voice_id, text } = body;

    if (!voice_id || !text) {
      return errorResponse("voice_id and text are required", 400);
    }

    if (!FISH_AUDIO_API_KEY) {
      return errorResponse("Fish Audio API key not configured", 500);
    }

    // Call Fish Audio TTS API
    const ttsRes = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FISH_AUDIO_API_KEY}`,
      },
      body: JSON.stringify({
        reference_id: voice_id,
        text,
        format: "mp3",
      }),
    });

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      return errorResponse(`Fish Audio API error: ${errText}`, 502);
    }

    // Stream audio back to client
    const audioData = await ttsRes.arrayBuffer();

    return new Response(audioData, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioData.byteLength),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message);
  }
});
