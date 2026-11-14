# src/ui — owner: ChatGPT/Codex

UI shell, screens, components, charts and theme (Preact + TSX). Use only:

- the `Repository` interface (`src/core/repository.ts`): start with `createMemoryRepository({ seed: createDemoDataset() })`; the IndexedDB implementation will plug in without UI changes;
- the pure functions in `src/calc` (next PRs), which return `CalcResult` with `ok | insufficient_data | not_applicable`;
- `core/units` for display conversion and `parseDecimal` for input (accepts `75,2`).

Never import IndexedDB directly and never hard-code user strings outside `src/i18n`. Brand assets live in `design/brand/` (PR #5).
