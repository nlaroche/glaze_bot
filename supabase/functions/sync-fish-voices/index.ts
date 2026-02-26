import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  handleCors,
  jsonResponse,
  errorResponse,
  getRequestUser,
  getServiceClient,
} from "../_shared/mod.ts";

const FISH_AUDIO_API_KEY = Deno.env.get("FISH_AUDIO_API_KEY") ?? "";

interface SyncRequest {
  page_size?: number;
  page_count?: number;
  language?: string;
}

interface FishVoiceItem {
  _id: string;
  title: string;
  description: string;
  tags: string[];
  samples: { audio: string; text: string }[];
  task_count: number;
  like_count: number;
  author: { _id: string; nickname: string } | null;
  cover_image: string;
  languages: string[];
}

async function fetchPage(
  pageNumber: number,
  pageSize: number,
  language: string,
): Promise<{ items: FishVoiceItem[]; total: number }> {
  const url = `https://api.fish.audio/model?page_size=${pageSize}&language=${language}&page_number=${pageNumber}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${FISH_AUDIO_API_KEY}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Fish Audio API returned ${res.status}: ${text}`);
  }
  return await res.json();
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = await getRequestUser(req);
    if ("error" in auth) return auth.error;

    if (!FISH_AUDIO_API_KEY) {
      return errorResponse("Fish Audio API key not configured", 500);
    }

    const body: SyncRequest = await req.json().catch(() => ({}));
    const pageSize = Math.min(body.page_size ?? 100, 100);
    const pageCount = body.page_count ?? 10;
    const language = body.language ?? "en";

    // Fetch all pages in parallel
    const pagePromises = [];
    for (let i = 1; i <= pageCount; i++) {
      pagePromises.push(fetchPage(i, pageSize, language));
    }
    const pages = await Promise.all(pagePromises);

    // Flatten and deduplicate by _id
    const seen = new Set<string>();
    const allItems: FishVoiceItem[] = [];
    let totalAvailable = 0;
    for (const page of pages) {
      totalAvailable = Math.max(totalAvailable, page.total ?? 0);
      for (const item of page.items ?? []) {
        if (!seen.has(item._id)) {
          seen.add(item._id);
          allItems.push(item);
        }
      }
    }

    // Map to DB shape
    const rows = allItems.map((item) => ({
      id: item._id,
      title: item.title ?? "Untitled",
      description: item.description ?? "",
      tags: item.tags ?? [],
      sample_url: item.samples?.[0]?.audio ?? null,
      sample_text: item.samples?.[0]?.text ?? null,
      task_count: item.task_count ?? 0,
      like_count: item.like_count ?? 0,
      author_name: item.author?.nickname ?? null,
      cover_image: item.cover_image ?? null,
      languages: item.languages ?? [language],
      fetched_at: new Date().toISOString(),
    }));

    // Upsert into fish_voices
    const serviceClient = getServiceClient();
    const { error: upsertError } = await serviceClient
      .from("fish_voices")
      .upsert(rows, { onConflict: "id" });

    if (upsertError) {
      console.error("[sync-fish-voices] Upsert error:", upsertError);
      return errorResponse(`DB upsert failed: ${upsertError.message}`);
    }

    return jsonResponse({
      synced: rows.length,
      total_available: totalAvailable,
    });
  } catch (err) {
    console.error("[sync-fish-voices]", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message);
  }
});
