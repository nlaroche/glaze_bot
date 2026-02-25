import { createClient, type User } from "jsr:@supabase/supabase-js@2";
import { errorResponse } from "./cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

/**
 * Extract and verify the user from the request's Authorization header.
 * Uses supabase.auth.getUser() which validates the JWT via the Auth server
 * (works with both ES256 and HS256 tokens).
 */
export async function getRequestUser(
  req: Request,
): Promise<{ user: User; token: string } | { error: Response }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { error: errorResponse("Missing authorization header", 401) };
  }

  const token = authHeader.replace("Bearer ", "");

  // Reject if the token is just the anon key (not a user token)
  if (token === SUPABASE_ANON_KEY) {
    return { error: errorResponse("User authentication required", 401) };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: errorResponse("Invalid or expired token", 401) };
  }

  return { user, token };
}

/**
 * Check if a user is in the admin list.
 * Returns null if authorized, or an error Response if not.
 */
export function requireAdmin(userId: string): Response | null {
  const adminIds = (Deno.env.get("ADMIN_USER_IDS") ?? "")
    .split(",")
    .filter(Boolean);
  if (adminIds.length > 0 && !adminIds.includes(userId)) {
    return errorResponse("Not authorized", 403);
  }
  return null;
}
