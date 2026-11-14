import { expect, test } from '@playwright/test';

test('foundation page loads with demo data and no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Ritmea' })).toBeVisible();
  await expect(page.getByTestId('demo-weights')).toContainText(/\d+/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  expect(errors).toEqual([]);
});
