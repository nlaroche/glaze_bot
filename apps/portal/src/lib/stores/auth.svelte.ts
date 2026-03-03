import type { Session, User } from "@glazebot/supabase-client";
import { createSupabaseClient, getSession, getUserRole, onAuthStateChange } from "@glazebot/supabase-client";

let session = $state<Session | null>(null);
let role = $state('user');
let loading = $state(true);

export function getAuthState() {
  return {
    get session() { return session; },
    get user(): User | null { return session?.user ?? null; },
    get isAuthenticated() { return !!session; },
    get isAdmin() { return role === 'admin'; },
    get role() { return role; },
    get loading() { return loading; },
  };
}

export async function initializeAuth() {
  try {
    createSupabaseClient({ flowType: "implicit" });
    session = await getSession();
    if (session) {
      role = await getUserRole();
    }
  } catch (e) {
    console.error("Auth init failed:", e);
    session = null;
  } finally {
    loading = false;
  }

  onAuthStateChange(async (_event, newSession) => {
    session = newSession;
    if (newSession) {
      role = await getUserRole();
    } else {
      role = 'user';
    }
  });
}
