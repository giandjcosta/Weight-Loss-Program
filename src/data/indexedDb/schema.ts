import { COLLECTIONS } from '../../core';

/** Bump when the IndexedDB structure or stored record shape changes; add a migration below. */
export const DB_VERSION = 1;
export const META_STORE = 'meta';
/** Copies of every store (collections + meta) taken right before an upgrade. */
export const SNAPSHOT_STORE = 'preMigrationSnapshots';

export interface MigrationContext {
  db: IDBDatabase;
  tx: IDBTransaction;
  /** Version the database had before this upgrade (0 = brand new). */
  oldVersion: number;
}

/**
 * Migration steps keyed by the version they upgrade *to*. Each runs inside the single
 * `versionchange` transaction, so if any step throws, the whole upgrade aborts and the
 * previous data stays untouched. Steps must be idempotent with respect to a fresh database.
 */
export type Migrations = Record<number, (ctx: MigrationContext) => void>;

export const MIGRATIONS: Migrations = {
  1: ({ db }) => {
    for (const name of COLLECTIONS) {
      if (db.objectStoreNames.contains(name)) continue;
      const store = db.createObjectStore(name, { keyPath: 'id' });
      store.createIndex('dedupeKey', 'dedupeKey', { unique: false });
    }
    if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
    if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
      db.createObjectStore(SNAPSHOT_STORE, { keyPath: 'takenAtVersion' });
    }
  },
};

/**
 * Copy every record of every existing store (collections and meta) into the snapshot store, in the same
 * versionchange transaction, before migrations change anything.
 */
export function snapshotBeforeMigration(tx: IDBTransaction, db: IDBDatabase, oldVersion: number) {
  if (oldVersion === 0 || !db.objectStoreNames.contains(SNAPSHOT_STORE)) return;
  const snapshot: { takenAtVersion: number; takenAt: string; data: Record<string, unknown[]> } = {
    takenAtVersion: oldVersion,
    takenAt: new Date().toISOString(),
    data: {},
  };
  // every existing store except the snapshot store itself: collections AND `meta`
  // (settings, profile); meta is keyed out-of-line, so keys are captured alongside values
  const names = [...db.objectStoreNames].filter((n) => n !== SNAPSHOT_STORE);
  let pending = names.length;
  const write = () => tx.objectStore(SNAPSHOT_STORE).put(snapshot);
  if (pending === 0) return write();
  for (const name of names) {
    const store = tx.objectStore(name);
    if (name === META_STORE) {
      const keys = store.getAllKeys();
      const values = store.getAll();
      values.onsuccess = () => {
        snapshot.data[name] = keys.result.map((k, i) => ({ key: k, value: values.result[i] }));
        if (--pending === 0) write();
      };
      continue;
    }
    const req = store.getAll();
    req.onsuccess = () => {
      snapshot.data[name] = req.result;
      if (--pending === 0) write();
    };
  }
}
