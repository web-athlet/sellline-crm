import { expect, test } from '@playwright/test';

test('landing page renders the product name', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'sellline' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
});

test('unauthenticated /app redirects to /login', async ({ page }) => {
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login/);
});
