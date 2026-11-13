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
