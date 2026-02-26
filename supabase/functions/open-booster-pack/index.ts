import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  handleCors,
  jsonResponse,
  errorResponse,
  getRequestUser,
  getServiceClient,
} from "../_shared/mod.ts";

/** Weighted random rarity selection */
function rollRarity(dropRates: Record<string, number>): string {
  const rand = Math.random();
  let cumulative = 0;
  for (const [rarity, rate] of Object.entries(dropRates)) {
    cumulative += rate;
    if (rand <= cumulative) return rarity;
  }
  return "common";
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = await getRequestUser(req);
    if ("error" in auth) return auth.error;

    const serviceClient = getServiceClient();

    // Fetch gacha config
    const { data: configRow, error: configError } = await serviceClient
      .from("gacha_config")
      .select("config")
      .eq("id", "default")
      .single();
    if (configError || !configRow) return errorResponse("Config not found");

    const config = configRow.config as Record<string, unknown>;
    const cardsPerPack = (config.cardsPerPack as number) ?? 3;
    const dropRates =
      (config.dropRates as Record<string, number>) ?? {
        common: 0.6,
        rare: 0.25,
        epic: 0.12,
        legendary: 0.03,
      };

    // Roll rarities for this pack
    const rarities: string[] = [];
    for (let i = 0; i < cardsPerPack; i++) {
      rarities.push(rollRarity(dropRates));
    }

    // Fetch all active templates
    const { data: templates, error: templatesError } = await serviceClient
      .from("character_templates")
      .select("*")
      .eq("is_active", true);
    if (templatesError || !templates || templates.length === 0) {
      return errorResponse("No character templates available");
    }

    // Fetch user's existing characters to detect duplicates
    const { data: owned, error: ownedError } = await serviceClient
      .from("characters")
      .select("template_id")
      .eq("user_id", auth.user.id)
      .not("template_id", "is", null);
    if (ownedError) return errorResponse(ownedError.message);

    const ownedTemplateIds = new Set(
      (owned ?? []).map((c: { template_id: string }) => c.template_id),
    );

    // Group templates by rarity
    const byRarity: Record<string, typeof templates> = {};
    for (const t of templates) {
      const r = t.rarity as string;
      if (!byRarity[r]) byRarity[r] = [];
      byRarity[r].push(t);
    }

    // Pick templates for each rolled rarity, skipping duplicates
    const pickedTemplates: typeof templates = [];
    const newlyPickedIds = new Set<string>();

    for (const rarity of rarities) {
      const pool = byRarity[rarity] ?? byRarity["common"] ?? [];
      // Filter out already-owned and already-picked-this-pack
      const available = pool.filter(
        (t) => !ownedTemplateIds.has(t.id) && !newlyPickedIds.has(t.id),
      );

      if (available.length === 0) {
        // All of this rarity owned — try any rarity
        const anyAvailable = templates.filter(
          (t) => !ownedTemplateIds.has(t.id) && !newlyPickedIds.has(t.id),
        );
        if (anyAvailable.length === 0) {
          // Collection complete — skip this card slot
          continue;
        }
        const pick =
          anyAvailable[Math.floor(Math.random() * anyAvailable.length)];
        pickedTemplates.push(pick);
        newlyPickedIds.add(pick.id);
      } else {
        const pick = available[Math.floor(Math.random() * available.length)];
        pickedTemplates.push(pick);
        newlyPickedIds.add(pick.id);
      }
    }

    if (pickedTemplates.length === 0) {
      return jsonResponse({
        characters: [],
        packs_remaining: 0,
        collection_complete: true,
      });
    }

    // Insert copies into characters with the user's user_id + template_id
    const inserts = pickedTemplates.map((t) => ({
      user_id: auth.user.id,
      template_id: t.id,
      name: t.name,
      description: t.description,
      backstory: t.backstory,
      system_prompt: t.system_prompt,
      personality: t.personality,
      rarity: t.rarity,
      voice_id: t.voice_id,
      voice_name: t.voice_name,
      avatar_seed: t.avatar_seed,
      avatar_url: t.avatar_url,
      tagline: t.tagline,
      tagline_url: t.tagline_url,
    }));

    const { data: characters, error: insertError } = await serviceClient
      .from("characters")
      .insert(inserts)
      .select("*");
    if (insertError) return errorResponse(insertError.message);

    const characterIds = (characters ?? []).map(
      (c: { id: string }) => c.id,
    );

    // Record the booster pack
    const { error: packError } = await serviceClient
      .from("booster_packs")
      .insert({ user_id: auth.user.id, character_ids: characterIds });
    if (packError) return errorResponse(packError.message);

    return jsonResponse({
      characters: characters ?? [],
      packs_remaining: 999,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message);
  }
});
