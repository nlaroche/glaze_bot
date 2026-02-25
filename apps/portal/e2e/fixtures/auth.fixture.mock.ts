import { test as base, type Page } from '@playwright/test';
import { getProjectRef } from '../helpers/test-user';

const PROJECT_REF = getProjectRef();
const TEST_USER_ID = 'e2e00000-0000-0000-0000-000000000001';
const TEST_EMAIL = 'e2e-test@glazebot.gg';

const fakeUser = {
  id: TEST_USER_ID,
  email: TEST_EMAIL,
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  identities: [],
};

const fakeSessionPayload = {
  access_token: 'e2e-mock-access-token',
  refresh_token: 'e2e-mock-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: fakeUser,
};

/**
 * Intercepts ALL Supabase API calls so no real network requests are made.
 */
async function mockAllSupabaseEndpoints(page: Page) {
  await page.route(`**/${PROJECT_REF}.supabase.co/auth/**`, (route) => {
    const url = route.request().url();
    if (url.includes('/session') || url.includes('/token')) {
      return route.fulfill({ status: 200, json: fakeSessionPayload });
    }
    if (url.includes('/user')) {
      return route.fulfill({ status: 200, json: fakeUser });
    }
    return route.fulfill({ status: 200, json: {} });
  });

  await page.route(`**/${PROJECT_REF}.supabase.co/rest/**`, (route) => {
    return route.fulfill({ status: 200, json: [] });
  });

  await page.route(`**/${PROJECT_REF}.supabase.co/functions/**`, (route) => {
    return route.fulfill({ status: 200, json: {} });
  });
}

async function injectMockSession(page: Page) {
  const storageKey = `sb-${PROJECT_REF}-auth-token`;

  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      window.localStorage.setItem(key, value);
    },
    { key: storageKey, value: JSON.stringify(fakeSessionPayload) },
  );
}

export type MockAuthFixture = {
  authedPage: Page;
};

/**
 * Fully-mocked auth fixture for tests that need to simulate errors,
 * slow responses, or other conditions that can't be triggered on staging.
 */
export const test = base.extend<MockAuthFixture>({
  authedPage: async ({ page }, use) => {
    await mockAllSupabaseEndpoints(page);
    await injectMockSession(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
