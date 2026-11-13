/**
 * Typed message codes. Non-UI modules return codes + args; only `src/i18n` turns them into text.
 * Adding a code here makes a missing translation a compile error in the i18n tables.
 */
export interface MessageArgs {
  // validation
  'validation.required': { field: string };
  'validation.not_a_number': { field: string; input: string };
  'validation.out_of_range': { field: string; min: number; max: number; unit: string };
  'validation.invalid_date': { input: string };
  'validation.future_date': { field: string };
  // repository
  'repo.not_found': { collection: string; id: string };
  'repo.storage_unavailable': Record<string, never>;
  'repo.quota_exceeded': Record<string, never>;
  // imports
  'import.unsupported_format': { fileName: string };
  'import.malformed': { line?: number };
  'import.duplicates_skipped': { count: number };
  'import.invalid_skipped': { count: number };
  // calculations
  'calc.not_enough_readings': { have: number; need: number };
  'calc.span_too_short': { haveDays: number; needDays: number };
  'calc.goal_missing': Record<string, never>;
  'calc.inputs_missing': { fields: string[] };
  'calc.not_applicable_for_direction': { direction: string };
}

export type MessageCode = keyof MessageArgs;

export type Message = {
  [C in MessageCode]: { code: C; args: MessageArgs[C] };
}[MessageCode];

export const msg = <C extends MessageCode>(code: C, args: MessageArgs[C]): Message =>
  ({ code, args }) as Message;
