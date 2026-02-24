export { createSupabaseClient } from "./client.js";
export {
  signInWithGoogle,
  getGoogleOAuthUrl,
  exchangeCodeForSession,
  signInWithDiscord,
  signInWithEmailOtp,
  verifyEmailOtp,
  signOut,
  getSession,
  onAuthStateChange,
} from "./auth.js";
export type { Session, User, AuthChangeEvent } from "@supabase/supabase-js";
