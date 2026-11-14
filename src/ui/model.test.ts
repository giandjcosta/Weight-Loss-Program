import { describe, expect, it } from 'vitest';
import { addDays, type DayKey, type TimeZone } from '../core';
import { createMemoryRepository } from '../data/memoryRepository';
import { createDemoDataset, DEMO_DAYS, DEMO_START_DAY } from '../data/fixtures/demo';
import { deriveDay, readSnapshot, statusDescription } from './model';

const demoDay = addDays(DEMO_START_DAY, DEMO_DAYS - 1);
const tz = 'Europe/Rome' as TimeZone;

describe('UI model: synthetic Repository integration', () => {
  it('uses the memory demo only, with data marked as synthetic', async () => {
    const repo = createMemoryRepository({ seed: createDemoDataset() });
    const s = await readSnapshot(repo);
    expect(repo.storage.kind).toBe('memory');
    expect(repo.storage.synced).toBe(false);
    expect(s.weights.every((w) => w.source.kind === 'demo')).toBe(true);
  });
  it('does not coerce unlogged nutrition or water to zero', async () => {
    const repo = createMemoryRepository();
    const view = deriveDay(await readSnapshot(repo), '2026-11-01' as DayKey);
    expect(view.mealKcal).toBeUndefined();
    expect(view.waterMl).toBeUndefined();
    expect(statusDescription(view.status, 'nutrition')).toBe('Stato non indicato');
  });
  it('shows only documented meal calories, even with missing macro fields', async () => {
    const repo = createMemoryRepository();
    await repo.add('meals', {
      dayKey: demoDay,
      timeZone: tz,
      slot: 'lunch',
      quality: 'estimated',
      kcal: 410,
      source: { kind: 'demo' },
    });
    await repo.add('meals', {
      dayKey: demoDay,
      timeZone: tz,
      slot: 'dinner',
      quality: 'estimated',
      source: { kind: 'demo' },
    });
    expect(deriveDay(await readSnapshot(repo), demoDay).mealKcal).toBe(410);
  });
  it('updates dashboard totals from Repository writes', async () => {
    const repo = createMemoryRepository();
    await repo.add('water', { dayKey: demoDay, timeZone: tz, ml: 250, source: { kind: 'manual' } });
    await repo.add('water', { dayKey: demoDay, timeZone: tz, ml: 500, source: { kind: 'manual' } });
    expect(deriveDay(await readSnapshot(repo), demoDay).waterMl).toBe(750);
  });
  it('new goals must not rewrite what was in effect earlier', async () => {
    const repo = createMemoryRepository({ seed: createDemoDataset() });
    const before = deriveDay(await readSnapshot(repo), demoDay).goal?.targetKg;
    await repo.add('goals', {
      effectiveFrom: addDays(demoDay, 2),
      direction: 'lose',
      startKg: 84,
      targetKg: 75,
      setBy: 'user',
      source: { kind: 'manual' },
    });
    expect(deriveDay(await readSnapshot(repo), demoDay).goal?.targetKg).toBe(before);
  });
  it('does not offer progress without weight or goal', async () => {
    const repo = createMemoryRepository();
    expect(deriveDay(await readSnapshot(repo), demoDay).progressPercent).toBeUndefined();
  });
});
