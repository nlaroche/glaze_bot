import type { Session, AuthChangeEvent } from "@supabase/supabase-js";
import { createSupabaseClient } from "./client.js";

export async function signInWithDiscord() {
  const supabase = createSupabaseClient();
  return supabase.auth.signInWithOAuth({ provider: "discord" });
}

export async function signOut() {
  const supabase = createSupabaseClient();
  return supabase.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  const supabase = createSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  const supabase = createSupabaseClient();
  return supabase.auth.onAuthStateChange(callback);
}
