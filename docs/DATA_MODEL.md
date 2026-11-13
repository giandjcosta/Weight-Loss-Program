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
6. **Goals and targets are append-only histories.**
   - Editing a goal adds a `GoalEntry` with a later `effectiveFrom`; progress on a day uses the goal in effect that day.
   - The baseline (`startKg`/`startDay`) is stored on the goal, so editing old weigh-ins does not silently move it.
   - `setBy: 'professional'` targets are never changed by calc or suggestions.
7. **Typed messages, no UI strings outside `src/i18n`.** Modules return `Message = { code, args }` (`core/messages.ts`).
8. **Calculation results always use one shape**: `CalcResult<T>` = `ok | insufficient_data | not_applicable`. Nothing falls back to 0.

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

## Migrations (next PR: `claude/data-layer`)

- Every record carries `schemaVersion`. IndexedDB upgrades run ordered, idempotent migration steps (`v1 → v2 → …`) inside the version-change transaction, so a failed upgrade aborts without partial writes.
- An automatic local backup snapshot is taken before any migration.
- Tests: migrate fixtures from every previous version, and make sure a backup → wipe → restore round-trip is identical.

## Synthetic data

`src/data/fixtures/demo.ts` is a seeded, deterministic, clearly fictional dataset with `source.kind = 'demo'`: 45 days, gaps, unlogged days, unknown macros and skipped workouts. Real data never enters the repository or its tests.
