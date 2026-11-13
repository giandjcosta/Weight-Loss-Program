import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { DayKey, TimeZone } from '../../core';
import { runRepositoryContract } from '../repositoryContract';
import { openIndexedDbRepository } from './indexedDbRepository';
import { listMigrationSnapshots, openDatabase } from './idbBackend';
import { MIGRATIONS } from './schema';

let n = 0;
const uniqueName = () => `ritmea-test-${Date.now()}-${++n}`;

runRepositoryContract('indexeddb', () => openIndexedDbRepository({ name: uniqueName() }));

const tz = 'Europe/Rome' as TimeZone;
const weight = (dayKey: string, kg: number) => ({
  dayKey: dayKey as DayKey,
  timeZone: tz,
  kg,
  quality: 'measured' as const,
  source: { kind: 'manual' as const },
});

describe('IndexedDB persistence', () => {
  it('keeps records, settings and profile after closing and reopening', async () => {
    const name = uniqueName();
    const a = await openIndexedDbRepository({ name });
    await a.add('weights', weight('2026-09-01', 80.2));
    await a.saveSettings({ locale: 'en', units: { weight: 'lb' } as never });
    await a.saveProfile({ heightCm: { kind: 'value', value: 170 } });
    a.close();

    const b = await openIndexedDbRepository({ name });
    expect((await b.list('weights')).map((w) => w.kg)).toEqual([80.2]);
    const s = await b.getSettings();
    expect(s.locale).toBe('en');
    expect(s.units.weight).toBe('lb');
    expect(s.units.length).toBe('cm'); // partial unit patch merged, not replaced
    expect((await b.getProfile()).heightCm).toEqual({ kind: 'value', value: 170 });
    b.close();
  });

  it('uses separate databases for separate names (demo never mixes with real data)', async () => {
    const real = await openIndexedDbRepository({ name: uniqueName() });
    const demo = await openIndexedDbRepository({ name: uniqueName() });
    await demo.add('weights', weight('2026-09-01', 88));
    expect(await real.list('weights')).toHaveLength(0);
    real.close();
    demo.close();
  });
});

describe('IndexedDB migrations', () => {
  it('upgrades v1 → v2, transforms records and keeps a pre-migration snapshot', async () => {
    const name = uniqueName();
    const v1 = await openIndexedDbRepository({ name });
    await v1.add('weights', weight('2026-09-01', 80));
    await v1.add('weights', weight('2026-09-02', 79.6));
    v1.close();

    const db = await openDatabase({
      name,
      version: 2,
      migrations: {
        ...MIGRATIONS,
        2: ({ tx }) => {
          const store = tx.objectStore('weights');
          store.createIndex('dayKey', 'dayKey');
          const cursorReq = store.openCursor();
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (!cursor) return;
            cursor.update({ ...cursor.value, note: 'migrated' });
            cursor.continue();
          };
        },
      },
    });
    const all = await new Promise<{ note?: string; kg: number }[]>((resolve) => {
      const r = db.transaction('weights').objectStore('weights').getAll();
      r.onsuccess = () => resolve(r.result);
    });
    expect(all.map((w) => [w.kg, w.note])).toEqual(
      expect.arrayContaining([
        [80, 'migrated'],
        [79.6, 'migrated'],
      ]),
    );
    expect(db.transaction('weights').objectStore('weights').indexNames.contains('dayKey')).toBe(
      true,
    );
    const snaps = await listMigrationSnapshots(db);
    expect(snaps[0]?.takenAtVersion).toBe(1);
    expect((snaps[0]?.data.weights as { note?: string }[]).every((w) => w.note === undefined)).toBe(
      true,
    );
    db.close();
  });

  it('aborts a failing upgrade without touching existing data', async () => {
    const name = uniqueName();
    const v1 = await openIndexedDbRepository({ name });
    await v1.add('weights', weight('2026-09-01', 80));
    v1.close();

    await expect(
      openDatabase({
        name,
        version: 2,
        migrations: {
          ...MIGRATIONS,
          2: () => {
            throw new Error('boom');
          },
        },
      }),
    ).rejects.toThrow();

    const again = await openIndexedDbRepository({ name }); // still version 1
    expect((await again.list('weights')).map((w) => w.kg)).toEqual([80]);
    again.close();
  });

  it('refuses to open when a migration step is missing', async () => {
    await expect(
      openDatabase({ name: uniqueName(), version: 3, migrations: MIGRATIONS }),
    ).rejects.toThrow(/Missing IndexedDB migration/);
  });
});
