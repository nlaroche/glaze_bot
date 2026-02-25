import { test, expect } from './fixtures/auth.fixture';
import { mockCharacters } from './fixtures/mock-data';

test.describe('Collection', () => {
  test('displays character grid with all characters', async ({ authedPage: page }) => {
    await page.goto('/collection');

    await expect(page.getByTestId('collection-card-grid')).toBeVisible();

    const cards = page.getByTestId('character-card');
    await expect(cards).toHaveCount(mockCharacters.length);
  });

  test('filters characters by rarity', async ({ authedPage: page }) => {
    await page.goto('/collection');
    await expect(page.getByTestId('collection-card-grid')).toBeVisible();

    await page.getByTestId('rarity-filter').selectOption('epic');

    const cards = page.getByTestId('character-card');
    const epicCount = mockCharacters.filter((c) => c.rarity === 'epic').length;
    await expect(cards).toHaveCount(epicCount);
  });

  test('searches characters by name', async ({ authedPage: page }) => {
    await page.goto('/collection');
    await expect(page.getByTestId('collection-card-grid')).toBeVisible();

    await page.getByTestId('collection-search').fill('Pixel');

    const cards = page.getByTestId('character-card');
    await expect(cards).toHaveCount(1);
  });

  test('sorts characters by name', async ({ authedPage: page }) => {
    await page.goto('/collection');
    await expect(page.getByTestId('collection-card-grid')).toBeVisible();

    await page.getByTestId('sort-select').selectOption('name');

    const names = await page.getByTestId('character-name').allTextContents();
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  test('sorts characters by rarity', async ({ authedPage: page }) => {
    await page.goto('/collection');
    await expect(page.getByTestId('collection-card-grid')).toBeVisible();

    await page.getByTestId('sort-select').selectOption('rarity');

    const cards = page.getByTestId('character-card');
    const rarities = await cards.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-rarity')),
    );

    const rarityOrder: Record<string, number> = { legendary: 3, epic: 2, rare: 1, common: 0 };
    for (let i = 1; i < rarities.length; i++) {
      expect(rarityOrder[rarities[i]!]).toBeLessThanOrEqual(rarityOrder[rarities[i - 1]!]);
    }
  });

  test('opens character detail modal on card click', async ({ authedPage: page }) => {
    await page.goto('/collection');
    await expect(page.getByTestId('collection-card-grid')).toBeVisible();

    await page.getByTestId('character-card').first().click();

    await expect(page.getByTestId('character-detail-modal')).toBeVisible();
    await expect(page.getByTestId('detail-character-name')).toBeVisible();
    await expect(page.getByTestId('detail-description')).toBeVisible();
    await expect(page.getByTestId('detail-traits')).toBeVisible();
  });

  test('closes detail modal on overlay click', async ({ authedPage: page }) => {
    await page.goto('/collection');
    await expect(page.getByTestId('collection-card-grid')).toBeVisible();

    await page.getByTestId('character-card').first().click();
    await expect(page.getByTestId('character-detail-modal')).toBeVisible();

    await page.getByTestId('character-detail-overlay').click({ position: { x: 10, y: 10 } });
    await expect(page.getByTestId('character-detail-modal')).not.toBeVisible();
  });

  test('closes detail modal on close button', async ({ authedPage: page }) => {
    await page.goto('/collection');
    await expect(page.getByTestId('collection-card-grid')).toBeVisible();

    await page.getByTestId('character-card').first().click();
    await expect(page.getByTestId('character-detail-modal')).toBeVisible();

    await page.getByTestId('close-detail').click();
    await expect(page.getByTestId('character-detail-modal')).not.toBeVisible();
  });

  test('shows no matches when search has no results', async ({ authedPage: page }) => {
    await page.goto('/collection');
    await expect(page.getByTestId('collection-card-grid')).toBeVisible();

    await page.getByTestId('collection-search').fill('nonexistent-character-xyz');

    await expect(page.getByTestId('collection-empty')).toContainText('No matches found');
  });
});
