import { test, expect } from './fixtures/auth.fixture';
import { getAuthedClient } from './helpers/test-user';

/**
 * Workshop "Delete All" E2E test.
 *
 * Creates test characters via Supabase, navigates to Workshop,
 * clicks "Delete All", confirms the modal, and verifies:
 * - The confirm dialog appears and works
 * - Characters are soft-deleted (disappear from the list)
 * - A success toast is shown
 */

const PROJECT_REF = process.env.SUPABASE_URL
  ? new URL(process.env.SUPABASE_URL).hostname.split('.')[0]
  : 'zwpwjceczndedcoegerx';

test.describe('Workshop Delete All', () => {
  let createdIds: string[] = [];

  test.beforeEach(async () => {
    // Seed 2 test characters directly via Supabase
    const client = await getAuthedClient();
    const userId = (await client.auth.getUser()).data.user!.id;
    createdIds = [];

    for (let i = 0; i < 2; i++) {
      const { data, error } = await client.from('characters').insert({
        user_id: userId,
        name: `E2E Delete Test ${i + 1}`,
        description: 'Playwright test character',
        system_prompt: 'Test prompt',
        personality: { energy: 50, positivity: 50, formality: 50, talkativeness: 50, attitude: 50, humor: 50 },
        rarity: 'common',
        is_active: true,
      }).select('id').single();

      if (error) throw new Error(`Failed to seed character: ${error.message}`);
      createdIds.push(data.id);
    }
  });

  test.afterEach(async () => {
    // Hard-delete any leftover test characters (even soft-deleted ones)
    const client = await getAuthedClient();
    for (const id of createdIds) {
      // Restore first (so RLS allows delete), then hard-delete
      try { await client.rpc('restore_character', { p_character_id: id }); } catch {}
      try { await client.from('characters').delete().eq('id', id); } catch {}
    }
  });

  test('Delete All soft-deletes characters and shows toast', async ({ authedPage: page }) => {
    // Navigate to settings, Workshop tab
    await page.goto('/settings');
    await page.getByTestId('tab-workshop').click();

    // Wait for characters to load
    await expect(page.getByText('E2E Delete Test 1')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('E2E Delete Test 2')).toBeVisible();

    // Click "Delete All"
    await page.getByTestId('delete-all-btn').click();

    // Confirm dialog should appear
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    await expect(page.getByTestId('confirm-dialog')).toContainText('Delete All');

    // Click confirm
    await page.getByTestId('confirm-ok').click();

    // Dialog should close
    await expect(page.getByTestId('confirm-dialog')).not.toBeVisible({ timeout: 10000 });

    // Success toast should appear
    await expect(page.getByTestId('toast-success')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('toast-success')).toContainText('Deleted');

    // Characters should no longer be visible
    await expect(page.getByText('E2E Delete Test 1')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText('E2E Delete Test 2')).not.toBeVisible();

    // Verify via API that characters are soft-deleted
    const client = await getAuthedClient();
    for (const id of createdIds) {
      const { data } = await client.from('characters').select('id').eq('id', id);
      expect(data?.length).toBe(0); // Not visible (deleted_at is set, hidden by SELECT RLS)
    }
  });

  test('single character delete works', async ({ authedPage: page }) => {
    await page.goto('/settings');
    await page.getByTestId('tab-workshop').click();

    await expect(page.getByText('E2E Delete Test 1')).toBeVisible({ timeout: 10000 });

    // Click the delete button for the first character
    await page.getByTestId(`delete-${createdIds[0]}`).click();

    // Confirm dialog
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    await page.getByTestId('confirm-ok').click();

    // Toast + character gone
    await expect(page.getByTestId('toast-success')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('E2E Delete Test 1')).not.toBeVisible({ timeout: 5000 });

    // Second character should still be visible
    await expect(page.getByText('E2E Delete Test 2')).toBeVisible();
  });
});
