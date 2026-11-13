import type {
  CollectionMap,
  CollectionName,
  DayKey,
  Id,
  NewRecord,
  Profile,
  RecordPatch,
  Settings,
} from './types';
import type { Result } from './result';

export interface ListQuery {
  /** Inclusive day range on `dayKey` (or `effectiveFrom` for goals/targets). */
  from?: DayKey;
  to?: DayKey;
  /** Include soft-deleted records (for backup/reconciliation). Default false. */
  includeDeleted?: boolean;
}

export type ChangeEvent =
  | { type: 'put'; collection: CollectionName; id: Id }
  | { type: 'delete'; collection: CollectionName; id: Id }
  | { type: 'settings' }
  | { type: 'profile' }
  | { type: 'reset' };

/**
 * The only way UI and calc code touch stored data. Implementations: in-memory (tests, UI
 * development, demo mode) and IndexedDB (src/data, next PR). Both must pass the shared
 * contract suite in `src/data/repositoryContract.ts`.
 *
 * Rules every implementation guarantees:
 * - Returned objects are copies; mutating them never changes stored data.
 * - `list` is sorted by day (or `effectiveFrom`) ascending, then `recordedAt`, then `createdAt`.
 * - `remove` is a soft delete; `purge` is the only hard delete.
 * - Values are stored exactly as given: no rounding, no unit conversion, no zero-filling.
 */
export interface Repository {
  list<C extends CollectionName>(collection: C, query?: ListQuery): Promise<CollectionMap[C][]>;
  get<C extends CollectionName>(collection: C, id: Id): Promise<CollectionMap[C] | undefined>;
  add<C extends CollectionName>(
    collection: C,
    input: NewRecord<C>,
  ): Promise<Result<CollectionMap[C]>>;
  update<C extends CollectionName>(
    collection: C,
    id: Id,
    patch: RecordPatch<C>,
  ): Promise<Result<CollectionMap[C]>>;
  remove(collection: CollectionName, id: Id): Promise<Result<void>>;
  /** Permanently delete records (user-requested data deletion). */
  purge(collection: CollectionName, ids: Id[]): Promise<void>;
  /** Records whose `dedupeKey` is in `keys` (deleted included), for import de-duplication. */
  findByDedupeKeys<C extends CollectionName>(
    collection: C,
    keys: string[],
  ): Promise<CollectionMap[C][]>;

  getSettings(): Promise<Settings>;
  saveSettings(patch: Partial<Omit<Settings, 'schemaVersion' | 'updatedAt'>>): Promise<Settings>;
  getProfile(): Promise<Profile>;
  saveProfile(patch: Partial<Omit<Profile, 'schemaVersion' | 'updatedAt'>>): Promise<Profile>;

  /** Delete everything (settings return to defaults). */
  reset(): Promise<void>;
  /** Listen to changes; returns an unsubscribe function. */
  subscribe(listener: (event: ChangeEvent) => void): () => void;

  /** Where data lives, for honest UI copy ("solo su questo dispositivo"). */
  readonly storage: { kind: 'memory' | 'indexeddb'; synced: false; persistent: boolean };
}
