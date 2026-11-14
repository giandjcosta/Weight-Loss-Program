import { describe, expect, it } from 'vitest';
import {
  checkRange,
  cmToFeetInches,
  feetInchesToCm,
  fromStorage,
  kgToLb,
  lbToKg,
  parseDecimal,
  round,
  toStorage,
} from './units';

describe('unit conversions', () => {
  it('uses exact international definitions', () => {
    expect(lbToKg(1)).toBe(0.45359237);
    expect(round(kgToLb(70), 2)).toBe(154.32);
    expect(feetInchesToCm(5, 7)).toBeCloseTo(170.18, 10);
    expect(cmToFeetInches(170)).toEqual({ feet: 5, inches: 7 });
    expect(cmToFeetInches(182.88)).toEqual({ feet: 6, inches: 0 });
  });

  it('round-trips every display unit through canonical storage', () => {
    for (const unit of ['kg', 'lb', 'cm', 'in', 'ml', 'fl_oz', 'km', 'mi', 'kcal', 'kj'] as const) {
      expect(fromStorage(toStorage(123.4, unit), unit)).toBeCloseTo(123.4, 9);
    }
  });

  it('rounds half away from zero without float artefacts', () => {
    expect(round(1.005, 2)).toBe(1.01);
    expect(round(75.25, 1)).toBe(75.3);
  });
});

describe('parseDecimal', () => {
  const ok = (s: string, locale: 'it' | 'en' = 'it') => {
    const r = parseDecimal(s, locale);
    return r.ok ? r.value : 'ERR';
  };
  it('accepts comma and dot decimals', () => {
    expect(ok('75,2')).toBe(75.2);
    expect(ok('75.2')).toBe(75.2);
    expect(ok(' 0,5 ')).toBe(0.5);
    expect(ok('-3')).toBe(-3);
  });
  it('handles thousands separators by locale', () => {
    expect(ok('1.234,5')).toBe(1234.5);
    expect(ok('1,234.5', 'en')).toBe(1234.5);
    expect(ok('1.234')).toBe(1234); // Italian: dot + 3 digits = thousands
    expect(ok('1.234', 'en')).toBe(1.234);
    expect(ok('2 050')).toBe(2050);
    expect(ok('0,500')).toBe(0.5);
  });
  it('rejects empty and non-numeric input instead of returning 0', () => {
    for (const s of ['', '  ', 'abc', '7O', '1,2,3', ',', '.']) expect(ok(s)).toBe('ERR');
  });
});

describe('checkRange', () => {
  it('flags implausible values', () => {
    expect(checkRange('weightKg', 75, 'kg').ok).toBe(true);
    expect(checkRange('weightKg', 7.5, 'kg').ok).toBe(false);
    expect(checkRange('weightKg', Number.NaN, 'kg').ok).toBe(false);
  });
});
