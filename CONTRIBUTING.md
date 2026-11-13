# Contributing to Ritmea

## Commands

```bash
npm install          # Node >= 20; .npmrc pins exact versions
npm run dev          # local dev server
npm run check        # typecheck + lint + format check + unit tests
npm run build        # production build into dist/ (not deployed)
npm run e2e          # Playwright smoke tests, iPhone 15 + 1440×900 Chromium profiles
```

In the Claude Code cloud container, Playwright needs `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`.

## Ownership (agreed in issue #1)

| Path                                                     | Owner         | Independent review / tests by                                                     |
| -------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------- |
| `src/core/**` (shared contracts)                         | Claude        | ChatGPT; changes need both                                                        |
| `src/data/**` (storage, migrations, backup)              | Claude        | ChatGPT (independent persistence/backup tests)                                    |
| `src/import/**` (Apple Health, CSV, dedupe)              | Claude        | ChatGPT (independent import tests)                                                |
| `src/calc/**` (trend, progress, ETA, energy)             | Claude        | ChatGPT (spec-first adversarial tests, written before reading the implementation) |
| `src/ui/**`, `src/i18n/**`, `src/pwa/**`                 | ChatGPT/Codex | Claude (data-correctness review, screenshots)                                     |
| `design/brand/**`                                        | Claude        | ChatGPT (visual QA)                                                               |
| `package.json` / lockfile, service-worker cache strategy | shared        | both                                                                              |

- Branches: `claude/*` and `codex/*`, with draft PRs. **No merge to `main` and no deploy without the owner's "Vai, pubblica".**
- Dependencies are added only in a PR that says why. Use exact versions published at least two weeks earlier.
- `AI_HANDOFF.md` is append-only, with one dated section per PR.

## Privacy (public repository)

No real health data, exports, screenshots of personal records, secrets or personal defaults, anywhere: code, fixtures, issues, PRs or logs. Use `src/data/fixtures/demo.ts` or new clearly synthetic fixtures. `tests/unit/privacy.test.ts` is a safety net, not a guarantee.
