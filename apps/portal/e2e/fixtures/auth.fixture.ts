import { test as base, type Page } from '@playwright/test';
import { getTestSession, getProjectRef } from '../helpers/test-user';

/**
 * Injects a real Supabase session into localStorage so the app
 * picks it up immediately without an OAuth redirect.
 */
async function injectRealSession(page: Page) {
  const session = await getTestSession();
  const projectRef = getProjectRef();
  const storageKey = `sb-${projectRef}-auth-token`;

  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      window.localStorage.setItem(key, value);
    },
    { key: storageKey, value: JSON.stringify(session) },
  );
}

export type AuthFixture = {
  authedPage: Page;
};

/**
 * Extends the base Playwright test with an `authedPage` fixture.
 * - Injects a REAL session (from signInWithPassword) into localStorage
 * - All Supabase calls (auth, REST, RPC, functions) hit the real staging backend
 * - No mocks by default — individual tests can still add page.route() for edge functions
 */
export const test = base.extend<AuthFixture>({
  authedPage: async ({ page }, use) => {
    await injectRealSession(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
