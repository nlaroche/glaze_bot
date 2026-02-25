import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://zwpwjceczndedcoegerx.supabase.co';
const STAGING_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cHdqY2Vjem5kZWRjb2VnZXJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDExNjQsImV4cCI6MjA4NzUxNzE2NH0.dx2U37oUZkuuFCMK_HVl0RwRAjlyg_rUrMu2gGYJrPs';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? STAGING_ANON_KEY;

// Schema validation doesn't need auth — PostgREST returns column errors
// even on unauthenticated requests (RLS filters rows, not column metadata).
const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
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
    // gacha_config has public read RLS — no auth needed
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
    const { data, error } = await client
      .from('characters')
      .select('id')
      .limit(1);

    // Should succeed but return empty (RLS filters all rows without auth)
    if (!error) {
      expect(data).toEqual([]);
    }
  });
});
