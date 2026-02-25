import { mockCharacters, mockActiveParty } from '../fixtures/mock-data';
import { getAuthedClient } from './test-user';

/**
 * Seeds the database with known test characters for deterministic tests.
 * Uses authenticated test user — RLS allows inserting own data.
 */
export async function seedCharacters(userId: string) {
  const client = await getAuthedClient();

  const chars = mockCharacters.map(({ voice, ...rest }) => ({
    ...rest,
    user_id: userId,
  }));

  const { error } = await client.from('characters').upsert(chars, { onConflict: 'id' });
  if (error) throw error;
}

/**
 * Seeds an active party for the test user.
 */
export async function seedParty(userId: string) {
  const client = await getAuthedClient();

  const { error } = await client.from('parties').upsert(
    {
      ...mockActiveParty,
      user_id: userId,
    },
    { onConflict: 'id' },
  );
  if (error) throw error;
}
