import type { Session, AuthChangeEvent } from "@supabase/supabase-js";
import { createSupabaseClient } from "./client.js";

/** Standard browser redirect OAuth — for portal/web apps. */
export async function signInWithGoogle() {
  const supabase = createSupabaseClient();
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { queryParams: { prompt: "select_account" } },
  });
}

/**
 * Returns a Google OAuth URL without navigating.
 * For desktop: open this URL in the system browser, then exchange the code.
 */
export async function getGoogleOAuthUrl(redirectTo: string) {
  const supabase = createSupabaseClient();
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      skipBrowserRedirect: true,
      redirectTo,
      queryParams: {
        prompt: "select_account",
        access_type: "offline",
      },
      scopes: "openid email profile",
    },
  });
}

/** Exchange a PKCE authorization code for a session. For desktop after OAuth callback. */
export async function exchangeCodeForSession(code: string) {
  const supabase = createSupabaseClient();
  return supabase.auth.exchangeCodeForSession(code);
}

export async function signInWithDiscord() {
  const supabase = createSupabaseClient();
  return supabase.auth.signInWithOAuth({ provider: "discord" });
}

export async function signInWithEmailOtp(email: string) {
  const supabase = createSupabaseClient();
  return supabase.auth.signInWithOtp({ email });
}

export async function verifyEmailOtp(email: string, token: string) {
  const supabase = createSupabaseClient();
  return supabase.auth.verifyOtp({ email, token, type: "email" });
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
