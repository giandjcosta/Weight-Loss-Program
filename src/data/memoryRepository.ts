import {
  COLLECTIONS,
  type CollectionMap,
  type CollectionName,
  type Id,
  type IsoDateTime,
  type Profile,
  type Repository,
  type Settings,
} from '../core';
import type { MetaKey, StorageBackend } from './backend';
import { createRepository } from './createRepository';
import { clone, type AnyRecord } from './recordRules';

export interface MemoryRepositoryOptions {
  /** Injectable clock for deterministic tests. */
  now?: () => IsoDateTime;
  /** Initial records, e.g. the synthetic demo dataset. */
  seed?: Partial<{ [C in CollectionName]: CollectionMap[C][] }>;
  settings?: Partial<Omit<Settings, 'schemaVersion' | 'updatedAt'>>;
  profile?: Partial<Omit<Profile, 'schemaVersion' | 'updatedAt'>>;
}

export function createMemoryBackend(
  seed: MemoryRepositoryOptions['seed'] = {},
  meta: Partial<Record<MetaKey, unknown>> = {},
): StorageBackend {
  const empty = () => new Map(COLLECTIONS.map((c) => [c, new Map<Id, AnyRecord>()]));
  let tables = empty();
  let metaStore = new Map<MetaKey, unknown>(Object.entries(clone(meta)) as [MetaKey, unknown][]);
  const table = (c: CollectionName) => tables.get(c)!;
  for (const c of COLLECTIONS) for (const r of seed[c] ?? []) table(c).set(r.id, clone(r));

  return {
    kind: 'memory',
    persistent: () => false,
    async getAll(c) {
      return [...table(c).values()];
    },
    async get(c, id) {
      return table(c).get(id);
    },
    async put(c, records) {
      for (const r of records) table(c).set(r.id, clone(r));
    },
    async delete(c, ids) {
      return ids.filter((id) => table(c).delete(id));
    },
    async getByDedupeKeys(c, keys) {
      const wanted = new Set(keys);
      return [...table(c).values()].filter((r) => r.dedupeKey && wanted.has(r.dedupeKey));
    },
    async getMeta<T>(key: MetaKey) {
      return clone(metaStore.get(key)) as T | undefined;
    },
    async putMeta(key, value) {
      metaStore.set(key, clone(value));
    },
    async clear() {
      tables = empty();
      metaStore = new Map();
    },
  };
}

/**
 * In-memory Repository. Used by unit tests, by the UI while developing, and for demo mode
 * (kept separate from real data). Nothing is persisted.
 */
export function createMemoryRepository(options: MemoryRepositoryOptions = {}): Repository {
  const meta: Partial<Record<MetaKey, unknown>> = {};
  if (options.settings) meta.settings = options.settings;
  if (options.profile) meta.profile = options.profile;
  return createRepository(
    createMemoryBackend(options.seed, meta),
    options.now ? { now: options.now } : {},
  );
}
