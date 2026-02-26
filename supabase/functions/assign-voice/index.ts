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
const DASHSCOPE_API_KEY = Deno.env.get("DASHSCOPE_API_KEY") ?? "";
const DASHSCOPE_BASE_URL =
  Deno.env.get("DASHSCOPE_BASE_URL") ??
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";

// Known celebrity/character voice keywords to exclude
const CELEBRITY_KEYWORDS = [
  "trump", "elon", "musk", "obama", "biden", "spongebob", "miku",
  "mortal kombat", "mario", "goku", "naruto", "kanye", "drake",
  "morgan freeman", "snoop", "pewdiepie", "joe rogan", "ben shapiro",
  "jordan peterson", "andrew tate", "taylor swift", "ariana",
];

interface AssignVoiceRequest {
  character_id: string;
  voice_id?: string;
}

interface VoiceCandidate {
  id: string;
  title: string;
  description: string;
  tags: string[];
}

function isCelebrity(voice: VoiceCandidate): boolean {
  const haystack = `${voice.title} ${voice.description} ${voice.tags.join(" ")}`.toLowerCase();
  return CELEBRITY_KEYWORDS.some((kw) => haystack.includes(kw));
}

/** Ask Qwen to pick the best voice for a character from the catalog */
async function pickVoiceWithLLM(
  character: { name: string; description: string; backstory: string; personality: Record<string, unknown>; rarity: string },
  voices: VoiceCandidate[],
): Promise<string | null> {
  if (!DASHSCOPE_API_KEY) return null;

  // Build compact voice catalog — id, title, tags, first 80 chars of description
  const catalog = voices.map((v) => ({
    id: v.id,
    title: v.title,
    tags: v.tags.slice(0, 6).join(", "),
    desc: v.description.slice(0, 80),
  }));

  const systemPrompt = `You are a voice casting director for AI gaming commentators. Given a character profile and a catalog of available TTS voices, pick the single best voice match.

Consider:
- Gender and age alignment with the character's personality
- Energy level: high-energy characters need energetic voices, calm characters need measured voices
- Tone: humorous characters benefit from playful/expressive voices, serious ones need authoritative voices
- Style: match formality level (professional vs casual/conversational)

Return ONLY a JSON object: {"voice_id": "<the id>", "reason": "<1 sentence why>"}`;

  const userPrompt = `CHARACTER:
Name: ${character.name}
Description: ${character.description}
Rarity: ${character.rarity}
Personality: energy=${(character.personality as Record<string, number>).energy ?? 50}, humor=${(character.personality as Record<string, number>).humor ?? 50}, formality=${(character.personality as Record<string, number>).formality ?? 50}, attitude=${(character.personality as Record<string, number>).attitude ?? 50}, talkativeness=${(character.personality as Record<string, number>).talkativeness ?? 50}

VOICE CATALOG (${catalog.length} voices):
${JSON.stringify(catalog)}

Pick the best voice. Return ONLY valid JSON.`;

  try {
    const res = await fetch(`${DASHSCOPE_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "qwen-plus",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    console.log("[assign-voice] Qwen response:", content);

    // Parse JSON from response (handle markdown fences)
    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    const parsed = JSON.parse(cleaned);
    const pickedId = parsed.voice_id;

    // Validate the picked ID actually exists in our catalog
    if (pickedId && voices.some((v) => v.id === pickedId)) {
      console.log(`[assign-voice] Qwen picked: ${pickedId} — ${parsed.reason}`);
      return pickedId;
    }

    console.warn("[assign-voice] Qwen returned invalid voice_id:", pickedId);
    return null;
  } catch (err) {
    console.error("[assign-voice] Qwen voice selection failed:", err);
    return null;
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

    const serviceClient = getServiceClient();

    // Fetch character details (need personality + description for LLM matching)
    const { data: character, error: charError } = await serviceClient
      .from("characters")
      .select("name, description, backstory, personality, rarity, tagline, generation_metadata")
      .eq("id", character_id)
      .single();

    if (charError || !character) {
      return errorResponse("Character not found", 404);
    }

    // Fetch voices from our DB (synced from Fish Audio)
    const { data: dbVoices, error: voiceError } = await serviceClient
      .from("fish_voices")
      .select("id, title, description, tags")
      .order("task_count", { ascending: false });

    if (voiceError || !dbVoices || dbVoices.length === 0) {
      return errorResponse("No voices available in database. Run voice sync first.");
    }

    // Filter out celebrity voices
    const voices: VoiceCandidate[] = (dbVoices as VoiceCandidate[]).filter(
      (v) => !isCelebrity(v),
    );

    if (voices.length === 0) {
      return errorResponse("No non-celebrity voices available");
    }

    // Pick voice: use explicit ID, or LLM selection, or random fallback
    let selectedVoice: { id: string; name: string };

    if (requestedVoiceId) {
      const found = voices.find((v) => v.id === requestedVoiceId);
      if (!found) {
        return errorResponse("Requested voice not found", 404);
      }
      selectedVoice = { id: found.id, name: found.title };
    } else {
      // Try LLM-based selection
      const llmPickId = await pickVoiceWithLLM(
        {
          name: character.name as string,
          description: character.description as string,
          backstory: character.backstory as string,
          personality: (character.personality as Record<string, unknown>) ?? {},
          rarity: character.rarity as string,
        },
        voices,
      );

      if (llmPickId) {
        const picked = voices.find((v) => v.id === llmPickId)!;
        selectedVoice = { id: picked.id, name: picked.title };
      } else {
        // Random fallback
        const pick = voices[Math.floor(Math.random() * voices.length)];
        selectedVoice = { id: pick.id, name: pick.title };
        console.log("[assign-voice] Fell back to random:", selectedVoice.name);
      }
    }

    const existingMetadata = (character.generation_metadata as Record<string, unknown>) ?? {};
    const tagline = (character.tagline as string) ?? "";

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
            model: "s1",
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
      }
    }

    // Build step 3 metadata
    const step3Metadata = {
      request: { character_id, voice_id: requestedVoiceId ?? "llm-selected" },
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
      voices: voices.slice(0, 50).map((v) => ({ id: v.id, name: v.title })),
    });
  } catch (err) {
    console.error("[assign-voice]", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message);
  }
});
