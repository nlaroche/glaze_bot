import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  handleCors,
  jsonResponse,
  errorResponse,
  getRequestUser,
  getServiceClient,
  SUPABASE_URL,
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

function getResetTime(): string {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return tomorrow.toISOString();
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = await getRequestUser(req);
    if ("error" in auth) return auth.error;

    const serviceClient = getServiceClient();

    // Check daily pack limit
    const { data: packCount, error: countError } = await serviceClient.rpc(
      "daily_pack_count",
      { p_user_id: auth.user.id },
    );
    if (countError) return errorResponse(countError.message);

    // Fetch gacha config
    const { data: configRow, error: configError } = await serviceClient
      .from("gacha_config")
      .select("config")
      .eq("id", "default")
      .single();
    if (configError || !configRow) return errorResponse("Config not found");

    const config = configRow.config as Record<string, unknown>;
    const packsPerDay = (config.packsPerDay as number) ?? 3;
    const cardsPerPack = (config.cardsPerPack as number) ?? 3;
    const dropRates =
      (config.dropRates as Record<string, number>) ?? {
        common: 0.6,
        rare: 0.25,
        epic: 0.12,
        legendary: 0.03,
      };

    if ((packCount as number) >= packsPerDay) {
      return jsonResponse(
        {
          message: "Daily pack limit reached",
          packs_remaining: 0,
          resets_at: getResetTime(),
        },
        429,
      );
    }

    // Roll rarities
    const rarities: string[] = [];
    for (let i = 0; i < cardsPerPack; i++) {
      rarities.push(rollRarity(dropRates));
    }

    // Generate characters in parallel via the generate-character function
    const authHeader = req.headers.get("Authorization")!;
    const generatePromises = rarities.map(async (rarity) => {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/generate-character`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify({ rarity }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Generation failed" }));
        throw new Error(err.message);
      }
      return res.json();
    });

    const characters = await Promise.all(generatePromises);
    const characterIds = characters.map((c: { id: string }) => c.id);

    // Record the booster pack
    const { error: packError } = await serviceClient
      .from("booster_packs")
      .insert({ user_id: auth.user.id, character_ids: characterIds });

    if (packError) return errorResponse(packError.message);

    const used = (packCount as number) + 1;

    return jsonResponse({
      characters,
      packs_remaining: Math.max(0, packsPerDay - used),
      resets_at: getResetTime(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message);
  }
});
