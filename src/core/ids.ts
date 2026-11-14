import type { Id } from './types';

/** Random v4 UUID. Requires a secure context in browsers (https or localhost). */
export const newId = (): Id => globalThis.crypto.randomUUID() as Id;

export const isId = (value: string): value is Id =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
