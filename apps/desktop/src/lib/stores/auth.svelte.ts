import type { Session, User } from "@glazebot/supabase-client";
import { createSupabaseClient, getSession, onAuthStateChange } from "@glazebot/supabase-client";

let session = $state<Session | null>(null);
let loading = $state(true);

export function getAuthState() {
  return {
    get session() { return session; },
    get user(): User | null { return session?.user ?? null; },
    get isAuthenticated() { return !!session; },
    get loading() { return loading; },
  };
}

export async function initializeAuth() {
  try {
    // Client self-configures from VITE_ENV (staging/production).
    // URLs and anon keys are hardcoded in supabase-client.
    createSupabaseClient();
    session = await getSession();
  } catch (e) {
    console.error("Auth init failed:", e);
    session = null;
  } finally {
    loading = false;
  }

  onAuthStateChange((_event, newSession) => {
    session = newSession;
  });
}
