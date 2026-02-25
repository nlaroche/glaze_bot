import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  handleCors,
  jsonResponse,
  errorResponse,
  getRequestUser,
  requireAdmin,
  getServiceClient,
  deletePublicBucketPrefix,
  characterMediaPrefix,
} from "../_shared/mod.ts";

interface PurgeRequest {
  character_id?: string;
  purge_all_deleted?: boolean;
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = await getRequestUser(req);
    if ("error" in auth) return auth.error;

    const adminErr = requireAdmin(auth.user.id);
    if (adminErr) return adminErr;

    const body: PurgeRequest = await req.json();
    const serviceClient = getServiceClient();

    if (body.purge_all_deleted) {
      // Bulk purge all soft-deleted characters
      const { data: deleted, error: fetchErr } = await serviceClient
        .from("characters")
        .select("id")
        .not("deleted_at", "is", null);

      if (fetchErr) return errorResponse(fetchErr.message);

      let purged = 0;
      for (const row of deleted ?? []) {
        try {
          await deletePublicBucketPrefix(characterMediaPrefix(row.id));
          const { error: delErr } = await serviceClient
            .from("characters")
            .delete()
            .eq("id", row.id);
          if (!delErr) purged++;
        } catch {
          // Continue with remaining characters
        }
      }

      return jsonResponse({ purged });
    }

    if (body.character_id) {
      // Single character purge
      const id = body.character_id;

      await deletePublicBucketPrefix(characterMediaPrefix(id));

      const { error: delErr } = await serviceClient
        .from("characters")
        .delete()
        .eq("id", id);

      if (delErr) return errorResponse(delErr.message);

      return jsonResponse({ purged: 1, character_id: id });
    }

    return errorResponse("Provide character_id or purge_all_deleted", 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message);
  }
});
