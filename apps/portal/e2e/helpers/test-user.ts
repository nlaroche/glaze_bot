import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://zwpwjceczndedcoegerx.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '';
const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'e2e-test@glazebot.gg';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'e2e-test-password-gl4z3!';

function getAnonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getTestCredentials() {
  return { email: TEST_EMAIL, password: TEST_PASSWORD };
}

export function getProjectRef(): string {
  return new URL(SUPABASE_URL).hostname.split('.')[0];
}

/**
 * Ensures the test user exists. Tries to sign in first;
 * if that fails, signs up. Returns the user's UUID.
 */
export async function ensureTestUser(): Promise<string> {
  const client = getAnonClient();

  // Try signing in first
  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (signInData?.user) return signInData.user.id;

  // User doesn't exist — sign up
  const { data: signUpData, error: signUpError } = await client.auth.signUp({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (signUpError) throw signUpError;
  if (!signUpData?.user) throw new Error('Sign up returned no user');
  return signUpData.user.id;
}

/**
 * Signs in as the test user and returns a real session.
 */
export async function getTestSession() {
  const client = getAnonClient();

  const { data, error } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (error) throw error;
  return data.session;
}

/**
 * Returns an authenticated Supabase client for the test user.
 */
export async function getAuthedClient() {
  const session = await getTestSession();
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
  return client;
}

/**
 * Deletes all data owned by the test user (characters, parties, booster_packs).
 * Uses the authenticated test user — RLS allows deleting own data.
 */
export async function cleanupTestUserData(): Promise<void> {
  const client = await getAuthedClient();
  const userId = (await getTestSession()).user.id;

  await client.from('booster_packs').delete().eq('user_id', userId);
  await client.from('parties').delete().eq('user_id', userId);
  await client.from('characters').delete().eq('user_id', userId);
}
