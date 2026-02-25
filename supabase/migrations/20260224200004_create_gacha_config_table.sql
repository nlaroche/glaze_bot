CREATE TABLE IF NOT EXISTS gacha_config (
  id text PRIMARY KEY DEFAULT 'default',
  config jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: anyone can read (edge functions need it), only service role can write
ALTER TABLE gacha_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public read access"
    ON gacha_config FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed default config (only if not already present)
INSERT INTO gacha_config (id, config) VALUES ('default', '{
  "packsPerDay": 3,
  "cardsPerPack": 3,
  "dropRates": { "common": 0.60, "rare": 0.25, "epic": 0.12, "legendary": 0.03 },
  "traitRanges": {
    "common": { "min": 25, "max": 75 },
    "rare": { "min": 15, "max": 85 },
    "epic": { "min": 5, "max": 95 },
    "legendary": { "min": 0, "max": 100 }
  },
  "promptQuality": {
    "common": { "maxTokens": 800, "tempBoost": 0.0 },
    "rare": { "maxTokens": 1000, "tempBoost": 0.1 },
    "epic": { "maxTokens": 1200, "tempBoost": 0.15 },
    "legendary": { "maxTokens": 1600, "tempBoost": 0.2 }
  },
  "generationPrompt": "You are a character designer for GlazeBot, a gaming commentary AI. Create a unique character with a distinct personality for live gaming commentary. Return valid JSON with fields: name, description, backstory, system_prompt, personality (object with energy, positivity, formality, talkativeness, attitude, humor as 0-100 integers).",
  "rarityGuidance": {
    "common": "Create a straightforward, fun character with a clear personality archetype. Keep it simple but entertaining.",
    "rare": "Create a character with an interesting twist or unique perspective. Add depth beyond a simple archetype.",
    "epic": "Create a highly memorable character with a rich backstory, complex personality, and distinctive speech patterns.",
    "legendary": "Create an extraordinary, one-of-a-kind character that is utterly unforgettable. Deep lore, extreme personality, iconic catchphrases."
  },
  "baseTemperature": 0.9,
  "model": "qwen-plus"
}')
ON CONFLICT (id) DO NOTHING;
