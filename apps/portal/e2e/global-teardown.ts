import { cleanupTestUserData } from './helpers/test-user';

async function globalTeardown() {
  await cleanupTestUserData();
}

export default globalTeardown;
