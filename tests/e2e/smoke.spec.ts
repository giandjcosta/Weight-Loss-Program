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


test('meal can be added, edited, and removed without losing unknown nutrients', async ({ page }) => {
  await page.goto('./');
  await page.locator('button[data-page="diary"]:visible').first().click();
  await page.getByRole('button', { name: '＋ Pasto', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await dialog.locator('input[name="name"]').fill('Pasto QA sintetico');
  await dialog.locator('input[name="kcal"]').fill('650');
  await dialog.getByRole('button', { name: 'Salva demo' }).click();
  await expect(dialog).toBeHidden();

  const entry = page.locator('.entry').filter({ hasText: 'Pasto QA sintetico' });
  await expect(entry).toContainText('650 kcal');
  await page.getByRole('button', { name: 'Modifica Pasto QA sintetico' }).click();
  await dialog.locator('input[name="kcal"]').fill('');
  await dialog.getByRole('button', { name: 'Salva demo' }).click();
  await expect(entry).toContainText('kcal non indicate');

  page.once('dialog', async (confirmation) => confirmation.accept());
  await page.getByRole('button', { name: 'Elimina Pasto QA sintetico' }).click();
  await expect(entry).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /Il tuo diario/ })).toBeVisible();
});

test('workout edit, reset, and demo-only storage work in desktop and mobile', async ({ page }) => {
  await page.goto('./');
  await page.locator('button[data-page="training"]:visible').first().click();
  await page.getByRole('button', { name: /Sessione/ }).click();

  const dialog = page.getByRole('dialog');
  await dialog.locator('input[name="title"]').fill('Sessione QA sintetica');
  await dialog.locator('input[name="duration"]').fill('42');
  await dialog.getByRole('button', { name: 'Salva demo' }).click();

  const entry = page.locator('.entry').filter({ hasText: 'Sessione QA sintetica' });
  await expect(entry).toContainText('42 min');
  await page.getByRole('button', { name: 'Modifica Sessione QA sintetica' }).click();
  await dialog.locator('input[name="duration"]').fill('50');
  await dialog.getByRole('button', { name: 'Salva demo' }).click();
  await expect(entry).toContainText('50 min');

  await page.locator('button[data-page="settings"]:visible').first().click();
  await page.locator('select[name="theme"]').selectOption('light');
  await page.getByRole('button', { name: 'Salva nella demo' }).click();
  await expect(page.locator('.ritmea')).toHaveClass(/light/);

  page.once('dialog', async (confirmation) => confirmation.accept());
  await page.getByRole('button', { name: /Ripristina dati demo/ }).click();
  await expect(page.locator('.ritmea')).toHaveClass(/dark/);
  await page.locator('button[data-page="training"]:visible').first().click();
  await expect(page.getByText('Sessione QA sintetica')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
