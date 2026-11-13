/**
 * Persistence-boundary validation, shared by the Repository, importers and UI forms.
 * Forms may add friendlier checks, but nothing invalid reaches storage through any path.
 */
import { parseDayKey, parseIsoDateTime } from './dates';
import { msg } from './messages';
import { err, ok, type Result } from './result';
import { SCHEMA_VERSION, type CollectionName, type Profile, type Settings } from './types';
import { PLAUSIBLE } from './units';

type Rec = Record<string, unknown>;
type RangeKey = keyof typeof PLAUSIBLE;

const isObj = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

function num(rec: Rec, field: string, range: RangeKey, unit: string, path = field): Result<true> {
  const v = rec[field];
  if (v === undefined) return ok(true);
  const r = PLAUSIBLE[range];
  if (typeof v !== 'number' || !Number.isFinite(v) || v < r.min || v > r.max) {
    return err(msg('validation.out_of_range', { field: path, min: r.min, max: r.max, unit }));
  }
  return ok(true);
}

function day(rec: Rec, field: string): Result<true> {
  const v = rec[field];
  if (v === undefined) return ok(true);
  return typeof v === 'string' && parseDayKey(v)
    ? ok(true)
    : err(msg('validation.invalid_date', { input: String(v) }));
}

function instant(rec: Rec, field: string): Result<true> {
  const v = rec[field];
  if (v === undefined) return ok(true);
  return typeof v === 'string' && parseIsoDateTime(v)
    ? ok(true)
    : err(msg('validation.invalid_date', { input: String(v) }));
}

const inconsistent = (...fields: string[]) => err<true>(msg('validation.inconsistent', { fields }));

/** Run checks in order and return the first failure. */
function all(...checks: (() => Result<true>)[]): Result<true> {
  for (const c of checks) {
    const r = c();
    if (!r.ok) return r;
  }
  return ok(true);
}

const RULES: Record<CollectionName, (r: Rec) => Result<true>> = {
  weights: (r) => all(() => num(r, 'kg', 'weightKg', 'kg')),
  bodyComposition: (r) =>
    all(
      () => num(r, 'fatPercent', 'fatPercent', '%'),
      () => num(r, 'fatMassKg', 'bodyMassKg', 'kg'),
      () => num(r, 'muscleMassKg', 'bodyMassKg', 'kg'),
      () => num(r, 'leanMassKg', 'bodyMassKg', 'kg'),
    ),
  meals: (r) =>
    all(
      () => num(r, 'kcal', 'kcalPerMeal', 'kcal'),
      () => num(r, 'proteinG', 'macroG', 'g'),
      () => num(r, 'carbsG', 'macroG', 'g'),
      () => num(r, 'fatG', 'macroG', 'g'),
      () =>
        isObj(r.portion)
          ? num(r.portion, 'quantity', 'portionQuantity', '', 'portion.quantity')
          : ok(true),
      () => (isObj(r.nutritionSource) ? instant(r.nutritionSource, 'checkedAt') : ok(true)),
    ),
  water: (r) => all(() => num(r, 'ml', 'waterMl', 'ml')),
  dayStatus: () => ok(true),
  workouts: (r) =>
    all(
      () => num(r, 'durationMin', 'minutes', 'min'),
      () => num(r, 'activeKcal', 'activeKcal', 'kcal'),
      () => day(r, 'rescheduledTo'),
      () =>
        r.status === 'rescheduled' && r.rescheduledTo === undefined
          ? inconsistent('status', 'rescheduledTo')
          : ok(true),
      () => {
        for (const [i, ex] of (Array.isArray(r.exercises) ? r.exercises : []).entries()) {
          if (!isObj(ex)) return inconsistent(`exercises[${i}]`);
          for (const [j, set] of (Array.isArray(ex.sets) ? ex.sets : []).entries()) {
            if (!isObj(set)) return inconsistent(`exercises[${i}].sets[${j}]`);
            const p = `exercises[${i}].sets[${j}]`;
            const res = all(
              () => num(set, 'reps', 'reps', '', `${p}.reps`),
              () => num(set, 'loadKg', 'loadKg', 'kg', `${p}.loadKg`),
              () => num(set, 'durationSec', 'durationSec', 's', `${p}.durationSec`),
            );
            if (!res.ok) return res;
          }
        }
        return ok(true);
      },
      () => {
        for (const [i, c] of (Array.isArray(r.cardio) ? r.cardio : []).entries()) {
          if (!isObj(c)) return inconsistent(`cardio[${i}]`);
          const p = `cardio[${i}]`;
          const res = all(
            () => num(c, 'minutes', 'minutes', 'min', `${p}.minutes`),
            () => num(c, 'distanceKm', 'distanceKm', 'km', `${p}.distanceKm`),
            () => num(c, 'inclinePercent', 'inclinePercent', '%', `${p}.inclinePercent`),
            () => num(c, 'avgHeartRate', 'heartRate', 'bpm', `${p}.avgHeartRate`),
          );
          if (!res.ok) return res;
        }
        return ok(true);
      },
    ),
  activity: (r) =>
    all(
      () => num(r, 'steps', 'steps', ''),
      () => num(r, 'activeKcal', 'activeKcal', 'kcal'),
      () => num(r, 'restingHeartRate', 'heartRate', 'bpm'),
    ),
  goals: (r) =>
    all(
      () => num(r, 'startKg', 'weightKg', 'kg'),
      () => num(r, 'targetKg', 'weightKg', 'kg'),
      () => num(r, 'maintainBandKg', 'maintainBandKg', 'kg'),
      () => day(r, 'startDay'),
      () => day(r, 'targetDate'),
      () =>
        typeof r.targetDate === 'string' &&
        typeof r.effectiveFrom === 'string' &&
        r.targetDate < r.effectiveFrom
          ? inconsistent('effectiveFrom', 'targetDate')
          : ok(true),
      () => {
        const { direction, startKg, targetKg } = r as {
          direction?: string;
          startKg?: number;
          targetKg?: number;
        };
        if (startKg === undefined || targetKg === undefined) return ok(true);
        if (direction === 'lose' && targetKg >= startKg)
          return inconsistent('direction', 'startKg', 'targetKg');
        if (direction === 'gain' && targetKg <= startKg)
          return inconsistent('direction', 'startKg', 'targetKg');
        return ok(true);
      },
      () =>
        r.direction === 'maintain' && r.targetKg !== undefined && r.maintainBandKg === undefined
          ? inconsistent('maintainBandKg')
          : ok(true),
    ),
  targets: (r) =>
    all(
      () => num(r, 'kcal', 'kcalPerDay', 'kcal'),
      () => num(r, 'kcalMin', 'kcalPerDay', 'kcal'),
      () => num(r, 'kcalMax', 'kcalPerDay', 'kcal'),
      () => num(r, 'proteinG', 'macroG', 'g'),
      () => num(r, 'carbsG', 'macroG', 'g'),
      () => num(r, 'fatG', 'macroG', 'g'),
      () => num(r, 'waterMl', 'waterTargetMl', 'ml'),
      () => {
        const { kcal, kcalMin, kcalMax } = r as {
          kcal?: number;
          kcalMin?: number;
          kcalMax?: number;
        };
        if (kcalMin !== undefined && kcalMax !== undefined && kcalMin > kcalMax)
          return inconsistent('kcalMin', 'kcalMax');
        if (kcal !== undefined && kcalMin !== undefined && kcal < kcalMin)
          return inconsistent('kcal', 'kcalMin');
        if (kcal !== undefined && kcalMax !== undefined && kcal > kcalMax)
          return inconsistent('kcal', 'kcalMax');
        return ok(true);
      },
    ),
  imports: (r) =>
    all(
      () => instant(r, 'startedAt'),
      () => instant(r, 'finishedAt'),
    ),
};

/**
 * Validate a full record (or a record merged with a patch) for `collection`.
 * Checks day keys, ISO instants, every numeric field (finite + plausible range) and
 * cross-field consistency. Unknown extra fields are ignored.
 */
export function validateRecord(collection: CollectionName, record: object): Result<true> {
  const r = record as Rec;
  return all(
    () => day(r, 'dayKey'),
    () => day(r, 'effectiveFrom'),
    () => instant(r, 'recordedAt'),
    () => RULES[collection](r),
  );
}

const HEX = /^#[0-9a-f]{6}$/i;

export function validateSettings(s: Partial<Settings>): Result<true> {
  if (s.customProgressColors !== undefined) {
    const c = s.customProgressColors;
    if (!Array.isArray(c) || c.length < 1 || c.length > 3)
      return inconsistent('customProgressColors');
    for (const color of c) {
      if (typeof color !== 'string' || !HEX.test(color)) {
        return err(msg('validation.invalid_color', { input: String(color) }));
      }
    }
  }
  return ok(true);
}

export function validateProfile(p: Partial<Profile>): Result<true> {
  const value = (a: unknown) => (isObj(a) && a.kind === 'value' ? (a.value as unknown) : undefined);
  const check = (field: string, v: unknown, range: RangeKey, unit: string) =>
    v === undefined ? ok<true>(true) : num({ [field]: v }, field, range, unit);
  return all(
    () => check('heightCm', value(p.heightCm), 'heightCm', 'cm'),
    () => check('birthYear', value(p.birthYear), 'birthYear', ''),
  );
}

const oneOf = (v: unknown, values: readonly string[]) =>
  typeof v === 'string' && values.includes(v);

/** A complete stored Settings document (backup restore): shape + values. */
export function validateFullSettings(value: unknown): Result<true> {
  const bad = () => err<true>(msg('validation.inconsistent', { fields: ['settings'] }));
  if (!isObj(value)) return bad();
  const s = value as Rec;
  const u = s.units;
  if (
    s.schemaVersion !== SCHEMA_VERSION ||
    !parseIsoDateTime(String(s.updatedAt)) ||
    !oneOf(s.locale, ['it', 'en']) ||
    !oneOf(s.theme, ['dark', 'light', 'system']) ||
    !oneOf(s.progressPalette, ['neutral', 'warm_to_green', 'custom']) ||
    !oneOf(s.appIcon, ['primary', 'bars']) ||
    !isObj(u) ||
    !oneOf(u.weight, ['kg', 'lb']) ||
    !oneOf(u.length, ['cm', 'in']) ||
    !oneOf(u.volume, ['ml', 'fl_oz']) ||
    !oneOf(u.distance, ['km', 'mi']) ||
    !oneOf(u.energy, ['kcal', 'kj'])
  ) {
    return bad();
  }
  for (const k of ['onboardingCompletedAt', 'lastBackupAt']) {
    if (s[k] !== undefined && !parseIsoDateTime(String(s[k]))) return bad();
  }
  return validateSettings(s as Partial<Settings>);
}

/** A complete stored Profile document (backup restore): shape + values. */
export function validateFullProfile(value: unknown): Result<true> {
  const bad = () => err<true>(msg('validation.inconsistent', { fields: ['profile'] }));
  if (!isObj(value)) return bad();
  const p = value as Rec;
  if (p.schemaVersion !== SCHEMA_VERSION || !parseIsoDateTime(String(p.updatedAt))) return bad();
  const answerOk = (a: unknown) =>
    a === undefined ||
    (isObj(a) &&
      oneOf(a.kind, ['value', 'unknown', 'not_measured', 'declined']) &&
      (a.kind !== 'value' || 'value' in a));
  for (const k of ['heightCm', 'birthYear', 'sex', 'activityLevel'])
    if (!answerOk(p[k])) return bad();
  return validateProfile(p as Partial<Profile>);
}

// ---------------------------------------------------------------------------
// Complete-record shape (untrusted input: backups, imports, untyped callers)

const SOURCE_KINDS = ['manual', 'apple_health', 'csv', 'backup', 'demo'] as const;
const QUALITY = ['measured', 'estimated', 'imported'] as const;
const MEAL_QUALITY = ['verified', 'estimated', 'imported'] as const;
const COMPLETENESS = ['unknown', 'unlogged', 'partial', 'complete'] as const;

const isStr = (v: unknown) => typeof v === 'string' && v.length > 0;
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

/** Required fields per collection (beyond the shared record meta). */
const REQUIRED: Record<CollectionName, (r: Rec) => string[]> = {
  weights: (r) => [
    ...(isNum(r.kg) ? [] : ['kg']),
    ...(oneOf(r.quality, QUALITY) ? [] : ['quality']),
  ],
  bodyComposition: (r) => (oneOf(r.quality, QUALITY) ? [] : ['quality']),
  meals: (r) => [
    ...(oneOf(r.slot, ['breakfast', 'lunch', 'dinner', 'snack']) ? [] : ['slot']),
    ...(oneOf(r.quality, MEAL_QUALITY) ? [] : ['quality']),
  ],
  water: (r) => (isNum(r.ml) ? [] : ['ml']),
  dayStatus: (r) => [
    ...(isStr(r.dayKey) ? [] : ['dayKey']),
    ...(oneOf(r.nutrition, COMPLETENESS) ? [] : ['nutrition']),
    ...(oneOf(r.water, COMPLETENESS) ? [] : ['water']),
  ],
  workouts: (r) => [
    ...(isStr(r.title) ? [] : ['title']),
    ...(oneOf(r.status, ['completed', 'skipped', 'rescheduled']) ? [] : ['status']),
    ...(Array.isArray(r.exercises) ? [] : ['exercises']),
    ...(Array.isArray(r.cardio) ? [] : ['cardio']),
  ],
  activity: (r) => (isStr(r.dayKey) ? [] : ['dayKey']),
  goals: (r) => [
    ...(isStr(r.effectiveFrom) ? [] : ['effectiveFrom']),
    ...(oneOf(r.direction, ['lose', 'gain', 'maintain', 'recomp']) ? [] : ['direction']),
    ...(oneOf(r.setBy, ['user', 'professional']) ? [] : ['setBy']),
  ],
  targets: (r) => [
    ...(isStr(r.effectiveFrom) ? [] : ['effectiveFrom']),
    ...(oneOf(r.setBy, ['user', 'professional']) ? [] : ['setBy']),
  ],
  imports: (r) => [
    ...(oneOf(r.format, ['apple_health_xml', 'apple_health_zip', 'csv', 'ritmea_backup'])
      ? []
      : ['format']),
    ...(isStr(r.startedAt) ? [] : ['startedAt']),
    ...(oneOf(r.status, ['running', 'completed', 'failed', 'cancelled']) ? [] : ['status']),
    ...(isObj(r.counts) &&
    ['read', 'added', 'duplicates', 'skippedInvalid'].every((k) => isNum((r.counts as Rec)[k]))
      ? []
      : ['counts']),
  ],
};

const DATED: readonly CollectionName[] = [
  'weights',
  'bodyComposition',
  'meals',
  'water',
  'workouts',
];

/**
 * Validate a COMPLETE stored record: shared meta (id, schemaVersion, ISO timestamps, source),
 * the collection's required fields and enums, then all value rules of `validateRecord`.
 * Used for every write path, so untyped input (backup files, imports) cannot store partial
 * records such as a weight without `kg`.
 */
export function validateCompleteRecord(collection: CollectionName, record: unknown): Result<true> {
  if (!isObj(record)) return inconsistent('record');
  const r = record;
  const missing: string[] = [];
  if (!isStr(r.id)) missing.push('id');
  if (typeof r.schemaVersion !== 'number' || !Number.isInteger(r.schemaVersion)) {
    missing.push('schemaVersion');
  }
  for (const k of ['createdAt', 'updatedAt'] as const) {
    if (typeof r[k] !== 'string' || !parseIsoDateTime(r[k] as string)) missing.push(k);
  }
  if (
    r.deletedAt !== undefined &&
    (typeof r.deletedAt !== 'string' || !parseIsoDateTime(r.deletedAt))
  ) {
    missing.push('deletedAt');
  }
  if (!isObj(r.source) || !oneOf(r.source.kind, SOURCE_KINDS)) missing.push('source.kind');
  for (const k of ['importId', 'dedupeKey'] as const) {
    if (r[k] !== undefined && !isStr(r[k])) missing.push(k);
  }
  if (DATED.includes(collection)) {
    if (!isStr(r.dayKey)) missing.push('dayKey');
    if (!isStr(r.timeZone)) missing.push('timeZone');
  }
  missing.push(...REQUIRED[collection](r));
  if (missing.length) return inconsistent(...missing);
  return validateRecord(collection, r);
}
