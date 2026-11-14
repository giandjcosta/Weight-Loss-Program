import type { Message } from './messages';

/** Result of an operation that can fail with a user-presentable message. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: Message };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = <T = never>(error: Message): Result<T> => ({ ok: false, error });

/**
 * Result of a calculation (src/calc). The UI must render every variant;
 * nothing falls back to 0.
 */
export type CalcResult<T> =
  | { status: 'ok'; value: T; quality: 'measured' | 'estimated' | 'mixed' }
  | {
      status: 'insufficient_data';
      reason: Message;
      /** What would make the result available, e.g. { readings: 4, spanDays: 21 }. */
      needed?: Record<string, number>;
    }
  | { status: 'not_applicable'; reason: Message };
