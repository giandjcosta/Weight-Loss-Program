# Road to 70 — Shared AI working contract

## Privacy first
This repository is PUBLIC. Never commit real health data, medications, personal documents, real tracking histories or identifying screenshots, even in test fixtures or GitHub issues. Use synthetic demos. No secrets or private API credentials in client code, PR bodies or logs.

## Scope
This repository only. Do not touch unrelated GitHub repositories or existing databases. Never deploy, merge, change access permissions or enable third-party integrations without the user's explicit approval (specifically “Vai, pubblica”).

## Development flow
- Read README.md and AI_HANDOFF.md before starting.
- Work on a dedicated branch named `codex/<short-topic>` or `claude/<short-topic>`. External contributors may use `grok/<short-topic>` or `perplexity/<short-topic>` only for explicitly scoped tasks and only if they actually have authorized GitHub write access.
- One narrow task per PR; provide implementation notes, tests, screenshots for iPhone and desktop and remaining risks.
- Do not overwrite another agent's files without coordinating via issue/PR and AI_HANDOFF.md.
- Keep the prototype's actual feature status honest. Static websites do not read HealthKit directly.
- Prefer accessibility, date/time correctness, data provenance and error handling over cosmetic redesign.
- If a source bundle is not in this repo, explicitly ask for it to be supplied to that tool; never invent files.
- After each PR, update AI_HANDOFF.md with branch, files changed, test commands, known issues and next owner.

## Mandatory independent review and release gates
- **Every nontrivial PR requires an independent review** by an agent other than its author. Prefer ChatGPT reviewing Claude's backend/data/calc work, and Claude reviewing ChatGPT's UI/PWA work. Grok/Perplexity are supplemental contributors, not substitutes for independent owner/maintainer review.
- Review covers scope, privacy, accessibility as applicable, data correctness, security, and regression risk. The author must respond to substantive review comments and rerun affected tests. No "looks good" approval without examining the diff and evidence.
- At minimum, record executed commands and outcomes (`npm run check`, `npm run build`, and `npm run e2e` for UI/platform changes where runnable); mark unavailable tests as **not run**, never as passed. A functioning screenshot is not proof of functional correctness; simulated mobile Chromium is not a real iPhone Safari test.
- **No merge into `main`, deployment of any kind (including unlisted HTTPS preview, GitHub Pages, Netlify, app store publishing), production data migration or external integration unless all of the following are true:** (1) independent review completed and critical findings addressed, (2) appropriate automated tests pass or any missing coverage is explicitly documented and accepted by the owner, (3) privacy/security and target-device acceptance checks are recorded, and (4) the owner explicitly authorizes the specific operation with **«Vai, pubblica»**. Development/branch/PR permission does not imply release permission.
- Work may be presented in draft feature PRs without merging. If a test or review is blocked, stop at the draft PR, document the blocker, and do not deploy.
- External contributors get narrow write scopes: Grok may add independent tests only in its assigned test file(s); Perplexity may contribute a cited research document only. Neither may silently edit shared contracts, application code, main, repository settings, integrations, or deployments. If a contributor lacks tool access, they should supply review text or a patch; never imply a branch/PR was created.
- The repository is PUBLIC: use exclusively synthetic fixture data and anonymized screenshots. No health exports or actual personal records in code, issues, comments, previews or public logs.

## Fitness/nutrition logic
- Never interpret missing logs as zero intake; use completeness flags.
- Weight trend is not a diagnosis; individual readings fluctuate.
- Distinguish nutrition estimates from verified labeled values.
- Display user-defined goals and configurable alerts without shame or punitive UI.
- Avoid medical diagnosis, automated medication changes or guaranteed outcomes.
