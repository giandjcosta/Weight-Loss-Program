import { describe, expect, it } from 'vitest';
import type { DayKey, TimeZone } from './types';
import {
  addDays,
  dayKeyOf,
  dayRange,
  daysBetween,
  isoWeekday,
  offsetMinutes,
  parseDayKey,
  parseIsoDateTime,
  toIsoWithOffset,
  weekStart,
} from './dates';

const rome = 'Europe/Rome' as TimeZone;
const ny = 'America/New_York' as TimeZone;
const d = (s: string) => s as DayKey;

describe('dates', () => {
  it('derives the local day, not the UTC day', () => {
    const lateEvening = new Date('2026-11-13T23:30:00Z'); // 00:30 next day in Rome
    expect(dayKeyOf(lateEvening, rome)).toBe('2026-11-14');
    expect(dayKeyOf(lateEvening, ny)).toBe('2026-11-13');
  });

  it('formats ISO strings with the correct DST offset', () => {
    expect(offsetMinutes(new Date('2026-07-01T10:00:00Z'), rome)).toBe(120);
    expect(offsetMinutes(new Date('2026-12-01T10:00:00Z'), rome)).toBe(60);
    expect(toIsoWithOffset(new Date('2026-12-01T10:00:00Z'), rome)).toBe(
      '2026-12-01T11:00:00.000+01:00',
    );
    expect(toIsoWithOffset(new Date('2026-12-01T10:00:00Z'), ny)).toBe(
      '2026-12-01T05:00:00.000-05:00',
    );
  });

  it('validates day keys and ISO instants', () => {
    expect(parseDayKey('2026-02-28')).toBe('2026-02-28');
    expect(parseDayKey('2026-02-29')).toBeUndefined();
    expect(parseDayKey('2028-02-29')).toBe('2028-02-29');
    expect(parseDayKey('2026-1-5')).toBeUndefined();
    expect(parseIsoDateTime('2026-11-13T08:00:00+01:00')).toBeDefined();
    expect(parseIsoDateTime('2026-11-13T08:00:00')).toBeUndefined(); // no offset → rejected
  });

  it('does calendar arithmetic across DST and month ends', () => {
    expect(addDays(d('2026-03-28'), 2)).toBe('2026-03-30'); // DST change in Europe
    expect(addDays(d('2026-12-31'), 1)).toBe('2027-01-01');
    expect(daysBetween(d('2026-10-24'), d('2026-10-26'))).toBe(2);
    expect(dayRange(d('2026-09-29'), d('2026-10-02'))).toHaveLength(4);
    expect(dayRange(d('2026-10-02'), d('2026-09-29'))).toEqual([]);
  });

  it('uses ISO weeks starting on Monday', () => {
    expect(isoWeekday(d('2026-11-16'))).toBe(1);
    expect(isoWeekday(d('2026-11-15'))).toBe(7);
    expect(weekStart(d('2026-11-15'))).toBe('2026-11-09');
  });
});

describe('parseIsoDateTime rejects impossible instants', () => {
  it.each([
    '2026-02-30T11:00:00+01:00',
    '2026-02-29T11:00:00Z', // not a leap year
    '2026-04-31T08:00:00+02:00',
    '2026-11-13T24:00:00+01:00',
    '2026-11-13T23:60:00+01:00',
    '2026-11-13T23:59:60+01:00',
    '2026-11-13T08:00:00+15:00',
    '2026-11-13T08:00:00+01:60',
  ])('%s', (v) => expect(parseIsoDateTime(v)).toBeUndefined());

  it.each([
    '2028-02-29T07:30:00.000+01:00', // leap day
    '2026-03-29T01:59:59+01:00', // just before Europe DST switch
    '2026-03-29T03:00:00+02:00', // just after
    '2026-10-25T02:30:00+02:00', // repeated hour, first occurrence
    '2026-10-25T02:30:00+01:00', // repeated hour, second occurrence
    '2026-11-13T08:00:00+14:00',
    '2026-11-13T08:00Z',
  ])('accepts %s', (v) => expect(parseIsoDateTime(v)).toBe(v));
});
