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
  type RepositoryBatch,
  parseIsoDateTime,
  validateFullProfile,
  validateFullSettings,
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

/** Build a backup from ONE consistent snapshot of the device (`Repository.exportAll`). */
export async function createBackup(
  repo: Repository,
  now: IsoDateTime = nowIso(),
): Promise<RitmeaBackup> {
  const snap = await repo.exportAll();
  const containsDemoData = COLLECTIONS.some((c) =>
    (snap.records[c] as AnyRecord[]).some((r) => r.source?.kind === 'demo'),
  );
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    app: APP_NAME,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now,
    containsDemoData,
    settings: snap.settings,
    profile: snap.profile,
    collections: snap.records,
  };
}

export const backupFileName = (exportedAt: string): string =>
  `ritmea-backup-${exportedAt.slice(0, 10)}.json`;

export const serializeBackup = (b: RitmeaBackup): string => JSON.stringify(b, null, 1);

/**
 * Parse and validate a backup file COMPLETELY before anything destructive can happen:
 * format and integer versions, `exportedAt`, every collection key present (a truncated file
 * is refused, not treated as "empty"), every record, settings and profile. Never partially
 * accepts a file.
 */
export function parseBackup(
  text: string,
  recordMigrations: RecordMigrations = RECORD_MIGRATIONS,
): Result<RitmeaBackup> {
  const malformed = () => err<RitmeaBackup>(msg('import.malformed', {}));
  const unsupported = () => err<RitmeaBackup>(msg('import.unsupported_format', { fileName: '' }));
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return malformed();
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return malformed();
  const b = raw as Record<string, unknown>;
  if (b.format !== BACKUP_FORMAT) return unsupported();
  const isVersion = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 1;
  if (!isVersion(b.formatVersion) || !isVersion(b.schemaVersion)) return malformed();
  if (
    (b.formatVersion as number) > BACKUP_FORMAT_VERSION ||
    (b.schemaVersion as number) > SCHEMA_VERSION
  ) {
    // Made by a newer app version: refuse rather than silently drop unknown fields.
    return unsupported();
  }
  if (typeof b.exportedAt !== 'string' || !parseIsoDateTime(b.exportedAt)) return malformed();
  if (typeof b.containsDemoData !== 'boolean') return malformed();
  if (typeof b.collections !== 'object' || b.collections === null || Array.isArray(b.collections)) {
    return malformed();
  }
  const src = b.collections as Record<string, unknown>;
  const collections = {} as Record<CollectionName, AnyRecord[]>;
  for (const c of COLLECTIONS) {
    // Every collection known to this format version must be present (possibly empty).
    if (!(c in src)) return malformed();
    const list = src[c];
    if (!Array.isArray(list)) return malformed();
    const upgraded: AnyRecord[] = [];
    const ids = new Set<string>();
    for (const item of list) {
      if (typeof item !== 'object' || item === null) return malformed();
      let rec = item as Record<string, unknown>;
      const from = rec.schemaVersion;
      if (
        typeof from !== 'number' ||
        !Number.isInteger(from) ||
        from < 0 ||
        from > SCHEMA_VERSION
      ) {
        return malformed();
      }
      for (let v = from + 1; v <= SCHEMA_VERSION; v++) {
        const step = recordMigrations[v];
        if (!step) return unsupported();
        rec = { ...step(c, rec), schemaVersion: v };
      }
      const valid = validateStoredRecord(c, rec);
      if (!valid.ok) return valid;
      if (ids.has(String(rec.id))) return malformed(); // duplicate id in one collection
      ids.add(String(rec.id));
      upgraded.push(rec as unknown as AnyRecord);
    }
    collections[c] = upgraded;
  }
  const settingsOk = validateFullSettings(b.settings);
  if (!settingsOk.ok) return settingsOk;
  const profileOk = validateFullProfile(b.profile);
  if (!profileOk.ok) return profileOk;
  return ok({
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    app: typeof b.app === 'string' ? b.app : APP_NAME,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: b.exportedAt as IsoDateTime,
    containsDemoData: b.containsDemoData,
    settings: b.settings as Settings,
    profile: b.profile as Profile,
    collections: collections as RitmeaBackup['collections'],
  });
}

/**
 * Restore a parsed backup. Both modes are ATOMIC: everything is validated first and written in
 * one storage transaction (`Repository.commitBatch`), so a failure — or the app being closed
 * midway — leaves the device exactly as it was.
 * - `replace`: the device becomes exactly the backup (records, settings, profile).
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
    for (const c of COLLECTIONS) {
      const n = backup.collections[c].length;
      if (n) summary.byCollection[c] = n;
      summary.added += n;
    }
    const res = await repo.commitBatch({
      replaceAll: true,
      records: backup.collections,
      settings: backup.settings,
      profile: backup.profile,
    });
    return res.ok ? ok(summary) : res;
  }

  const records: RepositoryBatch['records'] = {};
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
      } else if (Date.parse(r.updatedAt) > Date.parse(existing.updatedAt)) {
        // compare instants, not strings: offsets may differ (+01:00 vs +02:00)
        summary.updated++;
        toWrite.push(r);
      } else {
        summary.unchanged++;
      }
    }
    if (toWrite.length) {
      (records as Record<string, AnyRecord[]>)[c] = toWrite;
      summary.byCollection[c] = toWrite.length;
    }
  }
  const res = await repo.commitBatch({ records });
  return res.ok ? ok(summary) : res;
}
