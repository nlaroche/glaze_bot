import { test, expect } from './fixtures/auth.fixture';
import { mockCharacters } from './fixtures/mock-data';

const PROJECT_REF = process.env.SUPABASE_URL
  ? new URL(process.env.SUPABASE_URL).hostname.split('.')[0]
  : 'zwpwjceczndedcoegerx';

test.describe('Admin Config', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    // Mock only the generate-character edge function (calls paid AI API)
    await page.route(`**/${PROJECT_REF}.supabase.co/functions/v1/generate-character`, (route) => {
      route.fulfill({ json: mockCharacters[2] });
    });
  });

  test('loads and displays current config', async ({ authedPage: page }) => {
    await page.goto('/settings');

    await expect(page.getByTestId('settings-page')).toBeVisible();
    await expect(page.getByTestId('config-packs-per-day')).toHaveValue('3');
    await expect(page.getByTestId('config-cards-per-pack')).toHaveValue('3');
  });

  test('edits packs per day', async ({ authedPage: page }) => {
    await page.goto('/settings');

    const input = page.getByTestId('config-packs-per-day');
    await input.fill('5');

    const rawJson = page.getByTestId('config-raw-json');
    await expect(rawJson).toHaveValue(/"packsPerDay": 5/);
  });

  test('edits model selection', async ({ authedPage: page }) => {
    await page.goto('/settings');

    await page.getByTestId('config-model').selectOption('qwen-max');

    const rawJson = page.getByTestId('config-raw-json');
    await expect(rawJson).toHaveValue(/"model": "qwen-max"/);
  });

  test('saves config successfully', async ({ authedPage: page }) => {
    // Mock only save edge function to avoid writing to staging config
    await page.route(`**/${PROJECT_REF}.supabase.co/functions/v1/update-gacha-config`, (route) => {
      route.fulfill({ json: { success: true } });
    });

    await page.goto('/settings');

    await page.getByTestId('save-config-btn').click();

    await expect(page.getByTestId('save-msg')).toContainText('Saved!');
  });

  test('resets config to defaults', async ({ authedPage: page }) => {
    await page.goto('/settings');

    await page.getByTestId('config-packs-per-day').fill('10');

    await page.getByTestId('reset-config-btn').click();

    await expect(page.getByTestId('config-packs-per-day')).toHaveValue('3');
  });

  test('shows JSON error for invalid raw JSON', async ({ authedPage: page }) => {
    await page.goto('/settings');

    const rawJson = page.getByTestId('config-raw-json');
    await rawJson.fill('{ invalid json }');

    await expect(page.getByTestId('config-json-error')).toBeVisible();
    await expect(page.getByTestId('save-config-btn')).toBeDisabled();
  });

  test('generates a test character', async ({ authedPage: page }) => {
    await page.goto('/settings');

    await page.getByTestId('test-rarity-select').selectOption('epic');
    await page.getByTestId('test-generate-btn').click();

    await expect(page.getByTestId('test-output')).toBeVisible();
    await expect(page.getByTestId('test-preview')).toBeVisible();
  });

  test('test generation with different rarities', async ({ authedPage: page }) => {
    await page.goto('/settings');

    for (const rarity of ['common', 'rare', 'epic', 'legendary']) {
      await page.getByTestId('test-rarity-select').selectOption(rarity);
      await expect(page.getByTestId('test-rarity-select')).toHaveValue(rarity);
    }
  });
});
