import { describe, expect, it } from 'vitest';
import { COLLECTIONS, type DayKey, type IsoDateTime, type TimeZone } from '../core';
import { createMemoryRepository } from './memoryRepository';
import { createDemoDataset } from './fixtures/demo';
import {
  backupFileName,
  createBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
  type RitmeaBackup,
} from './backup';

const tz = 'Europe/Rome' as TimeZone;
const weight = (dayKey: string, kg: number) => ({
  dayKey: dayKey as DayKey,
  timeZone: tz,
  kg,
  quality: 'measured' as const,
  source: { kind: 'manual' as const },
});

async function snapshot(repo: ReturnType<typeof createMemoryRepository>) {
  const out: Record<string, unknown> = {};
  for (const c of COLLECTIONS) out[c] = await repo.list(c, { includeDeleted: true });
  const { updatedAt: _s, ...settings } = await repo.getSettings();
  const { updatedAt: _p, ...profile } = await repo.getProfile();
  return { ...out, settings, profile };
}

describe('backup round trip', () => {
  it('backup → JSON → parse → replace-restore into an empty device is identical', async () => {
    const source = createMemoryRepository({ seed: createDemoDataset() });
    const w = await source.add('weights', weight('2026-10-20', 84.3));
    if (!w.ok) throw new Error();
    await source.remove('weights', w.value.id); // deletions must survive too
    await source.saveSettings({ locale: 'en' });
    await source.saveProfile({ sex: { kind: 'declined' } });

    const backup = await createBackup(source);
    expect(backup.containsDemoData).toBe(true);
    const parsed = parseBackup(serializeBackup(backup));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const target = createMemoryRepository();
    const res = await restoreBackup(target, parsed.value, 'replace');
    expect(res.ok).toBe(true);
    expect(await snapshot(target)).toEqual(await snapshot(source));
  });

  it('names files by export day', () => {
    expect(backupFileName('2026-11-13T21:00:00.000+01:00')).toBe('ritmea-backup-2026-11-13.json');
  });
});

describe('merge restore', () => {
  it('adds missing records, keeps newer local edits, takes newer backup edits', async () => {
    let clock = 0;
    const now = () =>
      `2026-11-13T10:00:${String(clock++).padStart(2, '0')}.000+01:00` as IsoDateTime;
    const device = createMemoryRepository({ now });
    const a = await device.add('weights', weight('2026-09-01', 80));
    const b = await device.add('weights', weight('2026-09-02', 79.5));
    if (!a.ok || !b.ok) throw new Error();
    const backup = await createBackup(device);

    // after the backup: device edits A; backup gets a newer edit of B and a new record C
    await device.update('weights', a.value.id, { kg: 80.1 });
    const later = '2026-11-13T11:00:00.000+01:00' as IsoDateTime;
    const edited: RitmeaBackup = structuredClone(backup);
    edited.collections.weights = edited.collections.weights.map((r) =>
      r.id === b.value.id ? { ...r, kg: 79.4, updatedAt: later } : r,
    );
    edited.collections.weights.push({
      ...b.value,
      id: '33333333-3333-4333-8333-333333333333' as typeof b.value.id,
      dayKey: '2026-09-03' as DayKey,
      kg: 79.2,
    });

    const res = await restoreBackup(device, edited, 'merge');
    expect(res.ok && res.value).toMatchObject({ added: 1, updated: 1, unchanged: 1 });
    const kgs = (await device.list('weights')).map((w) => w.kg);
    expect(kgs).toEqual([80.1, 79.4, 79.2]);
    expect((await device.getSettings()).locale).toBe('it'); // merge keeps device settings
  });
});

describe('parseBackup safety', () => {
  const valid = async () => serializeBackup(await createBackup(createMemoryRepository()));

  it('rejects non-JSON, other formats and files from newer app versions', async () => {
    expect(parseBackup('not json').ok).toBe(false);
    expect(parseBackup('{"format":"other"}').ok).toBe(false);
    const newer = JSON.parse(await valid());
    newer.formatVersion = 99;
    expect(parseBackup(JSON.stringify(newer)).ok).toBe(false);
  });

  it('rejects the whole file if one record is invalid (no partial restore)', async () => {
    const b = JSON.parse(await valid());
    b.collections.weights = [
      {
        id: 'x',
        schemaVersion: 1,
        createdAt: 'a',
        updatedAt: 'a',
        source: { kind: 'manual' },
        dayKey: '2026-13-01',
        timeZone: 'Europe/Rome',
        kg: 80,
        quality: 'measured',
      },
    ];
    const res = parseBackup(JSON.stringify(b));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('validation.invalid_date');
  });

  it('upgrades old record versions through the record-migration registry', async () => {
    const b = JSON.parse(await valid());
    b.collections.water = [
      {
        id: 'w1',
        schemaVersion: 0,
        createdAt: 'a',
        updatedAt: 'a',
        source: { kind: 'manual' },
        dayKey: '2026-09-01',
        timeZone: 'Europe/Rome',
        litres: 0.5,
      },
    ];
    const res = parseBackup(JSON.stringify(b), {
      1: (_c, r) => {
        const { litres, ...rest } = r as { litres?: number };
        return litres === undefined ? rest : { ...rest, ml: litres * 1000 };
      },
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.collections.water[0]).toMatchObject({ ml: 500, schemaVersion: 1 });
    expect(parseBackup(JSON.stringify(b)).ok).toBe(false); // no registry entry → refused
  });
});

describe('replace restore rollback', () => {
  it('puts the previous data back if the backup content is rejected midway', async () => {
    const device = createMemoryRepository();
    await device.add('weights', weight('2026-09-01', 80));
    const backup = await createBackup(createMemoryRepository());
    // settings that fail validation make the restore fail after records were written
    (backup.settings as { customProgressColors?: string[] }).customProgressColors = ['nope'];
    const errorSpy = console.error;
    console.error = () => {};
    try {
      const res = await restoreBackup(device, backup, 'replace');
      expect(res.ok).toBe(false);
    } finally {
      console.error = errorSpy;
    }
    expect((await device.list('weights')).map((w) => w.kg)).toEqual([80]);
  });
});
