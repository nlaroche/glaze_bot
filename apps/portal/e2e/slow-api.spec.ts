import { test, expect } from './fixtures/auth.fixture.mock';
import { mockCharacters, mockPackResult, mockGachaConfig } from './fixtures/mock-data';

test.describe('Loading States', () => {
  test('shows loading indicator while collection loads', async ({ authedPage: page }) => {
    // Delay the collection response
    await page.route('**/rest/v1/characters**', async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      route.fulfill({ json: mockCharacters });
    });

    await page.route('**/rest/v1/parties**', (route) => {
      route.fulfill({ json: [] });
    });

    await page.goto('/collection');

    // Loading state should be visible initially
    await expect(page.getByTestId('collection-loading')).toBeVisible();

    // Then cards should appear after delay
    await expect(page.getByTestId('collection-card-grid')).toBeVisible({ timeout: 5000 });
  });

  test('shows loading text while config loads', async ({ authedPage: page }) => {
    await page.route('**/rest/v1/gacha_config**', async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      route.fulfill({ json: mockGachaConfig });
    });

    await page.goto('/settings');

    // Should show loading state
    await expect(page.getByText('Loading config...')).toBeVisible();

    // Then form should appear
    await expect(page.getByTestId('config-packs-per-day')).toBeVisible({ timeout: 5000 });
  });

  test('disables open button during pack opening', async ({ authedPage: page }) => {
    await page.route('**/rest/v1/rpc/**', (route) => {
      route.fulfill({ json: 0 });
    });

    // Slow pack opening
    await page.route('**/functions/v1/open-booster-pack', async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      route.fulfill({ json: mockPackResult });
    });

    await page.goto('/pack');

    const openBtn = page.getByTestId('open-pack-btn');
    await expect(openBtn).toBeVisible();

    await openBtn.click();

    // The pack opener should be in a non-idle phase (shake/burst/reveal)
    // so the open button should no longer be visible
    await expect(openBtn).not.toBeVisible({ timeout: 1000 });
  });

  test('disables save button while saving config', async ({ authedPage: page }) => {
    await page.route('**/rest/v1/gacha_config**', (route) => {
      route.fulfill({ json: mockGachaConfig });
    });

    await page.route('**/functions/v1/update-gacha-config', async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      route.fulfill({ json: { success: true } });
    });

    await page.goto('/settings');
    await expect(page.getByTestId('save-config-btn')).toBeVisible();

    await page.getByTestId('save-config-btn').click();

    // Should show "Saving..." text
    await expect(page.getByTestId('save-config-btn')).toContainText('Saving...');

    // Eventually resolves
    await expect(page.getByTestId('save-msg')).toContainText('Saved!', { timeout: 5000 });
  });

  test('disables save party button while saving', async ({ authedPage: page }) => {
    await page.route('**/rest/v1/characters**', (route) => {
      route.fulfill({ json: mockCharacters });
    });

    await page.route('**/rest/v1/parties**', async (route, request) => {
      if (request.method() === 'GET') {
        return route.fulfill({ json: [] });
      }
      // Slow save
      await new Promise((r) => setTimeout(r, 2000));
      route.fulfill({ json: { id: 'party-new', member_ids: [], is_active: true } });
    });

    await page.goto('/collection');
    await expect(page.getByTestId('save-party-btn')).toBeVisible();

    await page.getByTestId('save-party-btn').click();

    await expect(page.getByTestId('save-party-btn')).toContainText('Saving...');
    await expect(page.getByTestId('save-party-btn')).toBeDisabled();
  });
});
