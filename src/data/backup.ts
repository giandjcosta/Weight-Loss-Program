import {
  APP_NAME,
  COLLECTIONS,
  SCHEMA_VERSION,
  err,
  msg,
  nowIso,
  ok,
  type CollectionMap,
  type CollectionName,
  type IsoDateTime,
  type Profile,
  type Repository,
  type Result,
  type Settings,
} from '../core';
import { validateStoredRecord, type AnyRecord } from './recordRules';

export const BACKUP_FORMAT = 'ritmea-backup';
export const BACKUP_FORMAT_VERSION = 1;

export interface RitmeaBackup {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  app: string;
  schemaVersion: number;
  exportedAt: IsoDateTime;
  /** True if any record comes from the synthetic demo dataset. */
  containsDemoData: boolean;
  settings: Settings;
  profile: Profile;
  /** Every record, including soft-deleted ones (so deletions survive a restore). */
  collections: { [C in CollectionName]: CollectionMap[C][] };
}

export interface RestoreSummary {
  mode: 'replace' | 'merge';
  added: number;
  updated: number;
  unchanged: number;
  byCollection: Partial<Record<CollectionName, number>>;
}

/**
 * Record-shape upgrades for backups made by older app versions, keyed by the version they
 * upgrade *to*. Empty at v1. Tests inject their own registry.
 */
export type RecordMigrations = Record<
  number,
  (collection: CollectionName, record: Record<string, unknown>) => Record<string, unknown>
>;
export const RECORD_MIGRATIONS: RecordMigrations = {};

export async function createBackup(
  repo: Repository,
  now: IsoDateTime = nowIso(),
): Promise<RitmeaBackup> {
  const entries = await Promise.all(
    COLLECTIONS.map(async (c) => [c, await repo.list(c, { includeDeleted: true })] as const),
  );
  const collections = Object.fromEntries(entries) as RitmeaBackup['collections'];
  const containsDemoData = entries.some(([, rs]) =>
    (rs as AnyRecord[]).some((r) => r.source?.kind === 'demo'),
  );
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    app: APP_NAME,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now,
    containsDemoData,
    settings: await repo.getSettings(),
    profile: await repo.getProfile(),
    collections,
  };
}

export const backupFileName = (exportedAt: string): string =>
  `ritmea-backup-${exportedAt.slice(0, 10)}.json`;

export const serializeBackup = (b: RitmeaBackup): string => JSON.stringify(b, null, 1);

/** Parse and validate a backup file. Never partially accepts a malformed file. */
export function parseBackup(
  text: string,
  recordMigrations: RecordMigrations = RECORD_MIGRATIONS,
): Result<RitmeaBackup> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return err(msg('import.malformed', {}));
  }
  if (typeof raw !== 'object' || raw === null) return err(msg('import.malformed', {}));
  const b = raw as Record<string, unknown>;
  if (b.format !== BACKUP_FORMAT || typeof b.formatVersion !== 'number') {
    return err(msg('import.unsupported_format', { fileName: '' }));
  }
  if (b.formatVersion > BACKUP_FORMAT_VERSION || Number(b.schemaVersion) > SCHEMA_VERSION) {
    // Made by a newer app version: refuse rather than silently drop unknown fields.
    return err(msg('import.unsupported_format', { fileName: '' }));
  }
  if (typeof b.collections !== 'object' || b.collections === null) {
    return err(msg('import.malformed', {}));
  }
  const src = b.collections as Record<string, unknown>;
  const collections = {} as Record<CollectionName, AnyRecord[]>;
  for (const c of COLLECTIONS) {
    const list = src[c] ?? [];
    if (!Array.isArray(list)) return err(msg('import.malformed', {}));
    const upgraded: AnyRecord[] = [];
    for (const item of list) {
      let rec = item as Record<string, unknown>;
      const from = typeof rec?.schemaVersion === 'number' ? rec.schemaVersion : NaN;
      if (Number.isNaN(from) || from > SCHEMA_VERSION) return err(msg('import.malformed', {}));
      for (let v = from + 1; v <= SCHEMA_VERSION; v++) {
        const step = recordMigrations[v];
        if (!step) return err(msg('import.unsupported_format', { fileName: '' }));
        rec = { ...step(c, rec), schemaVersion: v };
      }
      const valid = validateStoredRecord(c, rec);
      if (!valid.ok) return valid;
      upgraded.push(rec as unknown as AnyRecord);
    }
    collections[c] = upgraded;
  }
  return ok({
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    app: String(b.app ?? APP_NAME),
    schemaVersion: SCHEMA_VERSION,
    exportedAt: String(b.exportedAt ?? '') as IsoDateTime,
    containsDemoData: Boolean(b.containsDemoData),
    settings: b.settings as Settings,
    profile: b.profile as Profile,
    collections: collections as RitmeaBackup['collections'],
  });
}

/**
 * Restore a parsed backup.
 * - `replace`: the device ends up exactly like the backup (settings and profile included).
 *   If anything fails midway, the previous state is written back.
 * - `merge`: records are matched by id; the version with the newer `updatedAt` wins (a newer
 *   deletion wins too). Settings and profile on this device are kept.
 */
export async function restoreBackup(
  repo: Repository,
  backup: RitmeaBackup,
  mode: 'replace' | 'merge',
): Promise<Result<RestoreSummary>> {
  const summary: RestoreSummary = { mode, added: 0, updated: 0, unchanged: 0, byCollection: {} };

  if (mode === 'replace') {
    const previous = await createBackup(repo);
    try {
      await writeAll(repo, backup, summary);
      return ok(summary);
    } catch (error) {
      console.error('Ritmea: restore failed, rolling back', error);
      await writeAll(repo, previous, { ...summary });
      return err(msg('repo.storage_unavailable', {}));
    }
  }

  for (const c of COLLECTIONS) {
    const incoming = backup.collections[c] as AnyRecord[];
    if (incoming.length === 0) continue;
    const current = new Map(
      ((await repo.list(c, { includeDeleted: true })) as AnyRecord[]).map((r) => [r.id, r]),
    );
    const toWrite: AnyRecord[] = [];
    for (const r of incoming) {
      const existing = current.get(r.id);
      if (!existing) {
        summary.added++;
        toWrite.push(r);
      } else if (r.updatedAt > existing.updatedAt) {
        summary.updated++;
        toWrite.push(r);
      } else {
        summary.unchanged++;
      }
    }
    const res = await repo.putMany(c, toWrite as never);
    if (!res.ok) return res;
    if (toWrite.length) summary.byCollection[c] = toWrite.length;
  }
  return ok(summary);
}

async function writeAll(repo: Repository, backup: RitmeaBackup, summary: RestoreSummary) {
  await repo.reset();
  for (const c of COLLECTIONS) {
    const records = backup.collections[c];
    const res = await repo.putMany(c, records as never);
    if (!res.ok) throw new Error(`Restore of ${c} rejected: ${res.error.code}`);
    if (records.length) summary.byCollection[c] = records.length;
    summary.added += records.length;
  }
  const { schemaVersion: _s, updatedAt: _u, ...settings } = backup.settings;
  const { schemaVersion: _ps, updatedAt: _pu, ...profile } = backup.profile;
  await repo.saveSettings(settings);
  await repo.saveProfile(profile);
}
