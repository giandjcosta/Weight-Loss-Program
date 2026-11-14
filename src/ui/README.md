# Ritmea UI Shell — Alpha 0.1 (ChatGPT)

The view in \`src/ui/App.tsx\` is **interactive**, not a static mockup. It accepts a \`Repository\` prop and uses \`readSnapshot\` from \`src/ui/model.ts\` as its only data-reading boundary.

**Important:** \`src/main.tsx\` currently injects \`createMemoryRepository({seed:createDemoDataset()})\`. All data is synthetic, memory-only and intentionally lost on reload; users must not enter real health information. No synchronized account, IndexedDB, HealthKit access, cloud storage, Play Store packaging or deployed PWA is included in this PR.

## Implemented
- Desktop sidebar and iPhone/Android-width bottom navigation; width-aware layout and mobile safe area.
- Dashboard summary and observed weight chart, per-day food/water counts with missing-data indicators.
- Add/edit/delete weight, meals and workouts using the Repository, plus 250/500 ml hydration entries.
- Date selector, per-day nutrition logging completeness, append-only goals, profile height unknown, theme and app-icon preference.
- User-visible warnings: demo data only, no persistence/sync, no fabricated ETA.
- Shared branding: exact A+B SVG wordmark copied from the separate Claude brand draft, not a new concept.

## Next integration work
- Claude reviews the PR and runs \`npm run check\`, \`npm run build\`, \`npm run e2e\` in its own runtime; see browser screenshots on 320, 360, 390, 1440 px and an actual iPhone Safari acceptance check later.
- After the PR #8 data layer is independently cleared, inject \`openIndexedDbRepository()\` behind an explicit **personal mode** and validated backup/restore UI. Keep synthetic demo DB isolated.
- Complete accessibility focus management for dialog, data format localization, richer training sets and food portions, installable PWA/manifest/service worker in separate reviewed PRs.

**No merge, deployment, Pages change or release without owner-specific authorization \`«Vai, pubblica»\`.**