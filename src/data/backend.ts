import type { CollectionName, Id } from '../core';
import type { AnyRecord } from './recordRules';

export type MetaKey = 'settings' | 'profile';

/**
 * Low-level storage used by `createRepository`. Implementations only move bytes; all rules
 * (validation, ordering, timestamps, events) live in `createRepository`, so memory and IndexedDB
 * behave identically.
 */
export interface StorageBackend {
  readonly kind: 'memory' | 'indexeddb';
  /** Whether the browser granted persistent storage (not evicted under pressure). */
  persistent(): boolean;
  getAll(collection: CollectionName): Promise<AnyRecord[]>;
  get(collection: CollectionName, id: Id): Promise<AnyRecord | undefined>;
  /** Atomic: either every record is written or none. */
  put(collection: CollectionName, records: AnyRecord[]): Promise<void>;
  /** Returns the ids that existed and were deleted. Atomic. */
  delete(collection: CollectionName, ids: Id[]): Promise<Id[]>;
  getByDedupeKeys(collection: CollectionName, keys: string[]): Promise<AnyRecord[]>;
  getMeta<T>(key: MetaKey): Promise<T | undefined>;
  putMeta<T>(key: MetaKey, value: T): Promise<void>;
  /** Remove all records and meta. Atomic. */
  clear(): Promise<void>;
}
