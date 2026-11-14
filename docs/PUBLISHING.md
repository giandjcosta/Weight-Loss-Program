# Publishing Ritmea Alpha 0.1 (GitHub Pages) — prepared, NOT enabled

Nothing here deploys by itself. Publishing requires the owner's explicit «Vai, pubblica»; the manual workflow also checks the authenticated GitHub actor is `giandjcosta`. Owner approval must follow code review and passing checks.

## What is prepared

- `vite.config.ts` → `base: '/Weight-Loss-Program/'` (the Pages project subpath).
- `.github/workflows/pages-alpha.yml` → **manual-only** (`workflow_dispatch`), runs only on `main`, only if the confirmation input is exactly `Vai, pubblica`; it re-runs `npm run check` and `npm run build`, then deploys `dist/`.
- `public/manifest.webmanifest` + `public/icons/*` (from `design/brand/png`, PR #5) and `apple-touch-icon` / manifest links in `index.html`, so the site can be added to the Home Screen on iPhone (Safari → Share → "Aggiungi alla schermata Home") and installed on Android (Chrome → "Installa app").
- `<meta name="robots" content="noindex,nofollow">` keeps the alpha out of search engines (the URL is still public).

## Owner steps (only after «Vai, pubblica»)

1. Merge the reviewed Alpha demo stack to `main` in order: #9 (policy), #4/#5 (docs/brand), #7 (foundation), #10 (UI), #11 (Claude fixes + Pages workflow), #12 (accessibility and typography). **Do not merge #8 for this synthetic-memory demo**: IndexedDB/real-data restore is a separate safety review.
2. GitHub → Settings → Pages → _Build and deployment_ → Source: **GitHub Actions**.
3. Actions → "Ritmea Alpha — publish to GitHub Pages (manual)" → Run workflow on `main`, type `Vai, pubblica`.
4. URL: `https://giandjcosta.github.io/Weight-Loss-Program/`.

## Known limits of Alpha 0.1

- Demo with synthetic data, kept in memory: reloading resets it. Real persistence = wire `openIndexedDbRepository` (PR #8) in `src/main.tsx` — compatibility verified (UI e2e suite passes on IndexedDB).
- No service worker yet → no offline mode; no update-safety layer needed until then.
- Public repo + public Pages URL: never enter personal health data in the alpha.
