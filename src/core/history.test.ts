import { describe, expect, it } from 'vitest';
import { entryInEffect } from './history';
import type { DayKey, GoalEntry, Id, IsoDateTime } from './types';

const goal = (
  id: string,
  effectiveFrom: string,
  targetKg: number,
  extra: Partial<GoalEntry> = {},
): GoalEntry => ({
  id: id as Id,
  schemaVersion: 1,
  createdAt: `${effectiveFrom}T09:00:00.000+01:00` as IsoDateTime,
  updatedAt: `${effectiveFrom}T09:00:00.000+01:00` as IsoDateTime,
  source: { kind: 'manual' },
  effectiveFrom: effectiveFrom as DayKey,
  direction: 'lose',
  startKg: 88,
  targetKg,
  setBy: 'user',
  ...extra,
});

describe('entryInEffect', () => {
  const history = [goal('a', '2026-09-01', 80), goal('b', '2026-10-15', 78)];

  it('past days keep the goal that was in effect then', () => {
    expect(entryInEffect(history, '2026-09-20' as DayKey)?.targetKg).toBe(80);
    expect(entryInEffect(history, '2026-10-15' as DayKey)?.targetKg).toBe(78);
    expect(entryInEffect(history, '2026-08-31' as DayKey)).toBeUndefined();
  });

  it('adding a new goal does not change the answer for earlier days', () => {
    const before = entryInEffect(history, '2026-09-20' as DayKey);
    const after = entryInEffect([...history, goal('c', '2026-11-01', 75)], '2026-09-20' as DayKey);
    expect(after).toEqual(before);
  });

  it('ignores withdrawn entries and breaks same-day ties by creation time', () => {
    const withdrawn = goal('b', '2026-10-15', 78, {
      deletedAt: '2026-10-16T00:00:00.000+01:00' as IsoDateTime,
    });
    expect(entryInEffect([history[0]!, withdrawn], '2026-11-01' as DayKey)?.targetKg).toBe(80);
    const sameDay = goal('d', '2026-10-15', 77, {
      createdAt: '2026-10-15T18:00:00.000+01:00' as IsoDateTime,
    });
    expect(entryInEffect([...history, sameDay], '2026-10-20' as DayKey)?.targetKg).toBe(77);
  });
});
