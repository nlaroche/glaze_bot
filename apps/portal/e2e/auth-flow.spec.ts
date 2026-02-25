import { test, expect } from '@playwright/test';

const PROJECT_REF = process.env.SUPABASE_URL
  ? new URL(process.env.SUPABASE_URL).hostname.split('.')[0]
  : 'zwpwjceczndedcoegerx';

test.describe('Auth Flow', () => {
  test('redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/pack');
    await page.waitForURL('**/login', { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('displays login form with email input and Google button', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByTestId('login-email')).toBeVisible();
    await expect(page.getByTestId('send-magic-link-btn')).toBeVisible();
    await expect(page.getByTestId('google-sign-in-btn')).toBeVisible();
  });

  test('send magic link button is disabled with empty email', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByTestId('send-magic-link-btn')).toBeDisabled();
  });

  test('sends magic link and shows confirmation', async ({ page }) => {
    await page.goto('/login');

    await page.getByTestId('login-email').fill('test@example.com');
    await page.getByTestId('send-magic-link-btn').click();

    await expect(page.getByTestId('magic-link-sent')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('magic-link-sent')).toContainText('test@example.com');
  });

  test('back button returns to email step', async ({ page }) => {
    await page.goto('/login');

    await page.getByTestId('login-email').fill('test@example.com');
    await page.getByTestId('send-magic-link-btn').click();
    await expect(page.getByTestId('magic-link-sent')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('back-to-email').click();
    await expect(page.getByTestId('login-email')).toBeVisible();
  });

  test('shows error on failed magic link send', async ({ page }) => {
    // Mock only the OTP endpoint to simulate rate limiting
    await page.route(`**/${PROJECT_REF}.supabase.co/auth/**`, (route) => {
      const url = route.request().url();
      if (url.includes('/otp') || url.includes('/magiclink')) {
        return route.fulfill({
          status: 429,
          json: { error: 'rate_limit', message: 'Rate limit exceeded', msg: 'Rate limit exceeded' },
        });
      }
      return route.fallback();
    });

    await page.goto('/login');
    await page.getByTestId('login-email').fill('test@example.com');
    await page.getByTestId('send-magic-link-btn').click();

    await expect(page.getByTestId('login-error')).toBeVisible({ timeout: 5000 });
  });

  test('protects settings route from unauthenticated access', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForURL('**/login', { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('protects collection route from unauthenticated access', async ({ page }) => {
    await page.goto('/collection');
    await page.waitForURL('**/login', { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
