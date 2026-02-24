import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@glazebot/shared-types";
import { getEnvironment, type Environment } from "@glazebot/shared-utils";

const SUPABASE_CONFIG = {
  staging: {
    url: "https://zwpwjceczndedcoegerx.supabase.co",
    anonKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cHdqY2Vjem5kZWRjb2VnZXJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDExNjQsImV4cCI6MjA4NzUxNzE2NH0.dx2U37oUZkuuFCMK_HVl0RwRAjlyg_rUrMu2gGYJrPs",
  },
  production: {
    url: "https://tspalglvgypdktuhgqtf.supabase.co",
    anonKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzcGFsZ2x2Z3lwZGt0dWhncXRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDEyMDMsImV4cCI6MjA4NzUxNzIwM30.IwC0iRMEhxgxuLFENPqPJ3ANv2rMCBfidMNt345fAHw",
  },
} as const satisfies Record<Environment, { url: string; anonKey: string }>;

let client: SupabaseClient<Database> | null = null;

export function createSupabaseClient(
  opts?: { env?: Environment },
): SupabaseClient<Database> {
  if (client) return client;
  const env = opts?.env ?? getEnvironment();
  const config = SUPABASE_CONFIG[env];
  client = createClient<Database>(config.url, config.anonKey, {
    auth: {
      flowType: "pkce",
    },
  });
  return client;
}
