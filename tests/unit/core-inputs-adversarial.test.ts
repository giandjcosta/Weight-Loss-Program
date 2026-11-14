/**
 * Adversarial / edge-case tests for core number and date input validation.
 * Written independently against the public contracts in docs/DATA_MODEL.md
 * and the exported APIs of src/core/{units,dates,validation}.
 * Does not modify application behaviour; reports failures as-is.
 */
import { describe, expect, it } from 'vitest';
import {
  checkRange,
  fromStorage,
  KG_PER_LB,
  kgToLb,
  lbToKg,
  parseDecimal,
  PLAUSIBLE,
  round,
  toStorage,
} from '../../src/core/units';
import {
  addDays,
  dayKeyOf,
  offsetMinutes,
  parseDayKey,
  parseIsoDateTime,
  toIsoWithOffset,
} from '../../src/core/dates';
import { validateRecord } from '../../src/core/validation';
import type { DayKey, TimeZone } from '../../src/core/types';

const rome = 'Europe/Rome' as TimeZone;
const day = (s: string) => s as DayKey;

function parseOk(input: string, locale: 'it' | 'en' = 'it'): number | 'ERR' {
  const r = parseDecimal(input, locale);
  return r.ok ? r.value : 'ERR';
}

describe('parseDecimal — Italian and English decimals', () => {
  it('accepts both comma and dot as decimal separator', () => {
    expect(parseOk('75,2', 'it')).toBe(75.2);
    expect(parseOk('75.2', 'it')).toBe(75.2);
    expect(parseOk('75,2', 'en')).toBe(75.2);
    expect(parseOk('75.2', 'en')).toBe(75.2);
  });

  it('trims whitespace and non-breaking spaces', () => {
    expect(parseOk('  80,5  ', 'it')).toBe(80.5);
    expect(parseOk('\u00a070.25\u00a0', 'en')).toBe(70.25);
  });

  it('parses signed values', () => {
    expect(parseOk('-12,5', 'it')).toBe(-12.5);
    expect(parseOk('+3.14', 'en')).toBe(3.14);
  });
});

describe('parseDecimal — thousands separators and ambiguous forms', () => {
  it('resolves mixed separators by last-separator-wins rule', () => {
    expect(parseOk('1.234,56', 'it')).toBe(1234.56);
    expect(parseOk('1,234.56', 'en')).toBe(1234.56);
  });

  it('treats three-digit groups after a non-locale decimal as thousands', () => {
    // Italian: dot is thousands when followed by exactly 3 digits
    expect(parseOk('1.234', 'it')).toBe(1234);
    // English: comma is thousands when followed by exactly 3 digits
    expect(parseOk('1,234', 'en')).toBe(1234);
  });

  it('keeps short fractional parts as decimals even with locale mismatch', () => {
    expect(parseOk('1.23', 'it')).toBe(1.23);
    expect(parseOk('1,23', 'en')).toBe(1.23);
  });

  it('rejects repeated separators that are not clean thousands groups', () => {
    expect(parseOk('1,2,3')).toBe('ERR');
    expect(parseOk('1.2.3')).toBe('ERR');
    expect(parseOk('12,34,56')).toBe('ERR');
  });

  it('rejects pure separator or empty numeric content', () => {
    for (const s of ['', '   ', ',', '.', '-,', '+.', ' ']) {
      expect(parseOk(s)).toBe('ERR');
    }
  });
});

describe('parseDecimal — non-finite and non-numeric rejection', () => {
  it('never coerces empty or garbage input to 0', () => {
    for (const s of ['', '  ', 'NaN', 'Infinity', '-Infinity', '1e3', 'abc', '7O', 'null']) {
      expect(parseOk(s)).toBe('ERR');
    }
  });

  it('rejects inputs that would produce non-finite numbers after normalisation', () => {
    // Extremely large digit strings that overflow Number → Infinity
    const huge = '9'.repeat(400);
    expect(parseOk(huge)).toBe('ERR');
  });
});

describe('checkRange and validation — zero, missing, negative, non-finite', () => {
  it('rejects NaN and Infinity for every plausible range', () => {
    for (const field of Object.keys(PLAUSIBLE) as (keyof typeof PLAUSIBLE)[]) {
      expect(checkRange(field, Number.NaN, 'x').ok).toBe(false);
      expect(checkRange(field, Number.POSITIVE_INFINITY, 'x').ok).toBe(false);
      expect(checkRange(field, Number.NEGATIVE_INFINITY, 'x').ok).toBe(false);
    }
  });

  it('rejects negative weight (below PLAUSIBLE.weightKg.min)', () => {
    expect(checkRange('weightKg', -1, 'kg').ok).toBe(false);
    expect(checkRange('weightKg', 0, 'kg').ok).toBe(false); // min is 20
    expect(checkRange('weightKg', 19.99, 'kg').ok).toBe(false);
    expect(checkRange('weightKg', 20, 'kg').ok).toBe(true);
  });

  it('allows zero for fields whose min is 0 (e.g. macros, steps)', () => {
    expect(checkRange('macroG', 0, 'g').ok).toBe(true);
    expect(checkRange('steps', 0, '').ok).toBe(true);
    expect(checkRange('kcalPerMeal', 0, 'kcal').ok).toBe(true);
  });

  it('validateRecord treats omitted optional numerics as valid (missing ≠ zero)', () => {
    // Weight entry with only required shape; kg present and in range
    const withKg = {
      dayKey: '2026-06-15',
      kg: 72.5,
      recordedAt: '2026-06-15T08:00:00+02:00',
    };
    expect(validateRecord('weights', withKg).ok).toBe(true);

    // Same record shape but kg omitted → still passes (optional at this layer)
    const withoutKg = {
      dayKey: '2026-06-15',
      recordedAt: '2026-06-15T08:00:00+02:00',
    };
    expect(validateRecord('weights', withoutKg).ok).toBe(true);

    // Explicit zero weight is rejected by range
    const zeroKg = {
      dayKey: '2026-06-15',
      kg: 0,
      recordedAt: '2026-06-15T08:00:00+02:00',
    };
    expect(validateRecord('weights', zeroKg).ok).toBe(false);
  });

  it('rejects non-finite kg on a weight record', () => {
    for (const bad of [Number.NaN, Infinity, -Infinity]) {
      const r = validateRecord('weights', {
        dayKey: '2026-06-15',
        kg: bad,
        recordedAt: '2026-06-15T08:00:00+02:00',
      });
      expect(r.ok).toBe(false);
    }
  });
});

describe('parseDayKey — impossible calendar dates and leap years', () => {
  it('rejects 30 February and 31 April', () => {
    expect(parseDayKey('2026-02-30')).toBeUndefined();
    expect(parseDayKey('2026-04-31')).toBeUndefined();
    expect(parseDayKey('2026-06-31')).toBeUndefined();
    expect(parseDayKey('2026-11-31')).toBeUndefined();
  });

  it('accepts 29 February only in leap years', () => {
    expect(parseDayKey('2024-02-29')).toBe('2024-02-29'); // leap
    expect(parseDayKey('2028-02-29')).toBe('2028-02-29'); // leap
    expect(parseDayKey('2026-02-29')).toBeUndefined(); // not leap
    expect(parseDayKey('2100-02-29')).toBeUndefined(); // century not divisible by 400
    expect(parseDayKey('2000-02-29')).toBe('2000-02-29'); // divisible by 400
  });

  it('rejects malformed or zero-padded-incorrect day keys', () => {
    expect(parseDayKey('2026-2-15')).toBeUndefined();
    expect(parseDayKey('2026-02-5')).toBeUndefined();
    expect(parseDayKey('26-02-15')).toBeUndefined();
    expect(parseDayKey('2026/02/15')).toBeUndefined();
  });
});

describe('parseIsoDateTime — impossible instants and DST boundaries', () => {
  it('rejects dates that do not exist on the calendar', () => {
    expect(parseIsoDateTime('2026-02-30T12:00:00+01:00')).toBeUndefined();
    expect(parseIsoDateTime('2026-04-31T08:00:00Z')).toBeUndefined();
    expect(parseIsoDateTime('2026-02-29T00:00:00Z')).toBeUndefined(); // non-leap
  });

  it('rejects out-of-range time components and extreme offsets', () => {
    expect(parseIsoDateTime('2026-11-13T24:00:00+01:00')).toBeUndefined();
    expect(parseIsoDateTime('2026-11-13T23:60:00+01:00')).toBeUndefined();
    expect(parseIsoDateTime('2026-11-13T08:00:00+15:00')).toBeUndefined();
    expect(parseIsoDateTime('2026-11-13T08:00:00+01:60')).toBeUndefined();
  });

  it('requires an explicit offset or Z', () => {
    expect(parseIsoDateTime('2026-11-13T08:00:00')).toBeUndefined();
  });

  it('accepts valid instants around Europe/Rome DST transitions (2026)', () => {
    // Spring forward 2026-03-29 02:00 → 03:00
    expect(parseIsoDateTime('2026-03-29T01:59:59+01:00')).toBeDefined();
    expect(parseIsoDateTime('2026-03-29T03:00:00+02:00')).toBeDefined();
    // Fall back 2026-10-25 03:00 → 02:00
    expect(parseIsoDateTime('2026-10-25T02:30:00+02:00')).toBeDefined();
    expect(parseIsoDateTime('2026-10-25T02:30:00+01:00')).toBeDefined();
  });

  it('dayKeyOf remains stable across the DST change day', () => {
    // 2026-03-29 00:30 UTC = 01:30 CET (still before jump)
    const before = new Date('2026-03-29T00:30:00Z');
    expect(dayKeyOf(before, rome)).toBe('2026-03-29');
    // After the jump: 01:30 UTC = 03:30 CEST
    const after = new Date('2026-03-29T01:30:00Z');
    expect(dayKeyOf(after, rome)).toBe('2026-03-29');
  });
});

describe('unit conversion precision (kg ↔ lb)', () => {
  it('uses the exact international definition of the pound', () => {
    expect(KG_PER_LB).toBe(0.45359237);
    expect(lbToKg(1)).toBe(0.45359237);
  });

  it('round-trips a typical body weight with sub-gram storage precision', () => {
    const kg = 75.2;
    const lb = fromStorage(toStorage(kg, 'kg'), 'lb');
    const back = fromStorage(toStorage(lb, 'lb'), 'kg');
    expect(round(back, 4)).toBe(round(kg, 4));
  });

  it('converts 154.32 lb ≈ 70 kg within expected rounding', () => {
    expect(round(lbToKg(154.32), 2)).toBe(70);
    expect(round(kgToLb(70), 2)).toBe(154.32);
  });
});

describe('calendar arithmetic remains DST-safe', () => {
  it('addDays does not skip or duplicate days around the 2026 spring transition', () => {
    expect(addDays(day('2026-03-28'), 1)).toBe('2026-03-29');
    expect(addDays(day('2026-03-29'), 1)).toBe('2026-03-30');
    expect(addDays(day('2026-03-28'), 2)).toBe('2026-03-30');
  });

  it('offsetMinutes reflects winter vs summer for Europe/Rome', () => {
    expect(offsetMinutes(new Date('2026-01-15T12:00:00Z'), rome)).toBe(60);
    expect(offsetMinutes(new Date('2026-07-15T12:00:00Z'), rome)).toBe(120);
  });

  it('toIsoWithOffset emits the correct offset around DST', () => {
    const winter = toIsoWithOffset(new Date('2026-12-01T10:00:00Z'), rome);
    expect(winter).toMatch(/\+01:00$/);
    const summer = toIsoWithOffset(new Date('2026-07-01T10:00:00Z'), rome);
    expect(summer).toMatch(/\+02:00$/);
  });
});
