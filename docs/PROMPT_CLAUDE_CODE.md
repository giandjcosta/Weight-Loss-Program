# Claude Code — Independent architecture, privacy and Apple Health feasibility PR

Repository: `giandjcosta/Weight-Loss-Program` (PUBLIC).

## Goal and division of labor
Act as an independent technical reviewer / iOS integration architect, not a second frontend implementer. Codex owns the first frontend-bootstrap PR. You work on `claude/integration-feasibility`, propose a tested integration path and review Codex's PR. No edits to main, no merge, no deploy, no public release without the owner saying `Vai, pubblica`.

## Must verify
1. Read README.md, AGENTS.md, CLAUDE.md and AI_HANDOFF.md. Inspect current branch and PRs before modifying anything. The prototype ZIPs may not be in the repository; request them if needed rather than inventing code.
2. Research a realistic Lifesum -> Apple Health -> Road to 70 flow. Lifesum says it may export food calories, nutrients, weight, water to Apple Health when permissions are enabled. Validate exact data types and possible historical-data quirks against official support docs.
3. HealthKit is native Apple technology requiring permission; a static PWA cannot directly query it. Compare (a) manual Health export import, (b) iOS Shortcuts/Automation when feasible, (c) a minimal Swift/HealthKit companion app, and (d) vetted intermediary services. State background limits, setup burden and recurring cost.
4. Propose a secure **separate** private data store and API. Include Auth, per-user row rules and negative cross-user tests; device/user/source IDs, ISO timestamps, Europe/Amsterdam-local display dates, idempotency / sample dedupe, audit of units and provenance, revoke/delete/export, no unreviewed sensitive health fields.
5. Draft canonical schema for `weights`, `nutrition_daily`, `nutrition_entries`, `hydration`, `workouts`, `imports` and `data_sources`. Plan migrations, reconciliation of duplicate Apple Health/Lifesum sources, missing-day completeness, and distinguishing recorded data from verified facts and estimates.
6. Keep security expectations tight: never log health payloads, auth tokens or user medical details in PR, issues, public tests or screenshots. Avoid any proprietary/private Lifesum endpoints and don't scrape authenticated sessions or bypass permissions.
7. Data source research: Open Food Facts (packaged foods), official local fast food nutrition calculators, generic foods with explicit estimate provenance; include uncertainty and country/portion handling.
8. Audit the existing prototype and Codex PR for PWA correctness, offline behavior, vulnerability/privacy flaws, accessible mobile UI and misleading status claims.

## Scope of first PR
Prefer DOCUMENTATION + SMALL SELF-CONTAINED PROTOTYPE ONLY:
- `docs/INTEGRATION_ARCHITECTURE.md` with verified feasibility and risks.
- `docs/DATA_MODEL.md` with schema, mappings, privacy/security controls and test plan.
- Optional synthetic-only import parser/unit tests in an isolated module, if coherent with project structure.
- Update `AI_HANDOFF.md` with work completed and explicit next owner.

Do NOT configure production credentials, deploy infrastructure, or invent an automated sync demo. Make the next three independent PRs and acceptance criteria clear.
Open ONE PR from `claude/integration-feasibility` and stop.

## Collaboration protocol
You cannot directly communicate with ChatGPT/Codex via conversation. Shared ground truth is the repo, PR/issue comments and `AI_HANDOFF.md`. Request a Codex review through the PR if useful. If asked which tasks you do better, honestly identify your available strengths/tool limitations; do not claim superior performance without a concrete comparison.

### Official references
- Lifesum: https://help.lifesum.com/en/article/how-to-connect-to-and-sync-with-apple-health-ios-eagtau/
- Apple HealthKit: https://developer.apple.com/documentation/healthkit/
