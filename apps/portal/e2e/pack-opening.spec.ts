import { test, expect } from './fixtures/auth.fixture';
import { mockPackResult, mockLegendaryPackResult } from './fixtures/mock-data';

const PROJECT_REF = process.env.SUPABASE_URL
  ? new URL(process.env.SUPABASE_URL).hostname.split('.')[0]
  : 'zwpwjceczndedcoegerx';

test.describe('Pack Opening', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    // Mock only the open-booster-pack edge function (calls paid AI, slow)
    // Real auth + real RPC (daily_pack_count) hit staging
    await page.route(`**/${PROJECT_REF}.supabase.co/functions/v1/open-booster-pack`, (route) => {
      route.fulfill({ json: mockPackResult });
    });
  });

  test('shows pack count and open button when packs available', async ({ authedPage: page }) => {
    await page.goto('/pack');

    await expect(page.getByTestId('open-pack-btn')).toBeVisible();
    await expect(page.getByTestId('packs-remaining')).toContainText('3 packs remaining today');
  });

  test('opens a pack with animation sequence', async ({ authedPage: page }) => {
    await page.goto('/pack');
    await expect(page.getByTestId('open-pack-btn')).toBeVisible();

    await page.getByTestId('open-pack-btn').click();

    await expect(page.getByTestId('cards-container')).toBeVisible({ timeout: 5000 });

    const cards = page.getByTestId('card-slot');
    await expect(cards).toHaveCount(3);
  });

  test('cards can be flipped to reveal characters', async ({ authedPage: page }) => {
    await page.goto('/pack');
    await page.getByTestId('open-pack-btn').click();

    await expect(page.getByTestId('cards-container')).toBeVisible({ timeout: 5000 });

    const characterCards = page.getByTestId('character-card');
    const cardCount = await characterCards.count();
    expect(cardCount).toBe(3);

    for (let i = 0; i < cardCount; i++) {
      await characterCards.nth(i).click();
    }

    await expect(page.getByTestId('continue-btn')).toBeVisible({ timeout: 3000 });
  });

  test('legendary card triggers special effects', async ({ authedPage: page }) => {
    // Override with legendary pack result for this test
    await page.route(`**/${PROJECT_REF}.supabase.co/functions/v1/open-booster-pack`, (route) => {
      route.fulfill({ json: mockLegendaryPackResult });
    });

    await page.goto('/pack');
    await page.getByTestId('open-pack-btn').click();
    await expect(page.getByTestId('cards-container')).toBeVisible({ timeout: 5000 });

    const cards = page.getByTestId('character-card');
    await cards.nth(2).click();

    await expect(page.getByTestId('legendary-flash')).toBeVisible({ timeout: 1000 });
  });

  test('continue button resets to idle for another pack', async ({ authedPage: page }) => {
    await page.goto('/pack');
    await page.getByTestId('open-pack-btn').click();
    await expect(page.getByTestId('cards-container')).toBeVisible({ timeout: 5000 });

    const cards = page.getByTestId('character-card');
    for (let i = 0; i < 3; i++) {
      await cards.nth(i).click();
    }

    const continueBtn = page.getByTestId('continue-btn');
    await expect(continueBtn).toBeVisible({ timeout: 3000 });
    await expect(continueBtn).toContainText('Open Another');

    await continueBtn.click();

    await expect(page.getByTestId('open-pack-btn')).toBeVisible();
  });
});
