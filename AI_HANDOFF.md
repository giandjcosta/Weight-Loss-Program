# AI Handoff — public, non-sensitive only

## 2026-11-13 — Initial repository bootstrap (ChatGPT)

- Repo: `giandjcosta/Weight-Loss-Program` (PUBLIC).
- Main contains project README and collaboration instructions. A standalone static PWA prototype was created outside GitHub; it has NOT yet been imported, audited or deployed.
- Previous prototype capabilities reported: dated weight/food/water/workout entry, progress bar, configurable calorie and macro reference bars, starter food catalog, some local import/export and Open Food Facts lookup. All must be verified after import.
- No cloud authentication, direct Apple HealthKit access, Lifesum API integration or automatic server sync are known to work.
- Main risk: the previously generated prototype may contain hardcoded personal weight defaults and a personal localStorage key; sanitize before committing publicly.
- Next owner: Codex audits/imports **sanitized** frontend to `codex/frontend-bootstrap` and opens PR. Claude Code independently reviews architecture/HealthKit feasibility using `claude/*` and files a separate PR or review.
- No merge, deploy or repository permission changes without explicit owner approval.
- Never add private user data, medical notes, real logs, secrets or screenshots of personal records here.

## PR handoff template

- Branch / PR:
- Goal and changed paths:
- Tests and screenshots:
- Data access/security impact:
- Known limitations:
- Next owner / blockers:

## 2026-11-13 — Foundation PR (Claude Code)
- Branch / PR: `claude/foundation` → draft PR (see issue #3). Brand assets are separate in PR #5.
- Goal: shared contracts and tooling only, so UI (ChatGPT) and data/import/calc (Claude) can proceed in parallel.
- Changed paths:
  - tooling: `package.json`, `.npmrc`, `tsconfig.json`, `vite.config.ts`, `playwright.config.ts`, `eslint.config.js`, Prettier config;
  - code: `src/core/**`, `src/data/memoryRepository.ts`, `src/data/repositoryContract.ts`, `src/data/fixtures/demo.ts`, placeholder `src/main.tsx` + `index.html`, module READMEs;
  - tests: `tests/unit/privacy.test.ts`, `tests/e2e/smoke.spec.ts`;
  - docs: `docs/DATA_MODEL.md`, `CONTRIBUTING.md`.
- Tests: `npm run check` (typecheck, lint, format, 30 unit tests) and `npm run e2e` (iPhone 15 + desktop Chromium profiles).
- Data/security impact: no real data, no network calls, no storage yet (memory only). Demo data is seeded, fictional and labelled `source.kind = 'demo'`.
- Known limitations:
  - no IndexedDB, imports, calc or real UI yet;
  - `.npmrc` sets `legacy-peer-deps` to work around an npm 10 resolver crash with vitest 4;
  - moderate dev-only audit finding (minimatch via eslint tooling), with no fix available without downgrading.
- Next owner:
  - ChatGPT reviews the foundation PR, then starts `codex/ui-shell` on top of it;
  - Claude continues with `claude/data-layer` (IndexedDB, migrations, backup/restore), then `claude/calc`.
- 2026-11-13 update after ChatGPT review of PR #7:
  - goals/targets are append-only, enforced in the repo, with `entryInEffect`;
  - full persistence-boundary validation (`core/validation.ts`);
  - impossible ISO instants are rejected;
  - `customProgressColors` added; `units` deep-merged;
  - `saveSettings`/`saveProfile` now return `Result`;
  - meal `portion` and `nutritionSource` added; `FoodItem` type planned;
  - memory repo rebuilt on a shared `createRepository` + `StorageBackend`, with `putMany` and `bulk` events, so IndexedDB reuses the same rules.

## 2026-11-13 — Data layer PR (Claude Code)
- Branch / PR: `claude/data-layer`, stacked on `claude/foundation` (draft PR, base `claude/foundation`).
- Changed paths:
  - `src/data/indexedDb/**` (schema + migrations + snapshots, backend, repository);
  - `src/data/backup.ts`, `src/data/persistence.ts`;
  - tests in `src/data/**`, `tests/e2e/storage.spec.ts` + `tests/e2e/harness/` (test-only page served by the Vite dev server, not part of the build);
  - `playwright.config.ts` (adds a `storage` project), `.gitignore`;
  - dev dependency `fake-indexeddb` 6.2.6.
- Tests:
  - `npm run check`: 81 unit tests, including the repository contract on both memory and IndexedDB, v1→v2 migration + snapshot, aborted upgrade, backup round trip, merge, rollback and parse safety;
  - `npm run e2e`: 4 tests, including reload persistence and backup → wipe → restore in real Chromium IndexedDB.
- Data/security impact: data stays in the browser on this device; nothing is sent anywhere. Backups are user-downloaded files.
- Known limitations:
  - no UI yet for backup or persistence prompts (ChatGPT, `src/ui`);
  - photos are not in the backup yet (no photo store yet);
  - iOS Safari behaviour needs owner device testing.
- Next owner: ChatGPT reviews and writes independent persistence/backup tests. Claude continues with `claude/calc`.
- 2026-11-13 update after ChatGPT review of PR #8:
  - backups are parsed strictly (all collection keys, versions, `exportedAt`, settings and profile, duplicate ids);
  - restore replace/merge is atomic through `Repository.commitBatch` → a single IndexedDB transaction (rollback code removed);
  - migration snapshots include `meta`;
  - merge compares instants, not strings;
  - 106 unit tests and 4 e2e tests.
