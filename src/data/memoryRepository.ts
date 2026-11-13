import {
  COLLECTIONS,
  SCHEMA_VERSION,
  checkRange,
  defaultProfile,
  defaultSettings,
  err,
  msg,
  newId,
  nowIso,
  ok,
  parseDayKey,
  type ChangeEvent,
  type CollectionMap,
  type CollectionName,
  type Id,
  type IsoDateTime,
  type ListQuery,
  type NewRecord,
  type Profile,
  type RecordMeta,
  type RecordPatch,
  type Repository,
  type Result,
  type Settings,
} from '../core';

type AnyRecord = CollectionMap[CollectionName];
type Store = { [C in CollectionName]: Map<Id, CollectionMap[C]> };

export interface MemoryRepositoryOptions {
  /** Injectable clock for deterministic tests. */
  now?: () => IsoDateTime;
  /** Initial records, e.g. the synthetic demo dataset. */
  seed?: Partial<{ [C in CollectionName]: CollectionMap[C][] }>;
  settings?: Partial<Omit<Settings, 'schemaVersion' | 'updatedAt'>>;
  profile?: Partial<Omit<Profile, 'schemaVersion' | 'updatedAt'>>;
}

const clone = <T>(v: T): T => structuredClone(v);

/** Day used for range filtering and ordering. */
function sortDay(r: AnyRecord): string {
  if ('dayKey' in r) return r.dayKey;
  if ('effectiveFrom' in r) return r.effectiveFrom;
  if ('startedAt' in r) return r.startedAt.slice(0, 10);
  return '';
}

function compare(a: AnyRecord, b: AnyRecord): number {
  const ka = [sortDay(a), ('recordedAt' in a && a.recordedAt) || '', a.createdAt, a.id];
  const kb = [sortDay(b), ('recordedAt' in b && b.recordedAt) || '', b.createdAt, b.id];
  for (let i = 0; i < ka.length; i++) {
    const x = String(ka[i]);
    const y = String(kb[i]);
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/** Minimal structural validation shared by add/update. Field-level UX validation lives in forms. */
function validate(collection: CollectionName, r: Partial<AnyRecord>): Result<true> {
  for (const key of ['dayKey', 'effectiveFrom'] as const) {
    const v = (r as Record<string, unknown>)[key];
    if (v !== undefined && (typeof v !== 'string' || !parseDayKey(v))) {
      return err(msg('validation.invalid_date', { input: String(v) }));
    }
  }
  if (collection === 'weights' && 'kg' in r && r.kg !== undefined) {
    const res = checkRange('weightKg', r.kg, 'kg');
    if (!res.ok) return res;
  }
  if (collection === 'water' && 'ml' in r && r.ml !== undefined) {
    const res = checkRange('waterMl', r.ml, 'ml');
    if (!res.ok) return res;
  }
  return ok(true);
}

/**
 * In-memory Repository. Used by unit tests, by the UI while the IndexedDB layer is built,
 * and later for demo mode (kept separate from real data). Nothing is persisted.
 */
export function createMemoryRepository(options: MemoryRepositoryOptions = {}): Repository {
  const now = options.now ?? (() => nowIso());
  const listeners = new Set<(e: ChangeEvent) => void>();
  const emit = (e: ChangeEvent) => listeners.forEach((l) => l(e));

  const emptyStore = (): Store =>
    Object.fromEntries(COLLECTIONS.map((c) => [c, new Map()])) as unknown as Store;
  let store = emptyStore();
  let settings: Settings = { ...defaultSettings(now()), ...clone(options.settings ?? {}) };
  let profile: Profile = { ...defaultProfile(now()), ...clone(options.profile ?? {}) };

  const table = <C extends CollectionName>(c: C) => store[c] as Map<Id, CollectionMap[C]>;

  for (const c of COLLECTIONS) {
    for (const r of options.seed?.[c] ?? []) table(c).set(r.id, clone(r) as never);
  }

  const repo: Repository = {
    storage: { kind: 'memory', synced: false, persistent: false },

    async list(collection, query: ListQuery = {}) {
      const out = [...table(collection).values()].filter((r) => {
        if (!query.includeDeleted && r.deletedAt) return false;
        const d = sortDay(r);
        if (query.from && d < query.from) return false;
        if (query.to && d > query.to) return false;
        return true;
      });
      return clone(out.sort(compare));
    },

    async get(collection, id) {
      const r = table(collection).get(id);
      return r ? clone(r) : undefined;
    },

    async add(collection, input) {
      const v = validate(collection, input as Partial<AnyRecord>);
      if (!v.ok) return v;
      const t = now();
      const meta: Pick<RecordMeta, 'id' | 'schemaVersion' | 'createdAt' | 'updatedAt'> = {
        id: newId(),
        schemaVersion: SCHEMA_VERSION,
        createdAt: t,
        updatedAt: t,
      };
      const record = {
        ...clone(input as NewRecord<typeof collection>),
        ...meta,
      } as CollectionMap[typeof collection];
      table(collection).set(record.id, record);
      emit({ type: 'put', collection, id: record.id });
      return ok(clone(record));
    },

    async update(collection, id, patch: RecordPatch<typeof collection>) {
      const current = table(collection).get(id);
      if (!current || current.deletedAt) {
        return err(msg('repo.not_found', { collection, id }));
      }
      const v = validate(collection, patch as Partial<AnyRecord>);
      if (!v.ok) return v;
      const safe = Object.fromEntries(
        Object.entries(patch as Record<string, unknown>).filter(
          ([k]) => !['id', 'schemaVersion', 'createdAt'].includes(k),
        ),
      );
      const next = {
        ...current,
        ...clone(safe),
        updatedAt: now(),
      } as CollectionMap[typeof collection];
      table(collection).set(id, next);
      emit({ type: 'put', collection, id });
      return ok(clone(next));
    },

    async remove(collection, id) {
      const current = table(collection).get(id);
      if (!current || current.deletedAt) return err(msg('repo.not_found', { collection, id }));
      const t = now();
      table(collection).set(id, { ...current, deletedAt: t, updatedAt: t });
      emit({ type: 'delete', collection, id });
      return ok(undefined);
    },

    async purge(collection, ids) {
      for (const id of ids) {
        if (table(collection).delete(id)) emit({ type: 'delete', collection, id });
      }
    },

    async findByDedupeKeys(collection, keys) {
      const wanted = new Set(keys);
      return clone(
        [...table(collection).values()].filter((r) => r.dedupeKey && wanted.has(r.dedupeKey)),
      );
    },

    async getSettings() {
      return clone(settings);
    },
    async saveSettings(patch) {
      settings = { ...settings, ...clone(patch), schemaVersion: SCHEMA_VERSION, updatedAt: now() };
      emit({ type: 'settings' });
      return clone(settings);
    },
    async getProfile() {
      return clone(profile);
    },
    async saveProfile(patch) {
      profile = { ...profile, ...clone(patch), schemaVersion: SCHEMA_VERSION, updatedAt: now() };
      emit({ type: 'profile' });
      return clone(profile);
    },

    async reset() {
      store = emptyStore();
      settings = defaultSettings(now());
      profile = defaultProfile(now());
      emit({ type: 'reset' });
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return repo;
}
