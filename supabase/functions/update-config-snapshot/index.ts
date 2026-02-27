import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  handleCors,
  jsonResponse,
  errorResponse,
  getRequestUser,
  requireAdmin,
  getServiceClient,
} from "../_shared/mod.ts";

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = await getRequestUser(req);
    if ("error" in auth) return auth.error;

    const adminError = requireAdmin(auth.user.id);
    if (adminError) return adminError;

    const body = await req.json();
    if (!body.id) {
      return errorResponse("Missing snapshot id", 400);
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.comments !== undefined) updates.comments = body.comments;
    if (body.is_favorite !== undefined) updates.is_favorite = body.is_favorite;

    if (Object.keys(updates).length === 0) {
      return errorResponse("No fields to update", 400);
    }

    const serviceClient = getServiceClient();
    const { data, error } = await serviceClient
      .from("config_snapshots")
      .update(updates)
      .eq("id", body.id)
      .select()
      .single();

    if (error) return errorResponse(error.message);

    return jsonResponse(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message);
  }
});
