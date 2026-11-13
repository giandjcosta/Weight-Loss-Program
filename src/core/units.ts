import type { Settings } from './types';
import { err, ok, type Result } from './result';
import { msg } from './messages';

/** Exact conversion factors (international definitions). */
export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;
export const ML_PER_US_FL_OZ = 29.5735295625;
export const KM_PER_MI = 1.609344;
export const KJ_PER_KCAL = 4.184;

export const lbToKg = (lb: number): number => lb * KG_PER_LB;
export const kgToLb = (kg: number): number => kg / KG_PER_LB;
export const inToCm = (inches: number): number => inches * CM_PER_IN;
export const cmToIn = (cm: number): number => cm / CM_PER_IN;
export const flOzToMl = (oz: number): number => oz * ML_PER_US_FL_OZ;
export const mlToFlOz = (ml: number): number => ml / ML_PER_US_FL_OZ;
export const miToKm = (mi: number): number => mi * KM_PER_MI;
export const kmToMi = (km: number): number => km / KM_PER_MI;
export const kjToKcal = (kj: number): number => kj / KJ_PER_KCAL;
export const kcalToKj = (kcal: number): number => kcal * KJ_PER_KCAL;

/** Feet + inches → cm (e.g. 5 ft 7 in). */
export const feetInchesToCm = (feet: number, inches: number): number => inToCm(feet * 12 + inches);
/** cm → whole feet + inches rounded to `inchDecimals`, carrying 12 in to the next foot. */
export function cmToFeetInches(cm: number, inchDecimals = 0): { feet: number; inches: number } {
  const f = 10 ** inchDecimals;
  const totalIn = Math.round(cmToIn(cm) * f) / f;
  const feet = Math.floor(totalIn / 12);
  const inches = Math.round((totalIn - feet * 12) * f) / f;
  return { feet, inches };
}

export const round = (value: number, decimals: number): number => {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON * Math.sign(value)) * f) / f;
};

type Dimension = keyof Settings['units'];
type DisplayUnit = Settings['units'][Dimension];

const toCanonical: Record<DisplayUnit, (v: number) => number> = {
  kg: (v) => v,
  lb: lbToKg,
  cm: (v) => v,
  in: inToCm,
  ml: (v) => v,
  fl_oz: flOzToMl,
  km: (v) => v,
  mi: miToKm,
  kcal: (v) => v,
  kj: kjToKcal,
};
const fromCanonical: Record<DisplayUnit, (v: number) => number> = {
  kg: (v) => v,
  lb: kgToLb,
  cm: (v) => v,
  in: cmToIn,
  ml: (v) => v,
  fl_oz: mlToFlOz,
  km: (v) => v,
  mi: kmToMi,
  kcal: (v) => v,
  kj: kcalToKj,
};

/** Convert a value typed in `unit` to canonical storage units (kg, cm, ml, km, kcal). */
export const toStorage = (value: number, unit: DisplayUnit): number => toCanonical[unit](value);
/** Convert a stored canonical value to the display `unit`. */
export const fromStorage = (value: number, unit: DisplayUnit): number => fromCanonical[unit](value);

/**
 * Parse a user-typed decimal number. Accepts `75,2`, `75.2`, `1.234,5`, `1,234.5`, spaces and
 * a leading +/-. Rejects empty strings, letters and ambiguous inputs like `1,234` (is it 1234
 * or 1.234?) unless `locale` disambiguates.
 */
export function parseDecimal(input: string, locale: 'it' | 'en' = 'it'): Result<number> {
  const raw = input.trim().replace(/[\s\u00a0\u202f']/g, '');
  const bad = () => err<number>(msg('validation.not_a_number', { field: 'value', input }));
  if (raw === '' || !/^[+-]?[\d.,]+$/.test(raw) || !/\d/.test(raw)) return bad();
  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    // both present: the last one is the decimal separator
    const dec = lastComma > lastDot ? ',' : '.';
    const thou = dec === ',' ? '.' : ',';
    normalized = raw.split(thou).join('').replace(dec, '.');
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? ',' : '.';
    const parts = raw.split(sep);
    if (parts.length > 2) {
      // repeated separator → thousands grouping, e.g. 1.234.567
      if (!parts.slice(1).every((p) => p.length === 3)) return bad();
      normalized = parts.join('');
    } else {
      const decimals = parts[1] ?? '';
      const localeDecimal = locale === 'it' ? ',' : '.';
      const looksLikeThousands =
        decimals.length === 3 && (parts[0] ?? '').replace(/[+-]/, '') !== '0';
      normalized = looksLikeThousands && sep !== localeDecimal ? parts.join('') : parts.join('.');
    }
  } else {
    normalized = raw;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? ok(n) : bad();
}

/** Plausibility ranges for canonical values (inclusive). Outside → validation error, not clamp. */
export const PLAUSIBLE = {
  weightKg: { min: 20, max: 400 },
  heightCm: { min: 90, max: 260 },
  kcalPerMeal: { min: 0, max: 10_000 },
  macroG: { min: 0, max: 1_000 },
  waterMl: { min: 1, max: 5_000 },
  loadKg: { min: 0, max: 1_000 },
  reps: { min: 0, max: 1_000 },
  minutes: { min: 0, max: 1_440 },
  inclinePercent: { min: -10, max: 40 },
  fatPercent: { min: 2, max: 75 },
  bodyMassKg: { min: 0, max: 400 },
  durationSec: { min: 0, max: 86_400 },
  distanceKm: { min: 0, max: 500 },
  heartRate: { min: 20, max: 250 },
  steps: { min: 0, max: 200_000 },
  activeKcal: { min: 0, max: 20_000 },
  kcalPerDay: { min: 0, max: 20_000 },
  waterTargetMl: { min: 0, max: 10_000 },
  maintainBandKg: { min: 0.1, max: 20 },
  birthYear: { min: 1900, max: 2100 },
  portionQuantity: { min: 0, max: 100_000 },
} as const;

export function checkRange(
  field: keyof typeof PLAUSIBLE,
  value: number,
  unit: string,
): Result<number> {
  const r = PLAUSIBLE[field];
  if (!Number.isFinite(value) || value < r.min || value > r.max) {
    return err(msg('validation.out_of_range', { field, min: r.min, max: r.max, unit }));
  }
  return ok(value);
}
