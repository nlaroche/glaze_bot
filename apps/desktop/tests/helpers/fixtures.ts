import type { GachaCharacter } from '@glazebot/shared-types';

/** Create a minimal GachaCharacter for tests */
export function fakeCharacter(overrides: Partial<GachaCharacter> = {}): GachaCharacter {
  return {
    name: 'TestChar',
    description: 'A test character',
    system_prompt: 'You are a test character.',
    personality: { energy: 50, positivity: 50, formality: 50, talkativeness: 50, attitude: 50, humor: 50 },
    id: 'char-1',
    user_id: 'user-1',
    backstory: 'Born in a test suite.',
    rarity: 'common',
    voice_id: 'voice-1',
    voice_name: 'TestVoice',
    avatar_seed: 'seed-1',
    avatar_url: 'https://example.com/avatar.png',
    is_active: true,
    is_default: false,
    ...overrides,
  } as GachaCharacter;
}

/** Create a second character (for reaction tests) */
export function fakeCharacter2(overrides: Partial<GachaCharacter> = {}): GachaCharacter {
  return fakeCharacter({
    name: 'ReactorBot',
    id: 'char-2',
    voice_id: 'voice-2',
    voice_name: 'ReactorVoice',
    avatar_seed: 'seed-2',
    ...overrides,
  });
}

/** Create a third character (for multi-party tests) */
export function fakeCharacter3(overrides: Partial<GachaCharacter> = {}): GachaCharacter {
  return fakeCharacter({
    name: 'ThirdWheel',
    id: 'char-3',
    voice_id: 'voice-3',
    voice_name: 'ThirdVoice',
    avatar_seed: 'seed-3',
    ...overrides,
  });
}
