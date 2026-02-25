import type { GachaCharacter, BoosterPackResult } from '@glazebot/shared-types';

export const TEST_USER_ID = 'e2e00000-0000-0000-0000-000000000001';

export const mockCharacters: GachaCharacter[] = [
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    user_id: TEST_USER_ID,
    name: 'Pixel Punk',
    description: 'A rebellious digital artist who paints in neon.',
    backstory: 'Born from a corrupted pixel shader, Pixel Punk sees beauty in glitches.',
    system_prompt: 'You are Pixel Punk, a rebellious digital artist. Speak with street-art slang and neon energy.',
    rarity: 'common',
    voice: '',
    personality: { energy: 70, positivity: 55, formality: 20, talkativeness: 65, attitude: 80, humor: 60 },
    avatar_seed: 'pixel-punk-seed',
    created_at: '2026-02-24T10:00:00Z',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000002',
    user_id: TEST_USER_ID,
    name: 'Arcane Scholar',
    description: 'A studious mage who quotes ancient texts mid-battle.',
    backstory: 'Graduated top of her class at the Academy of Infinite Pages.',
    system_prompt: 'You are the Arcane Scholar. Speak formally, referencing ancient tomes and magical theory.',
    rarity: 'rare',
    voice: '',
    personality: { energy: 30, positivity: 60, formality: 90, talkativeness: 75, attitude: 40, humor: 35 },
    avatar_seed: 'arcane-scholar-seed',
    created_at: '2026-02-24T11:00:00Z',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000003',
    user_id: TEST_USER_ID,
    name: 'Void Empress',
    description: 'Commands the emptiness between stars.',
    backstory: 'Once a humble stargazer, she fell into the void and it fell into her.',
    system_prompt: 'You are the Void Empress. Speak with cold authority, referencing cosmic emptiness.',
    rarity: 'epic',
    voice: '',
    personality: { energy: 45, positivity: 25, formality: 85, talkativeness: 30, attitude: 95, humor: 15 },
    avatar_seed: 'void-empress-seed',
    created_at: '2026-02-24T12:00:00Z',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000004',
    user_id: TEST_USER_ID,
    name: 'Chrono Drake',
    description: 'A dragon that exists in all timelines simultaneously.',
    backstory: 'The last of the temporal dragons, Chrono Drake guards the river of time.',
    system_prompt: 'You are Chrono Drake, a temporal dragon. Speak with thunderous gravitas about time and destiny.',
    rarity: 'legendary',
    voice: '',
    voice_id: 'voice-001',
    voice_name: 'Thunderous Echo',
    personality: { energy: 90, positivity: 50, formality: 70, talkativeness: 40, attitude: 85, humor: 45 },
    avatar_seed: 'chrono-drake-seed',
    created_at: '2026-02-24T13:00:00Z',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000005',
    user_id: TEST_USER_ID,
    name: 'Breezy Bot',
    description: 'A cheerful weather drone with too many opinions.',
    backstory: 'Designed to forecast rain, ended up forecasting drama.',
    system_prompt: 'You are Breezy Bot, an opinionated weather drone. Be upbeat, chatty, and full of weather puns.',
    rarity: 'common',
    voice: '',
    personality: { energy: 85, positivity: 90, formality: 10, talkativeness: 95, attitude: 20, humor: 80 },
    avatar_seed: 'breezy-bot-seed',
    created_at: '2026-02-24T14:00:00Z',
  },
];

export const mockPackResult: BoosterPackResult = {
  characters: [mockCharacters[0], mockCharacters[1], mockCharacters[2]],
  packs_remaining: 2,
  resets_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
};

export const mockLegendaryPackResult: BoosterPackResult = {
  characters: [mockCharacters[0], mockCharacters[1], mockCharacters[3]],
  packs_remaining: 1,
  resets_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
};

export const mockDailyPacksRemaining = {
  remaining: 3,
  resets_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
};

export const mockDailyLimitReached = {
  remaining: 0,
  resets_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
};

export const mockActiveParty = {
  id: 'b0000000-0000-0000-0000-000000000001',
  user_id: TEST_USER_ID,
  name: 'My Party',
  member_ids: ['a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003'],
  is_active: true,
  created_at: '2026-02-24T10:00:00Z',
  updated_at: '2026-02-24T15:00:00Z',
};

export const mockGachaConfig = {
  id: 'default',
  config: {
    packsPerDay: 3,
    cardsPerPack: 3,
    dropRates: { common: 0.6, rare: 0.25, epic: 0.12, legendary: 0.03 },
    baseTemperature: 0.9,
    model: 'qwen-plus',
    generationPrompt: 'Generate a unique character.',
    rarityGuidance: {
      common: 'Basic traits, simple backstory.',
      rare: 'Notable traits, interesting backstory.',
      epic: 'Exceptional traits, complex backstory.',
      legendary: 'Extreme traits, legendary backstory with lore.',
    },
  },
};
