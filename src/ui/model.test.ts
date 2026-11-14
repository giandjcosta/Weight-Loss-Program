import { describe, expect, it } from 'vitest';
import { addDays, type DayKey, type TimeZone, type WorkoutSession } from '../core';
import { createMemoryRepository } from '../data/memoryRepository';
import { createDemoDataset, DEMO_DAYS, DEMO_START_DAY } from '../data/fixtures/demo';
import { deriveDay, readSnapshot, statusDescription, workoutEditPatch } from './model';

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

describe('workoutEditPatch (Claude review of PR #10)', () => {
  const base = {
    id: '00000000-0000-4000-8000-000000000001',
    schemaVersion: 1,
    createdAt: '2026-10-14T19:00:00.000+02:00',
    updatedAt: '2026-10-14T19:00:00.000+02:00',
    source: { kind: 'demo' },
    dayKey: '2026-10-14',
    timeZone: 'Europe/Rome',
    title: 'Lower body',
    status: 'completed',
    durationMin: 81,
    exercises: [{ exerciseKey: 'leg-press', name: 'Leg press', sets: [{ reps: 8, loadKg: 60 }] }],
    cardio: [
      { kind: 'treadmill', minutes: 20, distanceKm: 2.4, inclinePercent: 5 },
      { kind: 'bike', minutes: 10 },
    ],
  } as unknown as WorkoutSession;
  const form = {
    dayKey: '2026-10-14' as DayKey,
    title: 'Lower body',
    status: 'completed' as const,
    durationMin: 85,
    rescheduledTo: undefined,
    treadmillMinutes: 25,
  };

  it('never touches stored exercises and keeps treadmill distance/incline and other cardio', () => {
    const patch = workoutEditPatch(base, form);
    expect('exercises' in patch).toBe(false);
    expect(patch.cardio).toEqual([
      { kind: 'bike', minutes: 10 },
      { kind: 'treadmill', minutes: 25, distanceKm: 2.4, inclinePercent: 5 },
    ]);
  });

  it('clears treadmill only when its field is emptied, and reschedule date unless rescheduled', () => {
    const patch = workoutEditPatch(base, { ...form, treadmillMinutes: undefined });
    expect(patch.cardio).toEqual([{ kind: 'bike', minutes: 10 }]);
    expect(patch.rescheduledTo).toBeUndefined();
    const moved = workoutEditPatch(base, {
      ...form,
      status: 'rescheduled',
      rescheduledTo: '2026-10-16' as DayKey,
    });
    expect(moved.rescheduledTo).toBe('2026-10-16');
  });
});
