import { test, expect } from './fixtures/auth.fixture';

test.describe('Party Management', () => {
  test('displays 3 party slots', async ({ authedPage: page }) => {
    await page.goto('/collection');

    const slots = page.getByTestId('party-slot');
    await expect(slots).toHaveCount(3);
  });

  test('loads existing party members', async ({ authedPage: page }) => {
    await page.goto('/collection');

    // Seeded party has 2 members
    const memberNames = page.getByTestId('party-member-name');
    await expect(memberNames).toHaveCount(2);
  });

  test('opens character picker for empty slot', async ({ authedPage: page }) => {
    await page.goto('/collection');

    // Third slot should be empty (seeded party has 2 members)
    const emptySlot = page.getByTestId('add-party-member');
    await expect(emptySlot).toHaveCount(1);

    await emptySlot.click();

    await expect(page.getByTestId('character-picker')).toBeVisible();

    const pickerItems = page.getByTestId('picker-character');
    const count = await pickerItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('adds a character to party from picker', async ({ authedPage: page }) => {
    await page.goto('/collection');

    await expect(page.getByTestId('add-party-member')).toHaveCount(1);
    await page.getByTestId('add-party-member').click();
    await expect(page.getByTestId('character-picker')).toBeVisible();

    await page.getByTestId('picker-character').first().click();

    await expect(page.getByTestId('character-picker')).not.toBeVisible();

    const memberNames = page.getByTestId('party-member-name');
    await expect(memberNames).toHaveCount(3);
  });

  test('removes a character from party', async ({ authedPage: page }) => {
    await page.goto('/collection');

    const removeButtons = page.getByTestId('remove-party-member');
    await expect(removeButtons).toHaveCount(2);

    await removeButtons.first().click();

    await expect(page.getByTestId('party-member-name')).toHaveCount(1);
  });

  test('cancels picker without selecting', async ({ authedPage: page }) => {
    await page.goto('/collection');

    await expect(page.getByTestId('add-party-member')).toHaveCount(1);
    await page.getByTestId('add-party-member').click();
    await expect(page.getByTestId('character-picker')).toBeVisible();

    await page.getByTestId('cancel-picker').click();
    await expect(page.getByTestId('character-picker')).not.toBeVisible();
  });

  test('saves party configuration', async ({ authedPage: page }) => {
    await page.goto('/collection');

    await page.getByTestId('save-party-btn').click();

    await expect(page.getByTestId('save-party-btn')).toBeEnabled();
  });
});
