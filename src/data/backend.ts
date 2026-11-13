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
  /**
   * Apply a whole batch in ONE atomic unit (a single IndexedDB transaction): optionally wipe
   * everything, then write records into several collections and meta. If anything fails —
   * including the page or browser being killed midway — nothing of the batch is applied.
   */
  commit(batch: BackendBatch): Promise<void>;
  /** Read every collection and meta in ONE consistent snapshot (single readonly transaction). */
  readAll(): Promise<{
    collections: Record<CollectionName, AnyRecord[]>;
    meta: Partial<Record<MetaKey, unknown>>;
  }>;
}

export interface BackendBatch {
  clearAll?: boolean;
  put: Partial<Record<CollectionName, AnyRecord[]>>;
  meta?: Partial<Record<MetaKey, unknown>>;
}
