import type { IsoDateTime, Repository } from '../../core';
import { createRepository } from '../createRepository';
import { isStoragePersisted } from '../persistence';
import { createIndexedDbBackend, openDatabase, type OpenOptions } from './idbBackend';

export interface IndexedDbRepositoryOptions extends OpenOptions {
  now?: () => IsoDateTime;
}

/**
 * Persistent Repository backed by IndexedDB (browser-local, this device only, not synced).
 * Throws if IndexedDB is unavailable or the upgrade fails; callers should show
 * `repo.storage_unavailable` and must not fall back silently to memory for real data.
 */
export async function openIndexedDbRepository(
  options: IndexedDbRepositoryOptions = {},
): Promise<Repository & { close(): void }> {
  const db = await openDatabase(options);
  const backend = createIndexedDbBackend(db, await isStoragePersisted());
  const repo = createRepository(backend, options.now ? { now: options.now } : {});
  return Object.assign(repo, { close: () => db.close() });
}
