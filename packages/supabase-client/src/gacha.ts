import type { GachaCharacter, BoosterPackResult } from "@glazebot/shared-types";
import { createSupabaseClient } from "./client.js";
import {
  FunctionsHttpError,
  FunctionsRelayError,
  FunctionsFetchError,
} from "@supabase/supabase-js";

// ─── Edge Function Helpers ──────────────────────────────────────────

/**
 * Invoke a Supabase Edge Function with the current user's auth token.
 * supabase-js's `functions.invoke()` automatically attaches the session
 * access_token via its internal `fetchWithAuth` wrapper.
 *
 * Error handling follows the three error types from supabase-js:
 * - FunctionsRelayError: the Supabase relay rejected the request (bad JWT, function not found)
 * - FunctionsHttpError: the function returned a non-2xx status (business logic error)
 * - FunctionsFetchError: network failure (DNS, timeout, CORS)
 */
async function callEdgeFunction<T>(
  name: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.functions.invoke(name, {
    body: body ?? {},
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      // The function ran but returned a non-2xx status
      const errorBody = await error.context.json().catch(() => null);
      throw new Error(
        errorBody?.message ?? `Edge function ${name} returned an error`,
      );
    }
    if (error instanceof FunctionsRelayError) {
      throw new Error(
        `Auth error calling ${name}. Please sign out and sign back in.`,
      );
    }
    if (error instanceof FunctionsFetchError) {
      throw new Error(`Network error calling ${name}. Check your connection.`);
    }
    // Fallback
    throw new Error(error.message ?? `Edge function ${name} failed`);
  }

  return data as T;
}

// ─── DB Helpers ─────────────────────────────────────────────────────

/** Get the Supabase client (shorthand) */
function db() {
  return createSupabaseClient();
}

/** Get the current authenticated user, or throw */
async function requireUser() {
  const {
    data: { user },
  } = await db().auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

// ─── Pack Operations ────────────────────────────────────────────────

/** Open a booster pack (calls edge function → generates characters) */
export async function openBoosterPack(): Promise<BoosterPackResult> {
  return callEdgeFunction<BoosterPackResult>("open-booster-pack");
}

/** Get how many packs the user can still open today */
export async function getDailyPacksRemaining(): Promise<{
  remaining: number;
  resets_at: string;
}> {
  const user = await requireUser();
  const { data, error } = await db().rpc("daily_pack_count", {
    p_user_id: user.id,
  });
  if (error) throw error;

  const used = data as number;
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );

  return {
    remaining: Math.max(0, 3 - used),
    resets_at: tomorrow.toISOString(),
  };
}

// ─── Collection Operations ──────────────────────────────────────────

/** Get the user's full character collection */
export async function getCollection(): Promise<GachaCharacter[]> {
  const { data, error } = await db()
    .from("characters")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as GachaCharacter[];
}

/** Get a single character by ID */
export async function getCharacter(id: string): Promise<GachaCharacter> {
  const { data, error } = await db()
    .from("characters")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as unknown as GachaCharacter;
}

// ─── Party Operations ───────────────────────────────────────────────

/** Get the user's active party */
export async function getActiveParty() {
  const { data, error } = await db()
    .from("parties")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Set the active party's members (creates party if none exists) */
export async function setActiveParty(memberIds: string[]) {
  const user = await requireUser();

  const existing = await getActiveParty();
  if (existing) {
    const { data, error } = await db()
      .from("parties")
      .update({
        member_ids: memberIds,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await db()
    .from("parties")
    .insert({
      user_id: user.id,
      member_ids: memberIds,
      is_active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Admin Config ───────────────────────────────────────────────────

/** Get the gacha config (admin) */
export async function getGachaConfig() {
  const { data, error } = await db()
    .from("gacha_config")
    .select("*")
    .eq("id", "default")
    .single();
  if (error) throw error;
  return data;
}

/** Update the gacha config (admin — calls edge function) */
export async function updateGachaConfig(config: Record<string, unknown>) {
  return callEdgeFunction("update-gacha-config", { config });
}

/** Generate a test character with a specific rarity (admin) */
export async function generateTestCharacter(
  rarity: string,
): Promise<GachaCharacter> {
  return callEdgeFunction<GachaCharacter>("generate-character", { rarity });
}

// ─── Admin Pipeline Operations ─────────────────────────────────────

/** Step 1: Generate character text only (admin pipeline) */
export async function generateCharacterText(
  rarity: string,
): Promise<GachaCharacter> {
  return callEdgeFunction<GachaCharacter>("generate-character-text", { rarity });
}

/** Step 2: Generate character sprite image (admin pipeline) */
export async function generateCharacterImage(
  characterId: string,
  prompt: string,
): Promise<{ avatar_url: string }> {
  return callEdgeFunction<{ avatar_url: string }>("generate-character-image", {
    character_id: characterId,
    prompt,
  });
}

/** Step 3: Assign voice to character (admin pipeline) */
export async function assignCharacterVoice(
  characterId: string,
  voiceId?: string,
): Promise<{ voice_id: string; voice_name: string; voices: { id: string; name: string }[] }> {
  return callEdgeFunction<{
    voice_id: string;
    voice_name: string;
    voices: { id: string; name: string }[];
  }>("assign-voice", {
    character_id: characterId,
    voice_id: voiceId,
  });
}

/** Preview a voice via Fish Audio TTS (returns audio data) */
export async function previewVoice(
  voiceId: string,
  text: string,
): Promise<ArrayBuffer> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.functions.invoke("preview-voice", {
    body: { voice_id: voiceId, text },
  });

  if (error) {
    throw new Error(error.message ?? "Voice preview failed");
  }

  // The response is audio data as an ArrayBuffer
  if (data instanceof ArrayBuffer) return data;
  if (data instanceof Blob) return await data.arrayBuffer();
  throw new Error("Unexpected response format from preview-voice");
}

/** Update character fields (admin — direct DB update) */
export async function updateCharacter(
  id: string,
  fields: Partial<GachaCharacter>,
): Promise<GachaCharacter> {
  const { data, error } = await db()
    .from("characters")
    .update(fields as Record<string, unknown>)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as GachaCharacter;
}

/** Get all characters for admin (no user filter — uses service role via RLS bypass or admin) */
export async function getAllCharacters(): Promise<GachaCharacter[]> {
  const { data, error } = await db()
    .from("characters")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as GachaCharacter[];
}

/** Soft-delete a character (sets deleted_at, hides from user queries) */
export async function deleteCharacter(id: string): Promise<void> {
  const { error } = await db()
    .from("characters")
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Purge a single soft-deleted character (R2 media + hard-delete DB row) */
export async function purgeCharacterMedia(id: string): Promise<void> {
  await callEdgeFunction("purge-character-media", { character_id: id });
}

/** Purge all soft-deleted characters */
export async function purgeAllDeletedCharacters(): Promise<{ purged: number }> {
  return callEdgeFunction<{ purged: number }>("purge-character-media", {
    purge_all_deleted: true,
  });
}

/** Get all soft-deleted characters (admin RPC) */
export async function getDeletedCharacters(): Promise<GachaCharacter[]> {
  const { data, error } = await db().rpc("get_deleted_characters");
  if (error) throw error;
  return (data ?? []) as unknown as GachaCharacter[];
}

/** Toggle a character's is_active status */
export async function toggleCharacterActive(
  id: string,
  isActive: boolean,
): Promise<GachaCharacter> {
  const { data, error } = await db()
    .from("characters")
    .update({ is_active: isActive })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as GachaCharacter;
}

/** Set a character as the default (clears previous default first) */
export async function setDefaultCharacter(
  id: string,
): Promise<GachaCharacter> {
  // Clear any existing default
  await db()
    .from("characters")
    .update({ is_default: false })
    .eq("is_default", true);

  // Set the new default
  const { data, error } = await db()
    .from("characters")
    .update({ is_default: true })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as GachaCharacter;
}

// ─── Fish Audio Voices ─────────────────────────────────────────────

export interface FishVoice {
  id: string;
  title: string;
  description: string;
  tags: string[];
  sample_url: string | null;
  sample_text: string | null;
  task_count: number;
  like_count: number;
  author_name: string | null;
  cover_image: string | null;
  languages: string[];
  fetched_at: string;
  created_at: string;
}

/** Sync voices from Fish Audio API into the DB (admin) */
export async function syncFishVoices(opts?: {
  page_size?: number;
  page_count?: number;
  language?: string;
}): Promise<{ synced: number; total_available: number }> {
  return callEdgeFunction<{ synced: number; total_available: number }>(
    "sync-fish-voices",
    opts as Record<string, unknown>,
  );
}

/** Get all Fish Audio voices from DB, ordered by popularity */
export async function getFishVoices(): Promise<FishVoice[]> {
  const { data, error } = await db()
    .from("fish_voices")
    .select("*")
    .order("task_count", { ascending: false });
  if (error) throw error;
  return data as FishVoice[];
}

/** Generate TTS audio with Fish Audio S1 — supports emotion markers and no-reference generative mode */
export async function generativeTts(opts: {
  text: string;
  reference_id?: string | null;
  temperature?: number;
  top_p?: number;
  repetition_penalty?: number;
  speed?: number;
}): Promise<ArrayBuffer> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.functions.invoke("generative-tts", {
    body: opts,
  });

  if (error) {
    throw new Error(error.message ?? "Generative TTS failed");
  }

  if (data instanceof ArrayBuffer) return data;
  if (data instanceof Blob) return await data.arrayBuffer();
  // Supabase functions-js may return a string for unrecognized content types (e.g. audio/mpeg)
  if (typeof data === "string" && data.length > 0) {
    const bytes = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i);
    return bytes.buffer;
  }
  throw new Error("Unexpected response format from generative-tts");
}
