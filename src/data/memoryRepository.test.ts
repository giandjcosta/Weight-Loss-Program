import { describe, expect, it } from 'vitest';
import { createMemoryRepository } from './memoryRepository';
import { runRepositoryContract } from './repositoryContract';
import { createDemoDataset, DEMO_DAYS } from './fixtures/demo';

runRepositoryContract('memory', () => createMemoryRepository());

describe('memory repository with the synthetic demo dataset', () => {
  it('loads every demo record and marks it as demo data', async () => {
    const data = createDemoDataset();
    const repo = createMemoryRepository({ seed: data });
    const weights = await repo.list('weights');
    expect(weights.length).toBe(data.weights.length);
    expect(weights.length).toBeGreaterThan(DEMO_DAYS / 2);
    expect(weights.length).toBeLessThan(DEMO_DAYS); // gaps exist on purpose
    for (const w of weights) expect(w.source.kind).toBe('demo');
  });

  it('is deterministic for a given seed', () => {
    expect(createDemoDataset(1)).toEqual(createDemoDataset(1));
    expect(createDemoDataset(1)).not.toEqual(createDemoDataset(2));
  });

  it('contains unlogged days without zero-calorie meals', () => {
    const data = createDemoDataset();
    const unlogged = new Set(
      data.dayStatus.filter((d) => d.nutrition === 'unlogged').map((d) => d.dayKey),
    );
    expect(unlogged.size).toBeGreaterThan(0);
    expect(data.meals.some((m) => unlogged.has(m.dayKey))).toBe(false);
    expect(data.meals.some((m) => m.kcal === 0)).toBe(false);
    expect(data.meals.some((m) => m.carbsG === undefined)).toBe(true);
  });
});
