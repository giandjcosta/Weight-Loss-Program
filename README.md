# Weight Loss Program — Road to 70

A personal, mobile-first **weight, nutrition, hydration and training tracker**. The goal is to make long-term progress clear without overreacting to individual weigh-ins or treating food choices as moral judgments.

> **Status: planning / repository bootstrap.** A standalone prototype exists outside this repository, but it is not deployed or synchronized here yet. Do not claim that Apple Health, Lifesum, cloud sync or production authentication are already connected.

## Product scope

- **Weight timeline:** dated weigh-ins, editable start and target, progress bar, 7-day rolling trend and weekly summaries. Distinguish actual readings from estimates and missing data.
- **Nutrition diary:** dated meals; calories, protein, fat, carbohydrate, customizable targets, portion sizes and daily/weekly views. Going above a daily calorie reference turns the indicator red but is not an error.
- **Hydration:** quantity and date/time, configurable target.
- **Food catalog:** international dishes, fast food and packaged products. Prefer official restaurant nutrition information when available; use Open Food Facts for packaged foods; clearly label *source, country, portion basis, units, timestamp and estimate vs verified*. Never invent nutrition facts.
- **Training:** three sessions (Upper / Lower / Full Body) plus an optional session, editable exercises, sets, reps and treadmill time. Log completed workouts separately from planned workouts.
- **Imports and integrations:** manual entry and user-controlled CSV/JSON/Apple Health exports first; later explore an authorized native iOS HealthKit bridge. Lifesum may export nutrition to Apple Health, subject to user permissions. A static website **cannot directly read HealthKit**.
- **Accessibility:** phone-first layouts, keyboard controls, readable contrast and installable PWA once tested.

## Architecture roadmap

1. **M0 — Safe frontend preview:** review and sanitize the existing local prototype before adding it to the public repository; run local tests and mobile/desktop previews.
2. **M1 — Solid local data:** typed schemas, migrations, input validation, import/export, deduplication, timezone Europe/Amsterdam, data-quality labels, trend calculations and automated tests.
3. **M2 — Optional private sync:** separate authenticated backend, per-user access controls, backups, deletion and privacy review. All actual personal data stays outside this public Git repository.
4. **M3 — Apple Health bridge:** research HealthKit entitlement, authorization, iOS background limitations, sync provenance, idempotency and consent; implement only after feasibility testing.
5. **M4 — Food sources:** barcode/keyword searches, restaurant-specific official sources, reliable portion conversions and source attribution.
6. **M5 — Responsible insights:** trends and weekly averages; do not infer unlogged meals as zero, claim exact body-fat percentages from photos or automatically prescribe a medical diet.

## Privacy and data handling

**This repository is public. Code is public; the user's health data is not.**

Never commit real weigh-ins, nutrition or medical records, prescriptions, app exports, private briefs, screenshots containing personal information, access tokens, passwords, database connection strings or secret keys. Do not include real user health data in GitHub issues, commit messages, PR descriptions, logs, fixtures, screenshots or AI handoffs.

Use anonymized synthetic demo data in the frontend. A private database, if added, must have authentication, row-level authorization with negative cross-user tests, data deletion/export, least-privilege credentials and a clear consent flow. Never reuse unrelated databases, especially any connected to other projects.

For prototype-only local storage, explicitly explain that data is device/browser-specific and may be lost. Do not imply that localStorage is encrypted cloud storage.

## Working with Codex and Claude Code

Use **one repository, separate branches and pull requests**, and the shared non-sensitive [AI handoff](AI_HANDOFF.md). Codex focuses on frontend integration and quality gates; Claude Code audits the architecture and prototypes one isolated integration. Neither agent merges or deploys without the owner's explicit **“Vai, pubblica”** approval.

- [Codex task brief](docs/PROMPT_CODEX.md)
- [Claude Code task brief](docs/PROMPT_CLAUDE_CODE.md)
- [Working rules for agents](AGENTS.md)
- [Claude-specific guidance](CLAUDE.md)

## Current status / development

The repository currently starts from a README and collaboration docs. The existing prototype ZIP and any user data are **not automatically in this repository**. Only import frontend source after reviewing it for hardcoded personal information; use sample data that does not belong to a real person.

Do not enable a public deployment before reviewing the initial PR and confirming security expectations.

### Useful official docs

- [Lifesum → Apple Health syncing](https://help.lifesum.com/en/article/how-to-connect-to-and-sync-with-apple-health-ios-eagtau/)
- [Apple HealthKit](https://developer.apple.com/documentation/healthkit/)
- [Open Food Facts](https://world.openfoodfacts.org/)

## Development (Ritmea)

The app is being rebuilt as **Ritmea** (Vite + TypeScript + Preact). The foundation PR contains shared contracts and tooling only. See [CONTRIBUTING.md](CONTRIBUTING.md) for commands and module ownership, and [docs/DATA_MODEL.md](docs/DATA_MODEL.md) for the data rules.
