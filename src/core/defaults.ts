import { SCHEMA_VERSION, type IsoDateTime, type Profile, type Settings } from './types';

export const APP_NAME = 'Ritmea';

/** Neutral defaults: no personal values, no targets. Goals/targets start empty. */
export function defaultSettings(now: IsoDateTime): Settings {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: now,
    locale: 'it',
    units: { weight: 'kg', length: 'cm', volume: 'ml', distance: 'km', energy: 'kcal' },
    theme: 'dark',
    progressPalette: 'neutral',
    appIcon: 'primary',
  };
}

export function defaultProfile(now: IsoDateTime): Profile {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: now,
    heightCm: undefined,
    birthYear: undefined,
    sex: undefined,
    activityLevel: undefined,
  };
}
