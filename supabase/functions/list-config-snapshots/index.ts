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

    const serviceClient = getServiceClient();
    const { data, error } = await serviceClient
      .from("config_snapshots")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return errorResponse(error.message);

    return jsonResponse(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message);
  }
});
