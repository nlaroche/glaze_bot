import { createClient, type User } from "jsr:@supabase/supabase-js@2";
import { errorResponse } from "./cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

/**
 * Extract and verify the user from the request's Authorization header.
 * Returns either a valid User or an error Response to send back.
 */
export async function getRequestUser(
  req: Request,
): Promise<{ user: User; token: string } | { error: Response }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { error: errorResponse("Missing authorization header", 401) };
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

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
