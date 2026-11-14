import { expect, test } from '@playwright/test';

test('Ritmea alpha opens the synthetic demo and supports basic interactions', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: /Un passo alla volta/ })).toBeVisible();
  await expect(page.getByText(/Demo interattiva con dati fittizi/)).toBeVisible();
  await page.getByRole('button', { name: /Registra peso/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('input[name="kg"]').fill('76,5');
  await dialog.getByRole('button', { name: 'Salva demo' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status')).toContainText('Demo aggiornata');
  await page.locator('button[data-page="diary"]:visible').first().click();
  await expect(page.getByRole('heading', { name: /Il tuo diario/ })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  expect(errors).toEqual([]);
});

test('day change and adding water update the demo diary', async ({ page }) => {
  await page.goto('./');
  await page.locator('button[data-page="diary"]:visible').first().click();
  await page.getByRole('button', { name: /500 ml/ }).click();
  await expect(page.getByRole('status')).toContainText('Acqua aggiunta');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
