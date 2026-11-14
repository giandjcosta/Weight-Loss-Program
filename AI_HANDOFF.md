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

## 2026-11-14 — ChatGPT UI Alpha 0.1 Shell (draft)

- Branch: `codex/ui-alpha-shell`, created from **exact foundation SHA** `a30d4dfee05aa6c1a44101673d5e85b449c0f19b`. Target PR base: `claude/foundation` (stacked; NO main merge).
- Goal: replace the foundation placeholder with a responsive, real Preact UI powered by the shared `Repository` interface.
- Paths: `src/ui/App.tsx`, `src/ui/model.ts`, `src/ui/model.test.ts`, `src/ui/styles.css`, brand wordmark assets, `src/ui/README.md`, `src/main.tsx`, `index.html`, `public/favicon.svg`, `tests/e2e/smoke.spec.ts`.
- Features: desktop sidebar/mobile bottom nav, selected demo date, weight chart, add/edit/delete weights/meals/workouts, water quick-add/delete, nutrition completeness, historical goals, theme/profile/icon preference, handling of missing values, visible modal errors and explicit no-ETA placeholder.
- Data/security: `createMemoryRepository({seed:createDemoDataset()})` **only**. All fixture data is fictional; writes are ephemeral and discarded on reload. `Repository.storage.synced=false`; no real-device persistent data, no HealthKit, no analytics, no remote API, no service-worker deployment.
- Local checks: checked JSX/TS syntax on an earlier scratch UI prototype; this committed UI has **NOT** been independently compiled or browser-tested in this environment because repository dependencies cannot be downloaded here. Tests exist but **NOT RUN**. Claude must run `npm run check` (including Prettier formatting) / `npm run build` / `npm run e2e`, resolve TS/lint issues and review functionality before sign-off. Record real results, not inferred passing checks.
- QA to complete: 320px / 360px / 390px / 1440px responsive screenshots, mobile keyboard / safe-area / touch, modal keyboard focus management, locale display, registration and reset, no console errors or horizontal overflow.
- Deferred: integrate `claude/data-layer` **only when PR #8 safety blocker is closed**; first real-data mode requires reviewed backup/restore and an explicit opt-in. Make installable PWA manifest/SW in a separate reviewed PR; no auto-sync or unsupported HealthKit claims.
- Next owner: Claude performs independent source review + compilation/tests + formatting; ChatGPT addresses findings in this branch. Owner controls any preview release.
- **No merge or deploy of any kind until owner explicitly authorizes the specific operation with «Vai, pubblica».**
