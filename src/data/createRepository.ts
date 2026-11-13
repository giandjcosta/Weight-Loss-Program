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
  type Result,
  type RepositoryBatch,
  validateFullProfile,
  validateFullSettings,
  type Settings,
  validateProfile,
  validateSettings,
} from '../core';
import type { MetaKey, StorageBackend } from './backend';
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

/**
 * Run a storage write and turn exceptions (quota, IndexedDB unavailable, aborted transaction)
 * into a `Result`, so the UI can never show "saved" after a failed write.
 */
async function guarded(write: () => Promise<void>): Promise<Result<true>> {
  try {
    await write();
    return ok(true);
  } catch (error) {
    console.error('Ritmea: storage write failed', error);
    const name = (error as { name?: string } | null)?.name;
    return err(
      name === 'QuotaExceededError'
        ? msg('repo.quota_exceeded', {})
        : msg('repo.storage_unavailable', {}),
    );
  }
}

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
      const full = validateStoredRecord(collection, record);
      if (!full.ok) return full;
      const w = await guarded(() => backend.put(collection, [record]));
      if (!w.ok) return w;
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
      // validate the complete merged record: required fields, enums and cross-field rules
      const v = validateStoredRecord(collection, next);
      if (!v.ok) return v;
      const w = await guarded(() => backend.put(collection, [next]));
      if (!w.ok) return w;
      emit({ type: 'put', collection, id });
      return ok(clone(next)) as never;
    },

    async remove(collection, id) {
      const current = await backend.get(collection, id);
      if (!current || current.deletedAt) return err(msg('repo.not_found', { collection, id }));
      const t = now();
      const w = await guarded(() =>
        backend.put(collection, [{ ...current, deletedAt: t, updatedAt: t } as AnyRecord]),
      );
      if (!w.ok) return w;
      emit({ type: 'delete', collection, id });
      return ok(undefined);
    },

    async purge(collection, ids) {
      const deleted = await backend.delete(collection, ids);
      for (const id of deleted) emit({ type: 'delete', collection, id });
    },

    async exportAll() {
      const snap = await backend.readAll();
      const records = {} as Record<CollectionName, AnyRecord[]>;
      for (const [c, rs] of Object.entries(snap.collections) as [CollectionName, AnyRecord[]][]) {
        records[c] = [...rs].sort(compareRecords);
      }
      const base = defaultSettings(now());
      const st = snap.meta.settings as Settings | undefined;
      const pr = snap.meta.profile as Profile | undefined;
      return clone({
        records: records as { [C in CollectionName]: CollectionMap[C][] },
        settings: st ? { ...base, ...st, units: { ...base.units, ...st.units } } : base,
        profile: pr ? { ...defaultProfile(now()), ...pr } : defaultProfile(now()),
      });
    },

    async putMany(collection, records) {
      return repo.commitBatch({ records: { [collection]: records } });
    },

    async commitBatch(batch: RepositoryBatch) {
      let count = 0;
      for (const [c, records] of Object.entries(batch.records) as [CollectionName, AnyRecord[]][]) {
        for (const r of records ?? []) {
          const v = validateStoredRecord(c, r);
          if (!v.ok) return v;
          count++;
        }
      }
      if (batch.settings) {
        const v = validateFullSettings(batch.settings);
        if (!v.ok) return v;
      }
      if (batch.profile) {
        const v = validateFullProfile(batch.profile);
        if (!v.ok) return v;
      }
      const meta: Partial<Record<MetaKey, unknown>> = {};
      if (batch.settings) meta.settings = clone(batch.settings);
      if (batch.profile) meta.profile = clone(batch.profile);
      if (count === 0 && !batch.replaceAll && !batch.settings && !batch.profile) return ok(0);
      const w = await guarded(() =>
        backend.commit({
          ...(batch.replaceAll ? { clearAll: true } : {}),
          put: clone(batch.records) as Partial<Record<CollectionName, AnyRecord[]>>,
          meta,
        }),
      );
      if (!w.ok) return w;
      if (batch.replaceAll) emit({ type: 'reset' });
      else {
        for (const [c, records] of Object.entries(batch.records) as [
          CollectionName,
          AnyRecord[],
        ][]) {
          if (records?.length) emit({ type: 'bulk', collection: c, count: records.length });
        }
        if (batch.settings) emit({ type: 'settings' });
        if (batch.profile) emit({ type: 'profile' });
      }
      return ok(count);
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
      const w = await guarded(() => backend.putMeta('settings', next));
      if (!w.ok) return w;
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
      const w = await guarded(() => backend.putMeta('profile', next));
      if (!w.ok) return w;
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
