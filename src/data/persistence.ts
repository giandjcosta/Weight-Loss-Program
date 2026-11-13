/**
 * Browser storage durability helpers. On iOS Safari, script-written storage of a site that is
 * not installed to the Home Screen can be evicted after a period without use; installing the
 * PWA and keeping backups are the user-facing mitigations.
 */

export async function isStoragePersisted(): Promise<boolean> {
  try {
    return (await globalThis.navigator?.storage?.persisted?.()) ?? false;
  } catch {
    return false;
  }
}

/** Ask the browser not to evict our data. Must be called after a user gesture on some browsers. */
export async function requestPersistentStorage(): Promise<'granted' | 'denied' | 'unsupported'> {
  const storage = globalThis.navigator?.storage;
  if (!storage?.persist) return 'unsupported';
  try {
    return (await storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export async function storageEstimate(): Promise<{ usage?: number; quota?: number }> {
  try {
    const e = await globalThis.navigator?.storage?.estimate?.();
    return e
      ? {
          ...(e.usage !== undefined && { usage: e.usage }),
          ...(e.quota !== undefined && { quota: e.quota }),
        }
      : {};
  } catch {
    return {};
  }
}

/** Days since the last backup, or undefined if never backed up. */
export function daysSinceBackup(
  lastBackupAt: string | undefined,
  now: Date = new Date(),
): number | undefined {
  if (!lastBackupAt) return undefined;
  const t = Date.parse(lastBackupAt);
  return Number.isNaN(t) ? undefined : Math.floor((now.getTime() - t) / 86_400_000);
}
