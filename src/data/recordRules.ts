import {
  validateCompleteRecord,
  validateRecord,
  type CollectionMap,
  type CollectionName,
  type ListQuery,
  type Result,
} from '../core';

export type AnyRecord = CollectionMap[CollectionName];

export const clone = <T>(v: T): T => structuredClone(v);

/** Day used for range filtering and ordering (dayKey, effectiveFrom, or import start day). */
export function sortDay(r: AnyRecord): string {
  if ('dayKey' in r) return r.dayKey;
  if ('effectiveFrom' in r) return r.effectiveFrom;
  if ('startedAt' in r) return r.startedAt.slice(0, 10);
  return '';
}

/** Order: day, then recordedAt, then createdAt, then id (total and deterministic). */
export function compareRecords(a: AnyRecord, b: AnyRecord): number {
  const ka = [sortDay(a), ('recordedAt' in a && a.recordedAt) || '', a.createdAt, a.id];
  const kb = [sortDay(b), ('recordedAt' in b && b.recordedAt) || '', b.createdAt, b.id];
  for (let i = 0; i < ka.length; i++) {
    const x = String(ka[i]);
    const y = String(kb[i]);
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export function matchesQuery(r: AnyRecord, query: ListQuery): boolean {
  if (!query.includeDeleted && r.deletedAt) return false;
  const d = sortDay(r);
  if (query.from && d < query.from) return false;
  if (query.to && d > query.to) return false;
  return true;
}

/** Persistence-boundary validation (delegates to the shared `core/validation`). */
export function validateFields(collection: CollectionName, r: object): Result<true> {
  return validateRecord(collection, r);
}

/**
 * Full-record check for every write path (add, update, batches, restore): meta, required
 * fields and enums per collection, then value rules. See `core/validation › validateCompleteRecord`.
 */
export function validateStoredRecord(collection: CollectionName, r: unknown): Result<true> {
  return validateCompleteRecord(collection, r);
}
