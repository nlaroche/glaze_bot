import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@glazebot/shared-types";

const SUPABASE_URLS = {
  staging: "https://zwpwjceczndedcoegerx.supabase.co",
  production: "https://tspalglvgypdktuhgqtf.supabase.co",
} as const;

type Env = "staging" | "production";

function getEnv(): Env {
  const env =
    (typeof globalThis !== "undefined" &&
      (globalThis as unknown as Record<string, string>).__VITE_ENV__) ||
    process.env.VITE_ENV ||
    "staging";
  return env === "production" ? "production" : "staging";
}

export function getSupabaseUrl(env?: Env): string {
  return SUPABASE_URLS[env ?? getEnv()];
}

export function getSupabaseAnonKey(): string {
  return process.env.VITE_SUPABASE_ANON_KEY ?? "";
}

let client: SupabaseClient<Database> | null = null;

export function createSupabaseClient(
  opts?: { url?: string; anonKey?: string },
): SupabaseClient<Database> {
  if (client) return client;
  const url = opts?.url ?? getSupabaseUrl();
  const anonKey = opts?.anonKey ?? getSupabaseAnonKey();
  client = createClient<Database>(url, anonKey);
  return client;
}
