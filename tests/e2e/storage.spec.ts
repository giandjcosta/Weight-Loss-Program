import { expect, test, type Page } from '@playwright/test';

// Runs in real Chromium IndexedDB (project "storage", Vite dev server).
const open = async (page: Page, db: string) => {
  await page.goto(`tests/e2e/harness/storage.html?db=${db}`);
  await expect(page.locator('#status')).toHaveText('ready');
};

test('data survives a page reload', async ({ page }) => {
  const db = `e2e-reload-${Date.now()}`;
  await open(page, db);
  await page.evaluate(async () => {
    const r = await window.ritmea.repo.add('weights', {
      dayKey: '2026-09-01' as never,
      timeZone: 'Europe/Rome' as never,
      kg: 80.4,
      quality: 'measured',
      source: { kind: 'manual' },
    });
    if (!r.ok) throw new Error(r.error.code);
    await window.ritmea.repo.saveSettings({ locale: 'en' });
  });
  await page.reload();
  await expect(page.locator('#status')).toHaveText('ready');
  const after = await page.evaluate(async () => ({
    kgs: (await window.ritmea.repo.list('weights')).map((w) => w.kg),
    locale: (await window.ritmea.repo.getSettings()).locale,
    storage: window.ritmea.repo.storage,
  }));
  expect(after.kgs).toEqual([80.4]);
  expect(after.locale).toBe('en');
  expect(after.storage).toMatchObject({ kind: 'indexeddb', synced: false });
});

test('backup → wipe → restore in the browser gives back the same data', async ({ page }) => {
  const db = `e2e-backup-${Date.now()}`;
  await open(page, db);
  const result = await page.evaluate(async () => {
    const { repo, createBackup, serializeBackup, parseBackup, restoreBackup } = window.ritmea;
    for (const [day, kg] of [
      ['2026-09-01', 80.4],
      ['2026-09-03', 80.1],
    ] as const) {
      await repo.add('weights', {
        dayKey: day as never,
        timeZone: 'Europe/Rome' as never,
        kg,
        quality: 'measured',
        source: { kind: 'manual' },
      });
    }
    const before = await repo.list('weights');
    const json = serializeBackup(await createBackup(repo));
    await repo.reset();
    const emptied = (await repo.list('weights')).length;
    const parsed = parseBackup(json);
    if (!parsed.ok) throw new Error(parsed.error.code);
    const restored = await restoreBackup(repo, parsed.value, 'replace');
    return { before, emptied, ok: restored.ok, after: await repo.list('weights') };
  });
  expect(result.emptied).toBe(0);
  expect(result.ok).toBe(true);
  expect(result.after).toEqual(result.before);
});
