# Ritmea — UI/UX acceptance criteria (draft, synthetic-only)

**Purpose:** Product acceptance contract for parallel engineering. This is not a deployment or merge authorization. Claude's \`claude/foundation\` PR will provide canonical TypeScript data contracts; these UI criteria should guide them, not preempt them. Do not put user health records into the PUBLIC repository.

## Brand and interface

- App name **Ritmea**, independent of any target weight; target is a user setting.
- Approved design direction: **A+B integrated wave + irregular rhythm bars** for primary logo and app icon. **Bars-only teal→sage** rhythm symbol is an optional official alternative, not a separate brand. The earlier A+D logo assets in the brand branch are exploratory and must not be treated as the final A+B exports.
- Brand needs real-size review: favicon 16/32/48/64 px; Apple 180 px; PWA 192/512 px + maskable safe area; responsive navbar, splash, empty states. Keep compact mark recognizable; avoid ECG/phone signal clichés. Optional icon preference must **not** promise that iOS automatically changes an already-installed PWA Home Screen icon.
- Charcoal background \`#171B1C\`, cream light surface \`#F5F3EE\`, sage \`#8FB39A\`; clearly distinct backgrounds/cards/active tabs. Colorful warm→green **progress bar** only when selected by user, never a judgement on body type/weight. Dark/light/monochrome brand variants.
- UI Inter, numbers tabular in tables/charts; units smaller; Italian sentence-case (**“Solo dopo importazione”**). Responsive 320/375/390/430/768/1024/1440 CSS px; mobile safe-area, focus states, good contrast, reduced-motion and keyboard usability.

## Onboarding (short, skippable steps)

- Direction: **lose / gain / maintain band / recomposition**. User can give targets directly or ask for tentative guided suggestions.
- Ask only needed input: current weight and optionally goal, height, age, sex input for metabolic calculation, body fat if measured, lifestyle, activity/training, existing calorie reference, goal pace or date. Do not ask people to invent data.
- **“Non lo so” / “I don't know”**, **“Not measured”**, and **“Prefer not to say”** are first-class answers wherever reasonable. They must remain distinct from 0, missing logging, and not applicable. Some estimates will be unavailable; label them accordingly.
- Allow professional/user targets and later edits without wiping dated histories. Explain when a past baseline is preserved or redefined.
- Calorie and weight recommendations use transparent assumptions/ranges, not clinical prescriptions or guaranteed outcomes. Never silently change professional-set targets.

## Dashboard, progress and forecasts

- Show dated latest **recorded** weight, starting weight, selected goal, direction-specific progress. Empty state is **“Nessuna pesata ancora”**, not 0 kg.
- Weight graph shows **actual samples** and separate rolling seven-day averages over *available* samples; never fill gaps with zero values. Accessible summary/table, clear measurement vs estimate vs import status, local date display.
- For loss/gain, progress is direction-aware and visually bounded at 0–100% while overshoot is described separately. For maintenance, show band adherence; for recomposition, weight-only progress may be not applicable.
- Keep two distinct goal time estimates: (1) editable weekly-rate **scenario** at onboarding, labelled as hypothetical date range, NOT a forecast; (2) **observed-trend** ETA only with sufficient longitudinal samples, otherwise typed insufficient-data state.
- Food, water and workout cards distinguish **unlogged**, **partial**, **complete** and **imported**; unlogged meals are never zero-consumption days; duplicate sources must not be double-counted.
- Provide quick actions for logging weight/meal/water/workout, with form values retained after validation errors.

## Diaries, settings and integration honesty

- Nutrition entries: date, meal, portion basis, calories/macros, source country/quality and estimated-vs-verified labels; locale decimal comma supported.
- Training: planned ≠ completed, editable exercises, reps, sets, load, cardio and treadmill. Any Upper/Lower/Full Body example is optional, not everyone's default.
- Settings: goals, calories/protein/water, metric/imperial, theme, fixed/custom/gradient progress color, icon preference, language IT/EN, data export/backup/restore/delete.
- Show clearly that browser-local data **does not automatically sync between devices**. Manual CSV/JSON/Apple Health exports are imports, not a live HealthKit or Lifesum connection.

## Independent QA gates

- Synthetic fixtures only: empty/no-sample states; date/timezone boundaries; decimal comma; missing days, noisy/negative trends, weight gain, maintain band; editing goals; duplicate imports; over-limit/malformed values; storage failure, reload, offline and backup round trip.
- 390×844 and 1440×900 Chromium screenshots plus real iPhone Safari tests by owner; verify 320px no horizontal overflow, optical small-icon fidelity and accessibility. Unit tests and independent adversarial tests on calc/data logic from their **specification**, not only from author implementation.
- No user health info, personal screenshot, secrets or real exports in public Git history, logs, fixture files or screenshots. No \`main\` merge, app deployment, or access-permission change without separate owner approval **“Vai, pubblica”**.

## Ownership

- **Claude:** \`src/core/**\` foundation (reviewed by ChatGPT), \`src/data/**\`, \`src/import/**\`, \`src/calc/**\`, data architecture and integration.
- **ChatGPT:** \`src/ui/**\`, \`src/i18n/**\`, \`src/pwa/**\`, visual QA and independent black-box tests of Claude's calculations, backup/import behavior.
- Shared contracts/dependencies and service worker safety require both reviews. First development PR is the narrowly scoped \`claude/foundation\` followed by UI and data work on separate branches.