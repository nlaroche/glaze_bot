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
    if (!body.config || typeof body.config !== "object") {
      return errorResponse("Missing config object", 400);
    }

    const serviceClient = getServiceClient();
    const isActive = body.is_active === true;

    // If marking as active, clear all existing active snapshots first
    if (isActive) {
      await serviceClient
        .from("config_snapshots")
        .update({ is_active: false })
        .eq("is_active", true);
    }

    const { data, error } = await serviceClient
      .from("config_snapshots")
      .insert({
        config: body.config,
        name: body.name ?? "",
        comments: body.comments ?? "",
        is_active: isActive,
      })
      .select()
      .single();

    if (error) return errorResponse(error.message);

    return jsonResponse(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message);
  }
});
