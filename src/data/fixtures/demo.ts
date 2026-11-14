/**
 * SYNTHETIC DEMO DATA — a fictional person ("Demo"). Not derived from any real user.
 * Deterministic (seeded) so tests and screenshots are stable. Every record has
 * `source.kind === 'demo'` so it can never be mistaken for, or mixed with, real data.
 */
import {
  SCHEMA_VERSION,
  addDays,
  type CollectionMap,
  type CollectionName,
  type DayKey,
  type Id,
  type IsoDateTime,
  type RecordMeta,
  type TimeZone,
} from '../../core';

export const DEMO_TIME_ZONE = 'Europe/Rome' as TimeZone;
export const DEMO_START_DAY = '2026-09-01' as DayKey;
export const DEMO_DAYS = 45;
export const DEMO_START_KG = 88.0;
export const DEMO_TARGET_KG = 80.0;

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export type DemoDataset = { [C in CollectionName]: CollectionMap[C][] };

export function createDemoDataset(seed = 70): DemoDataset {
  const rand = rng(seed);
  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` as Id;
  const stamp = (day: DayKey, time = '08:00'): IsoDateTime =>
    `${day}T${time}:00.000+02:00` as IsoDateTime;
  const meta = (day: DayKey, time?: string): RecordMeta => ({
    id: id(),
    schemaVersion: SCHEMA_VERSION,
    createdAt: stamp(day, time),
    updatedAt: stamp(day, time),
    source: { kind: 'demo', name: 'Dati di esempio' },
  });

  const out: DemoDataset = {
    weights: [],
    bodyComposition: [],
    meals: [],
    water: [],
    dayStatus: [],
    workouts: [],
    activity: [],
    goals: [],
    targets: [],
    imports: [],
  };

  out.goals.push({
    ...meta(DEMO_START_DAY),
    effectiveFrom: DEMO_START_DAY,
    direction: 'lose',
    startKg: DEMO_START_KG,
    startDay: DEMO_START_DAY,
    targetKg: DEMO_TARGET_KG,
    setBy: 'user',
  });
  out.targets.push({
    ...meta(DEMO_START_DAY),
    effectiveFrom: DEMO_START_DAY,
    kcal: 2200,
    kcalMin: 2100,
    kcalMax: 2300,
    proteinG: 140,
    waterMl: 2000,
    setBy: 'user',
  });

  for (let i = 0; i < DEMO_DAYS; i++) {
    const day = addDays(DEMO_START_DAY, i);
    // ~0.09 kg/day trend with ±0.6 kg daily noise; some days not weighed (gaps).
    const skipWeigh = rand() < 0.25;
    if (!skipWeigh) {
      const kg = r1(DEMO_START_KG - 0.09 * i + (rand() - 0.5) * 1.2);
      out.weights.push({
        ...meta(day, '07:30'),
        dayKey: day,
        timeZone: DEMO_TIME_ZONE,
        recordedAt: stamp(day, '07:30'),
        kg,
        quality: 'measured',
      });
    }
    // Nutrition logged on most days; a few days intentionally unlogged (not zero!).
    const logged = rand() > 0.15;
    out.dayStatus.push({
      ...meta(day),
      dayKey: day,
      nutrition: logged ? (rand() > 0.2 ? 'complete' : 'partial') : 'unlogged',
      water: logged ? 'complete' : 'unlogged',
    });
    if (logged) {
      const slots = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
      for (const slot of slots) {
        if (slot === 'snack' && rand() < 0.5) continue;
        const base = { breakfast: 450, lunch: 700, dinner: 750, snack: 200 }[slot];
        out.meals.push({
          ...meta(day, '12:00'),
          dayKey: day,
          timeZone: DEMO_TIME_ZONE,
          slot,
          name: `Pasto di esempio (${slot})`,
          kcal: Math.round(base * (0.85 + rand() * 0.3)),
          proteinG: Math.round((base / 20) * (0.8 + rand() * 0.4)),
          // carbs/fat sometimes unknown, to exercise "missing ≠ 0"
          ...(rand() > 0.2 ? { carbsG: Math.round(base / 9), fatG: Math.round(base / 30) } : {}),
          quality: 'estimated',
        });
      }
      out.water.push({
        ...meta(day, '18:00'),
        dayKey: day,
        timeZone: DEMO_TIME_ZONE,
        ml: 250 * Math.round(6 + rand() * 4),
      });
    }
    // Training plan example: Mon upper, Wed lower, Fri full body.
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    const plan = {
      1: ['upper', 'Upper body'],
      3: ['lower', 'Lower body'],
      5: ['full', 'Full body'],
    }[weekday] as [string, string] | undefined;
    if (plan) {
      const skipped = rand() < 0.12;
      out.workouts.push({
        ...meta(day, '19:00'),
        dayKey: day,
        timeZone: DEMO_TIME_ZONE,
        planDayKey: plan[0],
        title: plan[1],
        status: skipped ? 'skipped' : 'completed',
        ...(skipped ? {} : { durationMin: 80 + Math.round(rand() * 20) }),
        exercises: skipped
          ? []
          : [
              {
                exerciseKey: 'example-press',
                name: 'Esercizio di esempio',
                sets: [1, 2, 3].map(() => ({ reps: 8, loadKg: 40 + Math.floor(i / 7) * 2.5 })),
              },
            ],
        cardio: skipped
          ? []
          : [{ kind: 'treadmill', minutes: 20, distanceKm: 2.4, inclinePercent: 5 }],
      });
    }
    out.activity.push({
      ...meta(day, '23:00'),
      dayKey: day,
      steps: Math.round(5000 + rand() * 7000),
      source: { kind: 'demo', name: 'Dati di esempio' },
    });
  }
  return out;
}
