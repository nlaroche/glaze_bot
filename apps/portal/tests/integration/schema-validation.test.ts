import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://zwpwjceczndedcoegerx.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '';
const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'e2e-test@glazebot.gg';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'e2e-test-password-gl4z3!';

let client: SupabaseClient;

beforeAll(async () => {
  if (!SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_ANON_KEY is required for schema validation tests');
  }

  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Authenticate so RLS lets us query tables
  const { error } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (error) throw new Error(`Auth failed: ${error.message}`);
});

describe('Schema validation against staging', () => {
  it('characters table has expected columns', async () => {
    const { error } = await client
      .from('characters')
      .select('id, user_id, name, description, backstory, system_prompt, personality, rarity, voice_id, voice_name, avatar_seed, created_at')
      .limit(0);

    expect(error).toBeNull();
  });

  it('booster_packs table has expected columns', async () => {
    const { error } = await client
      .from('booster_packs')
      .select('id, user_id, opened_at, character_ids')
      .limit(0);

    expect(error).toBeNull();
  });

  it('parties table has expected columns', async () => {
    const { error } = await client
      .from('parties')
      .select('id, user_id, name, member_ids, is_active, created_at, updated_at')
      .limit(0);

    expect(error).toBeNull();
  });

  it('gacha_config table has default row with packsPerDay', async () => {
    const { data, error } = await client
      .from('gacha_config')
      .select('id, config')
      .eq('id', 'default')
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.config).toHaveProperty('packsPerDay');
  });

  it('daily_pack_count RPC exists and returns integer', async () => {
    const { data, error } = await client.rpc('daily_pack_count', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
    });

    expect(error).toBeNull();
    expect(typeof data).toBe('number');
    expect(data).toBe(0);
  });

  it('RLS blocks unauthenticated access to characters', async () => {
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await anonClient
      .from('characters')
      .select('id')
      .limit(1);

    // Should succeed but return empty (RLS filters all rows without auth)
    if (!error) {
      expect(data).toEqual([]);
    }
  });
});
