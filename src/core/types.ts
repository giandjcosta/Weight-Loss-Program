/**
 * Ritmea shared data contracts (src/core — changes need review from both agents).
 *
 * Storage rules:
 * - Canonical units only: kg, cm, kcal, g, ml, km, minutes. Convert at the edges via `core/units`.
 * - A missing value is `undefined` or an explicit `Answer` state, never 0.
 * - Records are soft-deleted (`deletedAt`) so imports, backups and sync can reconcile them.
 */

export const SCHEMA_VERSION = 1 as const;

/** Opaque string types: a plain string must go through a parser/constructor to become one. */
declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

/** Random UUID (see `core/ids`). */
export type Id = Brand<string, 'Id'>;
/** Local calendar day `YYYY-MM-DD` in the user's time zone (see `core/dates`). */
export type DayKey = Brand<string, 'DayKey'>;
/** ISO 8601 instant with explicit offset, e.g. `2026-11-13T08:30:00.000+01:00` or `...Z`. */
export type IsoDateTime = Brand<string, 'IsoDateTime'>;
/** IANA time zone name, e.g. `Europe/Rome`. */
export type TimeZone = Brand<string, 'TimeZone'>;

// ---------------------------------------------------------------------------
// Provenance and quality

export type SourceKind = 'manual' | 'apple_health' | 'csv' | 'backup' | 'demo';

export interface Source {
  kind: SourceKind;
  /** Human-readable origin, e.g. "Lifesum via Apple Health", "Bilancia palestra". */
  name?: string;
  /** Identifier of the device/app that produced the sample, when the import provides one. */
  device?: string;
}

/**
 * - `measured`: a reading from an instrument (scale, BIA).
 * - `estimated`: the user's approximation ("circa 75 kg") or a computed estimate.
 * - `imported`: copied from another app without further verification.
 */
export type Quality = 'measured' | 'estimated' | 'imported';

/** Whether the user considers a day/meal fully logged. Never inferred from the absence of data. */
export type Completeness = 'unknown' | 'unlogged' | 'partial' | 'complete';

/** Fields shared by every stored record. */
export interface RecordMeta {
  id: Id;
  schemaVersion: typeof SCHEMA_VERSION;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  /** Soft delete. Deleted records are hidden by default but kept for reconciliation. */
  deletedAt?: IsoDateTime;
  source: Source;
  /** Present when the record came from an import; links to `ImportBatch.id`. */
  importId?: Id;
  /** Stable key for duplicate detection across imports (see `docs/DATA_MODEL.md`). */
  dedupeKey?: string;
}

/** Fields of a dated observation. */
export interface Dated {
  /** Local day the observation belongs to, in the time zone it was recorded in. */
  dayKey: DayKey;
  /** Exact instant, when known. Manual day-only entries may omit it. */
  recordedAt?: IsoDateTime;
  /** Time zone used to derive `dayKey`. */
  timeZone: TimeZone;
}

// ---------------------------------------------------------------------------
// Answers that may be unknown (onboarding/profile)

export type Answer<T> =
  | { kind: 'value'; value: T }
  | { kind: 'unknown' } // "Non lo so"
  | { kind: 'not_measured' } // "Non misurato"
  | { kind: 'declined' }; // "Preferisco non dirlo"

/** Unanswered question: different from every `Answer` state. */
export type MaybeAnswer<T> = Answer<T> | undefined;

// ---------------------------------------------------------------------------
// Observations

export interface WeightEntry extends RecordMeta, Dated {
  kg: number;
  quality: Quality;
  note?: string;
}

export interface BodyCompositionEntry extends RecordMeta, Dated {
  quality: Quality;
  /** Each field optional: a BIA export may contain only some of them. */
  fatMassKg?: number;
  fatPercent?: number;
  muscleMassKg?: number;
  leanMassKg?: number;
  method?: 'bia' | 'dexa' | 'skinfold' | 'other';
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealEntry extends RecordMeta, Dated {
  slot: MealSlot;
  name?: string;
  /** Nutrition values are optional individually: a known kcal with unknown macros is valid. */
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  /** `verified` = label/official source; `estimated` = user or generic estimate. */
  quality: 'verified' | 'estimated' | 'imported';
  note?: string;
}

export interface WaterEntry extends RecordMeta, Dated {
  ml: number;
}

/** Per-day user statement about logging completeness (nutrition and water). */
export interface DayLogStatus extends RecordMeta {
  dayKey: DayKey;
  nutrition: Completeness;
  water: Completeness;
}

export interface SetLog {
  reps?: number;
  loadKg?: number;
  /** Bodyweight or timed sets, e.g. plank. */
  durationSec?: number;
  /** Warm-up sets are excluded from strength progression. */
  warmup?: boolean;
}

export interface ExerciseLog {
  /** Stable exercise identifier from the user's plan, e.g. "bench-press". */
  exerciseKey: string;
  name: string;
  sets: SetLog[];
  note?: string;
}

export interface CardioLog {
  kind: 'treadmill' | 'bike' | 'other';
  minutes?: number;
  distanceKm?: number;
  inclinePercent?: number;
  avgHeartRate?: number;
}

export type WorkoutStatus = 'completed' | 'skipped' | 'rescheduled';

export interface WorkoutSession extends RecordMeta, Dated {
  /** Plan day it fulfils, e.g. "upper"; absent for unplanned sessions. */
  planDayKey?: string;
  title: string;
  status: WorkoutStatus;
  /** When `status` is `rescheduled`. */
  rescheduledTo?: DayKey;
  durationMin?: number;
  activeKcal?: number;
  exercises: ExerciseLog[];
  cardio: CardioLog[];
  note?: string;
}

/** Daily activity aggregates, typically imported (steps are never logged manually per sample). */
export interface ActivityDay extends RecordMeta {
  dayKey: DayKey;
  steps?: number;
  activeKcal?: number;
  restingHeartRate?: number;
  /** How a multi-source total was reconciled, e.g. "max-per-source". */
  aggregation?: string;
}

// ---------------------------------------------------------------------------
// Goals, targets, profile, settings

export type GoalDirection = 'lose' | 'gain' | 'maintain' | 'recomp';

/**
 * Append-only goal history: editing a goal adds a new entry with a later `effectiveFrom`.
 * Progress on a given day uses the entry in effect on that day.
 */
export interface GoalEntry extends RecordMeta {
  effectiveFrom: DayKey;
  direction: GoalDirection;
  /** Baseline used for progress. Kept even if older weigh-ins are edited. */
  startKg?: number;
  startDay?: DayKey;
  targetKg?: number;
  /** For `maintain`: acceptable ± band around `targetKg`. */
  maintainBandKg?: number;
  /** Optional user/planner date, never generated silently. */
  targetDate?: DayKey;
  setBy: 'user' | 'professional';
  note?: string;
}

/** Nutrition/hydration references. Values are references, not prescriptions. */
export interface TargetsEntry extends RecordMeta {
  effectiveFrom: DayKey;
  kcal?: number;
  /** Optional range (e.g. professional's 2,000–2,100). */
  kcalMin?: number;
  kcalMax?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  waterMl?: number;
  /** Targets set by a professional are never changed by suggestions or calc. */
  setBy: 'user' | 'professional';
}

export type Sex = 'female' | 'male' | 'other';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export interface Profile {
  schemaVersion: typeof SCHEMA_VERSION;
  updatedAt: IsoDateTime;
  displayName?: string;
  heightCm: MaybeAnswer<number>;
  birthYear: MaybeAnswer<number>;
  /** Used only for formulas that require it; `declined` disables those estimates. */
  sex: MaybeAnswer<Sex>;
  activityLevel: MaybeAnswer<ActivityLevel>;
}

export type UnitSystem = 'metric' | 'imperial';
export type Locale = 'it' | 'en';

export interface Settings {
  schemaVersion: typeof SCHEMA_VERSION;
  updatedAt: IsoDateTime;
  locale: Locale;
  /** Display/input preference only; storage is always metric. */
  units: {
    weight: 'kg' | 'lb';
    length: 'cm' | 'in';
    volume: 'ml' | 'fl_oz';
    distance: 'km' | 'mi';
    energy: 'kcal' | 'kj';
  };
  /** Display time zone; undefined = device time zone. */
  timeZone?: TimeZone;
  theme: 'dark' | 'light' | 'system';
  progressPalette: 'neutral' | 'warm_to_green' | 'custom';
  appIcon: 'primary' | 'bars';
  onboardingCompletedAt?: IsoDateTime;
  lastBackupAt?: IsoDateTime;
}

// ---------------------------------------------------------------------------
// Imports

export type ImportFormat = 'apple_health_xml' | 'apple_health_zip' | 'csv' | 'ritmea_backup';

export interface ImportBatch extends RecordMeta {
  format: ImportFormat;
  /** File name only; file contents are never stored. */
  fileName?: string;
  startedAt: IsoDateTime;
  finishedAt?: IsoDateTime;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  counts: {
    read: number;
    added: number;
    duplicates: number;
    skippedInvalid: number;
    /** Per entity type, e.g. { weights: 12, meals: 30 }. */
    byCollection: Partial<Record<CollectionName, number>>;
  };
  /** Earliest and latest day found in the file. */
  range?: { from: DayKey; to: DayKey };
}

// ---------------------------------------------------------------------------
// Collection registry

export interface CollectionMap {
  weights: WeightEntry;
  bodyComposition: BodyCompositionEntry;
  meals: MealEntry;
  water: WaterEntry;
  dayStatus: DayLogStatus;
  workouts: WorkoutSession;
  activity: ActivityDay;
  goals: GoalEntry;
  targets: TargetsEntry;
  imports: ImportBatch;
}

export type CollectionName = keyof CollectionMap;

export const COLLECTIONS = [
  'weights',
  'bodyComposition',
  'meals',
  'water',
  'dayStatus',
  'workouts',
  'activity',
  'goals',
  'targets',
  'imports',
] as const satisfies readonly CollectionName[];

/** Fields the repository fills in; callers provide the rest. */
export type ManagedField = 'id' | 'schemaVersion' | 'createdAt' | 'updatedAt' | 'deletedAt';
export type NewRecord<C extends CollectionName> = Omit<CollectionMap[C], ManagedField>;
export type RecordPatch<C extends CollectionName> = Partial<NewRecord<C>>;
