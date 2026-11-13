import type { DayKey, IsoDateTime, TimeZone } from './types';

const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/** The device's IANA time zone (falls back to UTC if the runtime does not expose one). */
export function deviceTimeZone(): TimeZone {
  return (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC') as TimeZone;
}

export function isTimeZone(value: string): value is TimeZone {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Validate and brand a `YYYY-MM-DD` string (rejects impossible dates like 2026-02-30). */
export function parseDayKey(value: string): DayKey | undefined {
  const m = DAY_KEY_RE.exec(value);
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  const valid =
    date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
  return valid ? (value as DayKey) : undefined;
}

function parts(instant: Date, timeZone: TimeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const { type, value } of fmt.formatToParts(instant)) p[type] = value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

/** Local calendar day of `instant` in `timeZone`. */
export function dayKeyOf(instant: Date, timeZone: TimeZone): DayKey {
  const p = parts(instant, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}` as DayKey;
}

/** Offset of `timeZone` from UTC at `instant`, in minutes (e.g. +60 for Europe/Rome in winter). */
export function offsetMinutes(instant: Date, timeZone: TimeZone): number {
  const p = parts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const truncated = Math.floor(instant.getTime() / 1000) * 1000;
  return Math.round((asUtc - truncated) / 60_000);
}

/** ISO 8601 string with the local offset of `timeZone`, e.g. `2026-11-13T08:30:00.000+01:00`. */
export function toIsoWithOffset(instant: Date, timeZone: TimeZone): IsoDateTime {
  const off = offsetMinutes(instant, timeZone);
  const local = new Date(instant.getTime() + off * 60_000);
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${local.toISOString().slice(0, 23)}${sign}${hh}:${mm}` as IsoDateTime;
}

/** Validate and brand an ISO 8601 instant that carries an explicit offset or `Z`. */
export function parseIsoDateTime(value: string): IsoDateTime | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return undefined;
  }
  return Number.isNaN(Date.parse(value)) ? undefined : (value as IsoDateTime);
}

export function nowIso(timeZone: TimeZone = deviceTimeZone(), now: Date = new Date()): IsoDateTime {
  return toIsoWithOffset(now, timeZone);
}

export function todayKey(timeZone: TimeZone = deviceTimeZone(), now: Date = new Date()): DayKey {
  return dayKeyOf(now, timeZone);
}

const toUtcMs = (key: DayKey): number => {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
};

/** Calendar arithmetic on day keys; independent of time zones and DST. */
export function addDays(key: DayKey, days: number): DayKey {
  return new Date(toUtcMs(key) + days * MS_PER_DAY).toISOString().slice(0, 10) as DayKey;
}

/** Whole calendar days from `a` to `b` (positive if `b` is later). */
export function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / MS_PER_DAY);
}

/** Inclusive list of day keys from `from` to `to`. Empty if `to` is before `from`. */
export function dayRange(from: DayKey, to: DayKey): DayKey[] {
  const n = daysBetween(from, to);
  return Array.from({ length: Math.max(0, n + 1) }, (_, i) => addDays(from, i));
}

/** ISO weekday 1 = Monday … 7 = Sunday. */
export function isoWeekday(key: DayKey): number {
  const d = new Date(toUtcMs(key)).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Monday of the week containing `key`. */
export const weekStart = (key: DayKey): DayKey => addDays(key, 1 - isoWeekday(key));

export const compareDayKeys = (a: DayKey, b: DayKey): number => (a < b ? -1 : a > b ? 1 : 0);
