import { ensureTestUser, cleanupTestUserData } from './helpers/test-user';
import { seedCharacters, seedParty } from './helpers/seed-data';

async function globalSetup() {
  const userId = await ensureTestUser();
  await cleanupTestUserData();
  await seedCharacters(userId);
  await seedParty(userId);
}

export default globalSetup;
