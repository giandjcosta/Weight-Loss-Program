import {
  SCHEMA_VERSION,
  defaultProfile,
  defaultSettings,
  err,
  msg,
  newId,
  nowIso,
  ok,
  type ChangeEvent,
  type CollectionMap,
  type CollectionName,
  type IsoDateTime,
  type ListQuery,
  type NewRecord,
  type Profile,
  type RecordMeta,
  type Repository,
  type Settings,
  validateProfile,
  validateSettings,
} from '../core';
import type { StorageBackend } from './backend';
import {
  clone,
  compareRecords,
  matchesQuery,
  validateFields,
  validateStoredRecord,
  type AnyRecord,
} from './recordRules';

export interface RepositoryOptions {
  /** Injectable clock for deterministic tests. */
  now?: () => IsoDateTime;
}

const MANAGED = new Set(['id', 'schemaVersion', 'createdAt', 'updatedAt', 'deletedAt']);
/** Collections that are histories: existing entries accept only these fields. */
const APPEND_ONLY: Partial<Record<CollectionName, ReadonlySet<string>>> = {
  goals: new Set(['note']),
  targets: new Set(['note']),
};

/** Builds the Repository on top of any StorageBackend. */
export function createRepository(
  backend: StorageBackend,
  options: RepositoryOptions = {},
): Repository {
  const now = options.now ?? (() => nowIso());
  const listeners = new Set<(e: ChangeEvent) => void>();
  const emit = (e: ChangeEvent) => {
    for (const l of listeners) {
      try {
        l(e);
      } catch (error) {
        console.error('Ritmea: change listener failed', error);
      }
    }
  };

  async function loadSettings(): Promise<Settings> {
    const stored = await backend.getMeta<Settings>('settings');
    const base = defaultSettings(now());
    return stored ? { ...base, ...stored, units: { ...base.units, ...stored.units } } : base;
  }
  async function loadProfile(): Promise<Profile> {
    const stored = await backend.getMeta<Profile>('profile');
    return stored ? { ...defaultProfile(now()), ...stored } : defaultProfile(now());
  }

  const repo: Repository = {
    get storage() {
      return { kind: backend.kind, synced: false as const, persistent: backend.persistent() };
    },

    async list<C extends CollectionName>(collection: C, query: ListQuery = {}) {
      const all = await backend.getAll(collection);
      return clone(
        all.filter((r) => matchesQuery(r, query)).sort(compareRecords),
      ) as CollectionMap[C][];
    },

    async get<C extends CollectionName>(collection: C, id: CollectionMap[C]['id']) {
      const r = await backend.get(collection, id);
      return r ? (clone(r) as CollectionMap[C]) : undefined;
    },

    async add<C extends CollectionName>(collection: C, input: NewRecord<C>) {
      const v = validateFields(collection, input);
      if (!v.ok) return v;
      const t = now();
      const meta: Pick<RecordMeta, 'id' | 'schemaVersion' | 'createdAt' | 'updatedAt'> = {
        id: newId(),
        schemaVersion: SCHEMA_VERSION,
        createdAt: t,
        updatedAt: t,
      };
      const record = { ...clone(input), ...meta } as unknown as CollectionMap[C];
      await backend.put(collection, [record]);
      emit({ type: 'put', collection, id: record.id });
      return ok(clone(record));
    },

    async update(collection, id, patch) {
      const current = await backend.get(collection, id);
      if (!current || current.deletedAt) return err(msg('repo.not_found', { collection, id }));
      const safe = Object.fromEntries(
        Object.entries(patch as Record<string, unknown>).filter(([k]) => !MANAGED.has(k)),
      );
      const allowed = APPEND_ONLY[collection];
      if (allowed) {
        const blocked = Object.keys(safe).filter((k) => !allowed.has(k));
        if (blocked.length) return err(msg('repo.append_only', { collection, fields: blocked }));
      }
      const next = { ...current, ...clone(safe), updatedAt: now() } as AnyRecord;
      // validate the merged record, so cross-field rules (e.g. kcalMin ≤ kcalMax) hold
      const v = validateFields(collection, next);
      if (!v.ok) return v;
      await backend.put(collection, [next]);
      emit({ type: 'put', collection, id });
      return ok(clone(next)) as never;
    },

    async remove(collection, id) {
      const current = await backend.get(collection, id);
      if (!current || current.deletedAt) return err(msg('repo.not_found', { collection, id }));
      const t = now();
      await backend.put(collection, [{ ...current, deletedAt: t, updatedAt: t } as AnyRecord]);
      emit({ type: 'delete', collection, id });
      return ok(undefined);
    },

    async purge(collection, ids) {
      const deleted = await backend.delete(collection, ids);
      for (const id of deleted) emit({ type: 'delete', collection, id });
    },

    async putMany(collection, records) {
      for (const r of records) {
        const v = validateStoredRecord(collection, r);
        if (!v.ok) return v;
      }
      if (records.length === 0) return ok(0);
      await backend.put(collection, clone(records) as AnyRecord[]);
      emit({ type: 'bulk', collection, count: records.length });
      return ok(records.length);
    },

    async findByDedupeKeys<C extends CollectionName>(collection: C, keys: string[]) {
      if (keys.length === 0) return [];
      return clone(await backend.getByDedupeKeys(collection, keys)) as CollectionMap[C][];
    },

    async getSettings() {
      return loadSettings();
    },
    async saveSettings(patch) {
      const v = validateSettings(patch as Partial<Settings>);
      if (!v.ok) return v;
      const current = await loadSettings();
      const next: Settings = {
        ...current,
        ...clone(patch),
        units: { ...current.units, ...(patch.units ?? {}) },
        schemaVersion: SCHEMA_VERSION,
        updatedAt: now(),
      };
      await backend.putMeta('settings', next);
      emit({ type: 'settings' });
      return ok(clone(next));
    },
    async getProfile() {
      return loadProfile();
    },
    async saveProfile(patch) {
      const v = validateProfile(patch);
      if (!v.ok) return v;
      const next: Profile = {
        ...(await loadProfile()),
        ...clone(patch),
        schemaVersion: SCHEMA_VERSION,
        updatedAt: now(),
      };
      await backend.putMeta('profile', next);
      emit({ type: 'profile' });
      return ok(clone(next));
    },

    async reset() {
      await backend.clear();
      emit({ type: 'reset' });
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return repo;
}
