import type {
  DayKey, DayLogStatus, GoalEntry, MealEntry, Profile, Repository, Settings,
  TargetsEntry, WaterEntry, WeightEntry, WorkoutSession,
} from '../core';
import { entryInEffect } from '../core/history';

export interface UiSnapshot {
  weights: WeightEntry[];
  meals: MealEntry[];
  water: WaterEntry[];
  workouts: WorkoutSession[];
  dayStatus: DayLogStatus[];
  goals: GoalEntry[];
  targets: TargetsEntry[];
  settings: Settings;
  profile: Profile;
}

export async function readSnapshot(repo: Repository): Promise<UiSnapshot> {
  const [weights, meals, water, workouts, dayStatus, goals, targets, settings, profile] =
    await Promise.all([
      repo.list('weights'), repo.list('meals'), repo.list('water'),
      repo.list('workouts'), repo.list('dayStatus'), repo.list('goals'),
      repo.list('targets'), repo.getSettings(), repo.getProfile(),
    ]);
  return { weights, meals, water, workouts, dayStatus, goals, targets, settings, profile };
}

export function latestOnOrBefore<T extends { dayKey: DayKey }>(items: readonly T[], day: DayKey): T | undefined {
  return [...items].filter(item => item.dayKey <= day).at(-1);
}

export interface DayView {
  meals: MealEntry[];
  water: WaterEntry[];
  workouts: WorkoutSession[];
  status: DayLogStatus | undefined;
  mealKcal: number | undefined;
  waterMl: number | undefined;
  waterTarget: number | undefined;
  goal: GoalEntry | undefined;
  lastWeight: WeightEntry | undefined;
  latestWeight: WeightEntry | undefined;
  progressPercent: number | undefined;
}

export function deriveDay(snapshot: UiSnapshot, day: DayKey): DayView {
  const meals = snapshot.meals.filter(m => m.dayKey === day);
  const water = snapshot.water.filter(w => w.dayKey === day);
  const workouts = snapshot.workouts.filter(w => w.dayKey === day);
  const status = snapshot.dayStatus.filter(s => s.dayKey === day).at(-1);
  const goal = entryInEffect(snapshot.goals, day);
  const target = entryInEffect(snapshot.targets, day);
  const lastWeight = latestOnOrBefore(snapshot.weights, day);
  const latestWeight = snapshot.weights.at(-1);
  const knownKcal = meals.filter(m => m.kcal !== undefined);
  const mealKcal = knownKcal.length > 0 ? knownKcal.reduce((sum, m) => sum + (m.kcal ?? 0), 0) : undefined;
  const waterMl = water.length > 0 ? water.reduce((sum, w) => sum + w.ml, 0) : undefined;
  let progressPercent: number | undefined;
  if (goal?.startKg !== undefined && goal.targetKg !== undefined && lastWeight) {
    const span = Math.abs(goal.startKg - goal.targetKg);
    if (span > 0 && (goal.direction === 'lose' || goal.direction === 'gain')) {
      const moved = goal.direction === 'lose' ? goal.startKg - lastWeight.kg : lastWeight.kg - goal.startKg;
      progressPercent = Math.min(100, Math.max(0, 100 * moved / span));
    }
  }
  return { meals, water, workouts, status, mealKcal, waterMl, waterTarget: target?.waterMl,
    goal, lastWeight, latestWeight, progressPercent };
}

export function formatValue(value: number | undefined, digits = 1, locale = 'it-IT'): string {
  return value === undefined ? '—' : new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
}

export function formatDay(day: DayKey, locale = 'it-IT'): string {
  const [y, m, d] = day.split('-').map(Number) as [number,number,number];
  return new Intl.DateTimeFormat(locale, { day:'numeric', month:'long', year:'numeric', timeZone:'UTC' })
    .format(new Date(Date.UTC(y,m-1,d)));
}

export function statusDescription(status: DayLogStatus | undefined, field: 'nutrition' | 'water'): string {
  const code = status?.[field] ?? 'unknown';
  return ({ unknown:'Stato non indicato', unlogged:'Giornata non registrata',
    partial:'Registrazione parziale', complete:'Registrazione completa' })[code];
}
