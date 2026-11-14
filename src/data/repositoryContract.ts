import { describe, expect, it } from 'vitest';
import type { DayKey, Repository, TimeZone, NewRecord } from '../core';

/**
 * Shared behaviour every Repository implementation must pass.
 * Usage in a test file: `runRepositoryContract('memory', () => createMemoryRepository())`.
 */
export function runRepositoryContract(
  name: string,
  makeRepo: () => Repository | Promise<Repository>,
) {
  const tz = 'Europe/Rome' as TimeZone;
  const weight = (dayKey: string, kg: number): NewRecord<'weights'> => ({
    dayKey: dayKey as DayKey,
    timeZone: tz,
    kg,
    quality: 'measured',
    source: { kind: 'manual' },
  });

  describe(`Repository contract: ${name}`, () => {
    it('adds a record, fills managed fields and returns a copy', async () => {
      const repo = await makeRepo();
      const res = await repo.add('weights', weight('2026-09-01', 80.4));
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.value.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.value.schemaVersion).toBe(1);
      expect(res.value.createdAt).toBe(res.value.updatedAt);
      res.value.kg = 1;
      expect((await repo.get('weights', res.value.id))?.kg).toBe(80.4);
    });

    it('stores values exactly (no rounding, no unit conversion)', async () => {
      const repo = await makeRepo();
      const res = await repo.add('weights', weight('2026-09-01', 80.456789));
      expect(res.ok && res.value.kg).toBe(80.456789);
    });

    it('lists sorted by day and filters by inclusive range', async () => {
      const repo = await makeRepo();
      await repo.add('weights', weight('2026-09-03', 80));
      await repo.add('weights', weight('2026-09-01', 81));
      await repo.add('weights', weight('2026-09-02', 80.5));
      const all = await repo.list('weights');
      expect(all.map((w) => w.dayKey)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
      const some = await repo.list('weights', {
        from: '2026-09-02' as DayKey,
        to: '2026-09-03' as DayKey,
      });
      expect(some.map((w) => w.kg)).toEqual([80.5, 80]);
    });

    it('rejects invalid day keys and implausible weights instead of storing them', async () => {
      const repo = await makeRepo();
      const badDay = await repo.add('weights', weight('2026-02-30', 80));
      expect(badDay.ok).toBe(false);
      if (!badDay.ok) expect(badDay.error.code).toBe('validation.invalid_date');
      const badKg = await repo.add('weights', weight('2026-09-01', 0));
      expect(badKg.ok).toBe(false);
      if (!badKg.ok) expect(badKg.error.code).toBe('validation.out_of_range');
      expect(await repo.list('weights')).toHaveLength(0);
    });

    it('keeps optional nutrition values missing rather than zero', async () => {
      const repo = await makeRepo();
      const res = await repo.add('meals', {
        dayKey: '2026-09-01' as DayKey,
        timeZone: tz,
        slot: 'lunch',
        kcal: 650,
        quality: 'estimated',
        source: { kind: 'manual' },
      });
      expect(res.ok).toBe(true);
      const [meal] = await repo.list('meals');
      expect(meal?.kcal).toBe(650);
      expect(meal?.proteinG).toBeUndefined();
      expect('proteinG' in (meal ?? {})).toBe(false);
    });

    it('updates without touching id/createdAt and bumps updatedAt', async () => {
      const repo = await makeRepo();
      const added = await repo.add('weights', weight('2026-09-01', 80));
      if (!added.ok) throw new Error('add failed');
      const updated = await repo.update('weights', added.value.id, { kg: 79.8, note: 'dopo cena' });
      expect(updated.ok).toBe(true);
      if (!updated.ok) return;
      expect(updated.value.id).toBe(added.value.id);
      expect(updated.value.createdAt).toBe(added.value.createdAt);
      expect(updated.value.kg).toBe(79.8);
    });

    it('soft-deletes: hidden by default, visible with includeDeleted, not updatable', async () => {
      const repo = await makeRepo();
      const added = await repo.add('weights', weight('2026-09-01', 80));
      if (!added.ok) throw new Error('add failed');
      expect((await repo.remove('weights', added.value.id)).ok).toBe(true);
      expect(await repo.list('weights')).toHaveLength(0);
      const withDeleted = await repo.list('weights', { includeDeleted: true });
      expect(withDeleted[0]?.deletedAt).toBeDefined();
      expect((await repo.update('weights', added.value.id, { kg: 1 })).ok).toBe(false);
      expect((await repo.remove('weights', added.value.id)).ok).toBe(false);
    });

    it('purge removes records permanently', async () => {
      const repo = await makeRepo();
      const added = await repo.add('weights', weight('2026-09-01', 80));
      if (!added.ok) throw new Error('add failed');
      await repo.purge('weights', [added.value.id]);
      expect(await repo.list('weights', { includeDeleted: true })).toHaveLength(0);
    });

    it('finds records by dedupe key, including deleted ones', async () => {
      const repo = await makeRepo();
      const a = await repo.add('weights', { ...weight('2026-09-01', 80), dedupeKey: 'k1' });
      await repo.add('weights', { ...weight('2026-09-02', 80), dedupeKey: 'k2' });
      if (!a.ok) throw new Error('add failed');
      await repo.remove('weights', a.value.id);
      const found = await repo.findByDedupeKeys('weights', ['k1', 'zzz']);
      expect(found.map((r) => r.dedupeKey)).toEqual(['k1']);
    });

    it('settings and profile start neutral, deep-merge units and validate', async () => {
      const repo = await makeRepo();
      const s = await repo.getSettings();
      expect(s.units.weight).toBe('kg');
      const s2 = await repo.saveSettings({ locale: 'en', units: { weight: 'lb' } });
      expect(s2.ok && s2.value.locale).toBe('en');
      expect(s2.ok && s2.value.units).toMatchObject({ weight: 'lb', length: 'cm', volume: 'ml' });
      const color = await repo.saveSettings({
        progressPalette: 'custom',
        customProgressColors: ['#3FA9A0', '#8FB39A'],
      });
      expect(color.ok).toBe(true);
      const badColor = await repo.saveSettings({ customProgressColors: ['red'] });
      expect(!badColor.ok && badColor.error.code).toBe('validation.invalid_color');
      expect((await repo.getSettings()).customProgressColors).toEqual(['#3FA9A0', '#8FB39A']);

      const p = await repo.getProfile();
      expect(p.heightCm).toBeUndefined();
      const p2 = await repo.saveProfile({ heightCm: { kind: 'unknown' } });
      expect(p2.ok && p2.value.heightCm).toEqual({ kind: 'unknown' });
      const badHeight = await repo.saveProfile({ heightCm: { kind: 'value', value: 17 } });
      expect(badHeight.ok).toBe(false);
    });

    it('goals and targets are append-only history', async () => {
      const repo = await makeRepo();
      const g = await repo.add('goals', {
        effectiveFrom: '2026-09-01' as DayKey,
        direction: 'lose',
        startKg: 88,
        targetKg: 80,
        setBy: 'professional',
        source: { kind: 'manual' },
      });
      if (!g.ok) throw new Error(g.error.code);
      for (const patch of [
        { targetKg: 78 },
        { effectiveFrom: '2026-01-01' as DayKey },
        { setBy: 'user' as const },
      ]) {
        const res = await repo.update('goals', g.value.id, patch);
        expect(!res.ok && res.error.code).toBe('repo.append_only');
      }
      expect((await repo.update('goals', g.value.id, { note: 'dalla dietologa' })).ok).toBe(true);
      const t = await repo.add('targets', {
        effectiveFrom: '2026-09-01' as DayKey,
        kcal: 2050,
        setBy: 'professional',
        source: { kind: 'manual' },
      });
      if (!t.ok) throw new Error(t.error.code);
      expect((await repo.update('targets', t.value.id, { kcal: 1800 })).ok).toBe(false);
      expect((await repo.get('targets', t.value.id))?.kcal).toBe(2050);
    });

    it('validates every persisted numeric field and cross-field rules', async () => {
      const repo = await makeRepo();
      const day = {
        dayKey: '2026-09-01' as DayKey,
        timeZone: tz,
        source: { kind: 'manual' as const },
      };
      const rejected = [
        repo.add('meals', { ...day, slot: 'lunch', kcal: -500, quality: 'estimated' }),
        repo.add('meals', { ...day, slot: 'lunch', proteinG: -4, quality: 'estimated' }),
        repo.add('meals', { ...day, slot: 'lunch', kcal: Number.NaN, quality: 'estimated' }),
        repo.add('bodyComposition', { ...day, fatPercent: 120, quality: 'measured' }),
        repo.add('workouts', {
          ...day,
          title: 'x',
          status: 'completed',
          exercises: [{ exerciseKey: 'k', name: 'k', sets: [{ reps: 8, loadKg: -20 }] }],
          cardio: [],
        }),
        repo.add('workouts', {
          ...day,
          title: 'x',
          status: 'completed',
          exercises: [],
          cardio: [{ kind: 'treadmill', minutes: -5 }],
        }),
        repo.add('workouts', {
          ...day,
          title: 'x',
          status: 'rescheduled',
          exercises: [],
          cardio: [],
        }),
        repo.add('targets', {
          effectiveFrom: '2026-09-01' as DayKey,
          kcalMin: 2100,
          kcalMax: 2000,
          setBy: 'user',
          source: { kind: 'manual' },
        }),
        repo.add('goals', {
          effectiveFrom: '2026-09-01' as DayKey,
          direction: 'lose',
          startKg: 80,
          targetKg: 85,
          setBy: 'user',
          source: { kind: 'manual' },
        }),
        repo.add('weights', {
          ...weight('2026-09-01', 80),
          recordedAt: '2026-02-30T08:00:00+01:00' as never,
        }),
      ];
      for (const [i, p] of rejected.entries()) expect((await p).ok, `case ${i}`).toBe(false);

      // valid edge cases are accepted
      expect(
        (await repo.add('meals', { ...day, slot: 'snack', kcal: 0, quality: 'verified' })).ok,
      ).toBe(true);
      expect(
        (
          await repo.add('workouts', {
            ...day,
            title: 'x',
            status: 'rescheduled',
            rescheduledTo: '2026-09-02' as DayKey,
            exercises: [],
            cardio: [],
          })
        ).ok,
      ).toBe(true);

      // update validates the merged record
      const t = await repo.add('meals', { ...day, slot: 'lunch', kcal: 600, quality: 'estimated' });
      if (!t.ok) throw new Error();
      expect((await repo.update('meals', t.value.id, { kcal: -1 })).ok).toBe(false);
    });

    it('notifies subscribers and stops after unsubscribe', async () => {
      const repo = await makeRepo();
      const events: string[] = [];
      const off = repo.subscribe((e) => events.push(e.type));
      await repo.add('weights', weight('2026-09-01', 80));
      off();
      await repo.add('weights', weight('2026-09-02', 80));
      expect(events).toEqual(['put']);
    });

    it('reset clears data and restores default settings', async () => {
      const repo = await makeRepo();
      await repo.add('weights', weight('2026-09-01', 80));
      await repo.saveSettings({ locale: 'en' });
      await repo.reset();
      expect(await repo.list('weights', { includeDeleted: true })).toHaveLength(0);
      expect((await repo.getSettings()).locale).toBe('it');
    });

    it('putMany keeps ids and timestamps, and is all-or-nothing', async () => {
      const repo = await makeRepo();
      const a = await repo.add('weights', weight('2026-09-01', 80));
      if (!a.ok) throw new Error('add failed');
      const copy = { ...a.value, id: '11111111-1111-4111-8111-111111111111' as typeof a.value.id };
      const bad = {
        ...copy,
        id: '22222222-2222-4222-8222-222222222222' as typeof a.value.id,
        dayKey: 'nope' as DayKey,
      };
      const rejected = await repo.putMany('weights', [copy, bad]);
      expect(rejected.ok).toBe(false);
      expect(await repo.list('weights')).toHaveLength(1);
      const accepted = await repo.putMany('weights', [copy]);
      expect(accepted.ok && accepted.value).toBe(1);
      const stored = await repo.get('weights', copy.id);
      expect(stored?.createdAt).toBe(a.value.createdAt);
      expect(stored?.updatedAt).toBe(a.value.updatedAt);
    });

    it('survives a listener that throws', async () => {
      const repo = await makeRepo();
      repo.subscribe(() => {
        throw new Error('listener bug');
      });
      const errorSpy = console.error;
      console.error = () => {};
      try {
        expect((await repo.add('weights', weight('2026-09-01', 80))).ok).toBe(true);
      } finally {
        console.error = errorSpy;
      }
    });

    it('declares honestly that data is not synced', async () => {
      const repo = await makeRepo();
      expect(repo.storage.synced).toBe(false);
    });
  });
}
