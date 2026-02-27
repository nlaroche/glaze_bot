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

    const serviceClient = getServiceClient();
    const { error } = await serviceClient
      .from("config_snapshots")
      .delete()
      .eq("id", body.id);

    if (error) return errorResponse(error.message);

    return jsonResponse({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message);
  }
});
