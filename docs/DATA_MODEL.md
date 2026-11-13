# Ritmea — data model and contracts (v1)

Source of truth: `src/core/types.ts`. This document explains the rules behind it.
Changes to `src/core/**` need review from both agents (Claude + ChatGPT).

## Principles

1. **Local-first, honest storage.** Data lives in the browser on one device. `Repository.storage.synced` is always `false` until an authenticated backend exists. The UI must say so.
2. **Canonical units.** Storage uses kg, cm, kcal, g, ml, km and minutes. Conversion happens only at input and display, through `core/units` (`toStorage` / `fromStorage`). Imperial is a display preference (`Settings.units`).
3. **Missing ≠ zero.**
   - Optional numeric fields are omitted when unknown.
   - Profile questions use `Answer<T>`: `value | unknown ("Non lo so") | not_measured | declined`, and `undefined` means "not asked yet".
   - Per-day logging completeness is an explicit user statement (`DayLogStatus`: `unknown | unlogged | partial | complete`). It is kept separate from provenance (`source.kind`).
4. **Provenance on every record.**
   - `source`: `manual | apple_health | csv | backup | demo`, plus an optional name and device;
   - `quality`: `measured | estimated | imported`; meals use `verified | estimated | imported`;
   - `importId` and `dedupeKey` for records that come from an import.
5. **Soft delete.** `remove` sets `deletedAt` and `purge` is the only hard delete (user-requested deletion). This lets imports and backups reconcile instead of resurrecting deleted data.
6. **Goals and targets are append-only histories (enforced by the Repository).**
   - Editing a goal adds a `GoalEntry` with a later `effectiveFrom`; progress on a day uses the goal in effect that day.
   - The baseline (`startKg`/`startDay`) is stored on the goal, so editing old weigh-ins does not silently move it.
   - `update` on an existing goal/target accepts only `note`; anything else returns `repo.append_only`. A mistaken entry can be withdrawn with `remove` (soft delete, still visible in history).
   - `entryInEffect(entries, day)` in `core/history.ts` picks the entry for a day, so adding a goal never rewrites past progress.
   - `setBy: 'professional'` targets are never changed by calc or suggestions.
7. **Typed messages, no UI strings outside `src/i18n`.** Modules return `Message = { code, args }` (`core/messages.ts`).
8. **Calculation results always use one shape**: `CalcResult<T>` = `ok | insufficient_data | not_applicable`. Nothing falls back to 0.

## Validation at the persistence boundary

`core/validation.ts` (`validateRecord`, `validateSettings`, `validateProfile`) is used by the Repository on every `add`, `update` (on the merged record) and `putMany`. Importers and forms reuse it, so no path can store invalid data.

- **Every numeric field** must be finite and inside the plausible range (`PLAUSIBLE` in `core/units.ts`): weights, body composition, meal kcal/macros and portion, water, sets (reps/load/duration), cardio (minutes/km/incline/heart rate), activity, goal and target values.
- **Dates:** `dayKey`, `effectiveFrom`, `startDay`, `targetDate` and `rescheduledTo` must be real calendar days. Instants must be ISO with an offset and a possible date and time; Feb 30, 24:00 and offset +15:00 are rejected.
- **Cross-field rules:**
  - `rescheduled` workouts need `rescheduledTo`;
  - `kcalMin ≤ kcal ≤ kcalMax`;
  - `lose` needs target < start, and `gain` needs target > start;
  - `maintain` with a target needs a band;
  - `targetDate ≥ effectiveFrom`.
- **Settings:** `customProgressColors` holds 1–3 `#RRGGBB` values. `units` is deep-merged, so `saveSettings({ units: { weight: 'lb' } })` is safe. `saveSettings` and `saveProfile` return `Result`.

## Nutrition provenance

`MealEntry` values are **totals as eaten**. Optional `portion` (`quantity` + `g/ml/piece/serving`) and `nutritionSource` (name, country, URL, basis `per_100g/per_100ml/per_serving/whole_meal`, `checkedAt`) record where they came from, together with `quality: verified | estimated | imported`. `FoodItem` is **typed now but not stored yet**: it is the planned food-catalog extension, so UI and imports don't guess field names.

## Dates and time zones

| Field                                   | Meaning                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `dayKey`                                | Local calendar day `YYYY-MM-DD` the observation belongs to.                                      |
| `timeZone`                              | IANA zone used to derive `dayKey`. Defaults to the device zone.                                  |
| `recordedAt`                            | Exact instant, ISO 8601 **with offset** (e.g. `+01:00`). Strings without an offset are rejected. |
| `createdAt` / `updatedAt` / `deletedAt` | Record bookkeeping, ISO with offset.                                                             |

- Day arithmetic (`addDays`, `daysBetween`, `dayRange`, ISO weeks starting on Monday) works on `dayKey` and is DST-safe.
- A weigh-in at 00:30 belongs to the new local day.
- When travelling, the record keeps the zone it was recorded in.

## Collections (v1)

| Collection        | Type                   | Notes                                                                                                                                           |
| ----------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `weights`         | `WeightEntry`          | `kg` and `quality`. Plausible range is 20–400 kg; out-of-range values are rejected, not clamped.                                                |
| `bodyComposition` | `BodyCompositionEntry` | Fat/muscle/lean values individually optional; `method` is `bia/dexa/...`.                                                                       |
| `meals`           | `MealEntry`            | `slot`, optional kcal/protein/carbs/fat, `quality` verified/estimated/imported.                                                                 |
| `water`           | `WaterEntry`           | `ml` per drink event.                                                                                                                           |
| `dayStatus`       | `DayLogStatus`         | User statement of nutrition/water completeness per day.                                                                                         |
| `workouts`        | `WorkoutSession`       | Planned day, status (`completed/skipped/rescheduled`), exercises → sets (reps, load, duration, warm-up), cardio (treadmill minutes/km/incline). |
| `activity`        | `ActivityDay`          | Steps, active kcal and resting heart rate per day, mostly imported. `aggregation` records how multiple sources were reconciled.                 |
| `goals`           | `GoalEntry`            | `lose/gain/maintain/recomp`, start, target, maintain band, optional date, `setBy`.                                                              |
| `targets`         | `TargetsEntry`         | kcal (with optional min/max range), macros, water, `setBy`.                                                                                     |
| `imports`         | `ImportBatch`          | Format, file name only (never contents), counts (read/added/duplicates/invalid), date range.                                                    |

`Profile` (height, birth year, sex, activity level as `MaybeAnswer`) and `Settings` (locale, display units, time zone, theme, progress palette, app icon, last backup) are single documents.

## De-duplication (for `src/import`, next PRs)

`dedupeKey` is a deterministic string per source sample:

```
<source.kind>|<collection>|<source sample id if any, else: startInstantUTC|value rounded|unit|sourceName>
```

Before inserting, the importer calls `findByDedupeKeys`; matches (including soft-deleted ones) are counted as duplicates, never re-added. Multi-source daily totals such as steps from iPhone _and_ Watch are aggregated per source and reconciled (e.g. max per source), not summed blindly.

## Repository contract

`src/core/repository.ts` defines the interface; `src/data/repositoryContract.ts` is a shared test suite that every implementation must pass. Today that is the memory repository; the IndexedDB repository comes next. Guarantees:

- returned objects are copies;
- sorted lists;
- inclusive day-range filters;
- invalid day keys and implausible weights are rejected;
- values are stored exactly;
- soft delete, purge and dedupe lookup;
- neutral default settings with no personal values;
- change events.

## Storage, migrations and backup (`claude/data-layer`)

- **IndexedDB** (`src/data/indexedDb`). The real database is named `ritmea`; demo mode and tests use other names, so they never mix. There is one object store per collection (keyPath `id`, with a `dedupeKey` index), a `meta` store (settings, profile) and `preMigrationSnapshots`.
- **Upgrades.** `DB_VERSION` plus ordered `MIGRATIONS[v]` steps run inside the single `versionchange` transaction:
  - before any step, every existing store is copied into `preMigrationSnapshots`;
  - if a step throws, the whole upgrade aborts and the old data and version stay untouched;
  - a missing step refuses to open;
  - another tab holding the old version is asked to close (`onversionchange`).
- **Backups** (`src/data/backup.ts`) are JSON files `ritmea-backup-YYYY-MM-DD.json` containing all records (soft-deleted included), settings and profile, plus `formatVersion`/`schemaVersion` and a `containsDemoData` flag. `parseBackup`:
  - rejects files from newer app versions;
  - rejects the **whole** file if any record is invalid;
  - upgrades old record versions through `RECORD_MIGRATIONS`.
- **Restore modes:**
  - `replace`: the device becomes exactly the backup; on failure the previous state is written back;
  - `merge`: match by id and keep the newer `updatedAt`; device settings are kept.
- **Durability helpers** (`src/data/persistence.ts`): `requestPersistentStorage()`, `isStoragePersisted()`, `storageEstimate()`, `daysSinceBackup()`. On iOS, non-installed sites can be evicted. The UI should recommend installing to the Home Screen and taking regular backups.
- `.gitignore` ignores `ritmea-backup-*.json`, so a backup can't be committed to this public repo by accident.

## Synthetic data

`src/data/fixtures/demo.ts` is a seeded, deterministic, clearly fictional dataset with `source.kind = 'demo'`: 45 days, gaps, unlogged days, unknown macros and skipped workouts. Real data never enters the repository or its tests.
