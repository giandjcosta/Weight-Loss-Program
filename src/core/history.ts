import type { DayKey, GoalEntry, TargetsEntry } from './types';

/**
 * The goal/targets entry in effect on `day`: the latest non-deleted entry whose
 * `effectiveFrom` is on or before `day` (ties: the most recently created wins).
 * Because entries are append-only, adding a new goal never changes the answer for past days.
 */
export function entryInEffect<T extends GoalEntry | TargetsEntry>(
  entries: readonly T[],
  day: DayKey,
): T | undefined {
  let best: T | undefined;
  for (const e of entries) {
    if (e.deletedAt || e.effectiveFrom > day) continue;
    if (
      !best ||
      e.effectiveFrom > best.effectiveFrom ||
      (e.effectiveFrom === best.effectiveFrom && e.createdAt > best.createdAt)
    ) {
      best = e;
    }
  }
  return best;
}
