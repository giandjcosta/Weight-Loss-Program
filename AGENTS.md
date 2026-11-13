# Road to 70 — Shared AI working contract

## Privacy first
This repository is PUBLIC. Never commit real health data, medications, personal documents, real tracking histories or identifying screenshots, even in test fixtures or GitHub issues. Use synthetic demos. No secrets or private API credentials in client code, PR bodies or logs.

## Scope
This repository only. Do not touch unrelated GitHub repositories or existing databases. Never deploy, merge, change access permissions or enable third-party integrations without the user's explicit approval (specifically “Vai, pubblica”).

## Development flow
- Read README.md and AI_HANDOFF.md before starting.
- Work on a dedicated branch named `codex/<short-topic>` or `claude/<short-topic>`.
- One narrow task per PR; provide implementation notes, tests, screenshots for iPhone and desktop and remaining risks.
- Do not overwrite another agent's files without coordinating via issue/PR and AI_HANDOFF.md.
- Keep the prototype's actual feature status honest. Static websites do not read HealthKit directly.
- Prefer accessibility, date/time correctness, data provenance and error handling over cosmetic redesign.
- If a source bundle is not in this repo, explicitly ask for it to be supplied to that tool; never invent files.
- After each PR, update AI_HANDOFF.md with branch, files changed, test commands, known issues and next owner.

## Fitness/nutrition logic
- Never interpret missing logs as zero intake; use completeness flags.
- Weight trend is not a diagnosis; individual readings fluctuate.
- Distinguish nutrition estimates from verified labeled values.
- Display user-defined goals and configurable alerts without shame or punitive UI.
- Avoid medical diagnosis, automated medication changes or guaranteed outcomes.
