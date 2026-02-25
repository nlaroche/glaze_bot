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
