import type { CollectionName, Id } from '../../core';
import type { MetaKey, StorageBackend } from '../backend';
import type { AnyRecord } from '../recordRules';
import {
  DB_VERSION,
  META_STORE,
  MIGRATIONS,
  SNAPSHOT_STORE,
  snapshotBeforeMigration,
  type Migrations,
} from './schema';

export interface OpenOptions {
  /** Database name. Real data uses `ritmea`; demo mode and tests use other names. */
  name?: string;
  /** For tests: a custom target version and migration set. */
  version?: number;
  migrations?: Migrations;
  /** IndexedDB factory (tests pass fake-indexeddb). Defaults to the global `indexedDB`. */
  factory?: IDBFactory;
}

export const DEFAULT_DB_NAME = 'ritmea';

const req = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

const done = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'));
    tx.onerror = () => reject(tx.error);
  });

/** Open (and if needed upgrade) the database. Upgrades are atomic; see `schema.ts`. */
export function openDatabase(options: OpenOptions = {}): Promise<IDBDatabase> {
  const factory = options.factory ?? globalThis.indexedDB;
  if (!factory) return Promise.reject(new Error('IndexedDB is not available'));
  const version = options.version ?? DB_VERSION;
  const migrations = options.migrations ?? MIGRATIONS;
  return new Promise((resolve, reject) => {
    const open = factory.open(options.name ?? DEFAULT_DB_NAME, version);
    open.onupgradeneeded = (event) => {
      const db = open.result;
      const tx = open.transaction!;
      const oldVersion = event.oldVersion;
      try {
        snapshotBeforeMigration(tx, db, oldVersion);
        for (let v = oldVersion + 1; v <= version; v++) {
          const step = migrations[v];
          if (!step) throw new Error(`Missing IndexedDB migration to version ${v}`);
          step({ db, tx, oldVersion });
        }
      } catch (error) {
        tx.abort();
        reject(error);
      }
    };
    open.onsuccess = () => {
      const db = open.result;
      // Another tab opened a newer version: close so its upgrade can proceed.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    open.onerror = () => reject(open.error);
    open.onblocked = () =>
      reject(new Error('Database upgrade blocked: close other Ritmea tabs and reload.'));
  });
}

export function createIndexedDbBackend(db: IDBDatabase, isPersistent = false): StorageBackend {
  let persistent = isPersistent;
  const tx = (stores: string | string[], mode: IDBTransactionMode) => db.transaction(stores, mode);

  const backend: StorageBackend & { setPersistent(v: boolean): void } = {
    kind: 'indexeddb',
    persistent: () => persistent,
    setPersistent(v: boolean) {
      persistent = v;
    },
    async getAll(c: CollectionName) {
      return req(tx(c, 'readonly').objectStore(c).getAll()) as Promise<AnyRecord[]>;
    },
    async get(c: CollectionName, id: Id) {
      return req(tx(c, 'readonly').objectStore(c).get(id)) as Promise<AnyRecord | undefined>;
    },
    async put(c, records) {
      const t = tx(c, 'readwrite');
      const store = t.objectStore(c);
      for (const r of records) store.put(r);
      await done(t);
    },
    async delete(c, ids) {
      const t = tx(c, 'readwrite');
      const store = t.objectStore(c);
      const existed: Id[] = [];
      for (const id of ids) {
        const g = store.getKey(id);
        g.onsuccess = () => {
          if (g.result !== undefined) {
            existed.push(id);
            store.delete(id);
          }
        };
      }
      await done(t);
      return existed;
    },
    async getByDedupeKeys(c, keys) {
      const t = tx(c, 'readonly');
      const index = t.objectStore(c).index('dedupeKey');
      const results = await Promise.all(
        [...new Set(keys)].map((k) => req(index.getAll(k)) as Promise<AnyRecord[]>),
      );
      return results.flat();
    },
    async getMeta<T>(key: MetaKey) {
      return req(tx(META_STORE, 'readonly').objectStore(META_STORE).get(key)) as Promise<
        T | undefined
      >;
    },
    async putMeta(key, value) {
      const t = tx(META_STORE, 'readwrite');
      t.objectStore(META_STORE).put(value, key);
      await done(t);
    },
    async readAll() {
      const names = [...db.objectStoreNames].filter((n) => n !== SNAPSHOT_STORE);
      const t = tx(names, 'readonly');
      const collections = {} as Record<CollectionName, AnyRecord[]>;
      const meta: Partial<Record<MetaKey, unknown>> = {};
      const reads: Promise<void>[] = [];
      for (const n of names) {
        const store = t.objectStore(n);
        if (n === META_STORE) {
          const keys = req(store.getAllKeys());
          const values = req(store.getAll());
          reads.push(
            Promise.all([keys, values]).then(([k, v]) => {
              k.forEach((key, i) => (meta[key as MetaKey] = v[i]));
            }),
          );
        } else {
          reads.push(
            req(store.getAll()).then((rs) => {
              collections[n as CollectionName] = rs as AnyRecord[];
            }),
          );
        }
      }
      await Promise.all(reads);
      return { collections, meta };
    },
    async commit(batch) {
      const touched = new Set<string>([
        ...Object.keys(batch.put),
        ...(batch.meta && Object.keys(batch.meta).length ? [META_STORE] : []),
      ]);
      const names = batch.clearAll
        ? [...db.objectStoreNames].filter((n) => n !== SNAPSHOT_STORE)
        : [...touched];
      if (names.length === 0) return;
      const t = tx(names, 'readwrite');
      const finished = done(t);
      try {
        if (batch.clearAll) for (const n of names) t.objectStore(n).clear();
        for (const [c, records] of Object.entries(batch.put)) {
          const store = t.objectStore(c);
          for (const r of records ?? []) store.put(r);
        }
        for (const [k, v] of Object.entries(batch.meta ?? {})) {
          t.objectStore(META_STORE).put(v, k);
        }
      } catch (error) {
        // e.g. DataCloneError: abort so the whole batch (including the clear) is discarded
        t.abort();
        await finished.catch(() => undefined);
        throw error;
      }
      await finished;
    },
    async clear() {
      const names = [...db.objectStoreNames].filter((n) => n !== SNAPSHOT_STORE);
      const t = tx(names, 'readwrite');
      for (const n of names) t.objectStore(n).clear();
      await done(t);
    },
  };
  return backend;
}

/** Read the pre-migration snapshots (newest first), e.g. to offer "restore previous version". */
export async function listMigrationSnapshots(
  db: IDBDatabase,
): Promise<{ takenAtVersion: number; takenAt: string; data: Record<string, unknown[]> }[]> {
  if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) return [];
  const all = await req(
    db.transaction(SNAPSHOT_STORE, 'readonly').objectStore(SNAPSHOT_STORE).getAll(),
  );
  return (
    all as { takenAtVersion: number; takenAt: string; data: Record<string, unknown[]> }[]
  ).sort((a, b) => b.takenAtVersion - a.takenAtVersion);
}
