# Codex — First implementation PR: sanitized Road to 70 frontend

Repository: `giandjcosta/Weight-Loss-Program` (PUBLIC).

## Goal
Build a usable, mobile-first preview of the Road to 70 PWA from the previously created prototype, keeping all actual user health data PRIVATE. Work on branch `codex/frontend-bootstrap`, open a PR, and STOP. The user must explicitly say `Vai, pubblica` before any merge or deployment.

## Context
Road to 70 is a personal progress tracker for weight, food/macros, water and training. The previous `road-to-70-sito.zip` contains a more fully featured local prototype: check-ins with date, trend, progress to a configurable weight goal, calorie/macro/hydration indicators, a starter food catalog, Open Food Facts search, workout schedule, CSV/JSON/Apple Health XML imports, and PWA assets. The separate `Road_to_70_GitHub_Starter.zip` is an **experimental alternative** including cloud code, and must NOT be represented as functioning or deployed. Both ZIP files live outside this public repository; if unavailable in the Codex environment, ask the user to attach the files. Do not pretend they are checked in.

## Requirements
1. Inspect the repo, README, AGENTS.md and AI_HANDOFF.md first. Inspect the provided ZIP in a local working directory if present.
2. Audit every public asset for real identifiers, measurements, dates, medications, personal tags, raw backups, localStorage keys that embed identity, hard-coded private defaults, hidden data in metadata, and secret keys. **Do not commit or put them in PR text**. Replace with generic synthetic demo data that is clearly labelled fake; default to empty state.
3. Preserve the prototype's features and responsive design wherever sound. Refactor only enough to make it maintainable and testable; prefer a straightforward stack over unnecessary framework changes.
4. Dated entries: locally selected day in Europe/Amsterdam; keep timestamp and source; missing/partial days are not zero-intake days. Weight trend using 7-day rolling available readings; show both actual and smoothed data.
5. Macro targets: editable, labels in kcal/g/ml; red above calorie upper reference only, not judgement; do not add burned calories to a food budget automatically without a user option. Accuracy controls for duplicates.
6. Food catalog: per 100g/portion conversions, explicit source and verified-vs-estimated flag; official fast-food nutrition links country-specific. Never invent brand/product nutrition values.
7. Mobile Safari, desktop and keyboard accessibility; manifest, icons and service worker only if correct for the eventual subpath `/Weight-Loss-Program/`.
8. Local import/export should handle invalid data safely and never send user-provided health exports to an external endpoint. Test malformed CSV, duplicate dates, out-of-range entries and XML import only with synthetic fixtures.
9. Add a test command and run it. Show desktop and iPhone viewport screenshots generated from **synthetic demo data**. Document exactly what is and is not implemented.
10. Do NOT create or modify Supabase projects, private infrastructure, GitHub Pages settings, external accounts or unrelated repos. Do not merge, deploy or change main.

## Output / acceptance
Open ONE PR from `codex/frontend-bootstrap` into main. PR should include a tested frontend, README run instructions, screenshots with fictional values, test results, residual security risks and a concise update to `AI_HANDOFF.md`.
If blocked by missing ZIP, create an issue or draft plan explaining the exact source artifact needed, and do not fabricate a working integration.
