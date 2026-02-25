import { test, expect } from './fixtures/auth.fixture.mock';

test.describe('Error Handling', () => {
  test('shows error when pack opening fails with 500', async ({ authedPage: page }) => {
    // Mock packs available
    await page.route('**/rest/v1/rpc/**', (route) => {
      route.fulfill({ json: 0 });
    });

    // Mock pack open failure
    await page.route('**/functions/v1/open-booster-pack', (route) => {
      route.fulfill({
        status: 500,
        json: { message: 'Internal server error' },
      });
    });

    await page.goto('/pack');
    await page.getByTestId('open-pack-btn').click();

    // Wait for animation to finish and error to show
    await expect(page.getByTestId('pack-error')).toBeVisible({ timeout: 5000 });
  });

  test('shows error on malformed pack response', async ({ authedPage: page }) => {
    await page.route('**/rest/v1/rpc/**', (route) => {
      route.fulfill({ json: 0 });
    });

    await page.route('**/functions/v1/open-booster-pack', (route) => {
      route.fulfill({
        status: 200,
        body: 'not json at all',
        headers: { 'Content-Type': 'text/plain' },
      });
    });

    await page.goto('/pack');
    await page.getByTestId('open-pack-btn').click();

    await expect(page.getByTestId('pack-error')).toBeVisible({ timeout: 5000 });
  });

  test('handles 429 rate limit on pack opening', async ({ authedPage: page }) => {
    await page.route('**/rest/v1/rpc/**', (route) => {
      route.fulfill({ json: 0 });
    });

    await page.route('**/functions/v1/open-booster-pack', (route) => {
      route.fulfill({
        status: 429,
        json: { message: 'Rate limit exceeded. Try again later.' },
      });
    });

    await page.goto('/pack');
    await page.getByTestId('open-pack-btn').click();

    await expect(page.getByTestId('pack-error')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('pack-error')).toContainText('Rate limit');
  });

  test('handles collection load failure gracefully', async ({ authedPage: page }) => {
    await page.route('**/rest/v1/characters**', (route) => {
      route.fulfill({
        status: 500,
        json: { message: 'Database error' },
      });
    });

    await page.route('**/rest/v1/parties**', (route) => {
      route.fulfill({ json: [] });
    });

    await page.goto('/collection');

    // Should show empty state rather than crash
    await expect(page.getByTestId('collection-empty')).toBeVisible();
  });

  test('handles config load failure', async ({ authedPage: page }) => {
    await page.route('**/rest/v1/gacha_config**', (route) => {
      route.fulfill({
        status: 500,
        json: { message: 'Config not found' },
      });
    });

    await page.goto('/settings');

    // Page should still render (with defaults)
    await expect(page.getByTestId('settings-page')).toBeVisible();
  });

  test('handles save config failure', async ({ authedPage: page }) => {
    await page.route('**/rest/v1/gacha_config**', (route) => {
      route.fulfill({
        json: {
          id: 'default',
          config: { packsPerDay: 3, cardsPerPack: 3, dropRates: { common: 0.6, rare: 0.25, epic: 0.12, legendary: 0.03 }, baseTemperature: 0.9, model: 'qwen-plus' },
        },
      });
    });

    await page.route('**/functions/v1/update-gacha-config', (route) => {
      route.fulfill({
        status: 500,
        json: { message: 'Save failed' },
      });
    });

    await page.goto('/settings');
    await page.getByTestId('save-config-btn').click();

    await expect(page.getByTestId('save-msg')).toContainText('Save failed');
  });
});
