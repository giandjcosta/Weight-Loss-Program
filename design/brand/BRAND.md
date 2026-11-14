# Ritmea — brand guide (A+B, draft for owner sign-off)

Status: **draft, pending owner sign-off** (issue #2). Not wired into app code, nothing deployed.
Supersedes the earlier exploratory A+D assets on this branch.

## System

| Role | Asset | Use |
|---|---|---|
| **Primary mark (A+B)** | `svg/ritmea-mark-*.svg` | A calming wave that turns into irregular rhythm bars, ending with a goal dot. The brand symbol. |
| Primary logo, horizontal | `svg/ritmea-logo-horizontal-*.svg` | Desktop navbar, mobile top bar, documents. |
| Primary logo, stacked | `svg/ritmea-logo-stacked-*.svg` | Splash, onboarding, login, about screen. |
| Wordmark only | `svg/ritmea-wordmark-*.svg` | Where the mark already appears nearby. |
| **App icon (default)** | `svg/ritmea-icon-primary-*.svg` → `png/ritmea-primary-*` | iPhone Home Screen (Apple touch), PWA manifest, Android maskable. |
| **Optional official icon: bars only** | `svg/ritmea-icon-bars-*.svg` → `png/ritmea-bars-*` | Same app, alternative icon look: staggered rhythm bars, turquoise → sage. Never used with a different name or wordmark. |
| Compact mark (favicon) | `svg/ritmea-favicon*.svg` → `png/ritmea-favicon-*` | Browser tab and shortcuts. 16 px uses the micro version, 32–48 px the compact bar group, 64 px the full mark. |
| Mono fallback | `*-mono-black`, `*-mono-white`, `ritmea-icon-mono.svg` | Print, one-colour embossing, system contexts that ignore colour. Flat, no gradients. |

The bars-only icon and the favicon reuse the bar language of the primary mark: same round caps, same stroke-to-gap ratio and a closing dot. They read as the same brand, not a second app.

## Colours

| Token | Hex | Use |
|---|---|---|
| Charcoal | `#171B1C` | Dark background, icon base |
| Charcoal 2 | `#262F2D` | Icon gradient top |
| Ink | `#1B2022` | Logo on light backgrounds |
| Cream | `#F5F3EE` | Light background |
| Sage | `#8FB39A` | Accent on dark: bars, dot, wordmark i-dot |
| Sage deep | `#5E8A6C` | Accent on light (contrast) |
| Light | `#F2F5F2` | Wave start and wordmark on dark |
| Turquoise | `#3FA9A0` | Bars-only icon, top of gradient (dark) |
| Turquoise deep | `#2F8C85` | Bars-only icon on light |

The gradients run from the neutral (white or ink) to sage across the wave, sage to neutral up the tallest bar, and turquoise to sage on the bars-only icon. Mono variants never use gradients. Colour never carries meaning on its own: the shapes are identical in mono.

## Typography

- Wordmark: **Inter SemiBold 600**, tracking −2.2 %, Inter's own kerning, **outlined to paths**, so there is no font dependency. The "i" is a dotless glyph plus a round dot ~10 % larger than Inter's, coloured with the accent.
- UI: Inter. Medium/SemiBold for key numbers, `font-variant-numeric: tabular-nums` in charts and tables, units smaller and lighter than values.

## Geometry

- Primary mark grid: 110 × 64 units, stroke **9**, round caps and joins. The bars sit on a shared baseline (y = 56), bar centres are 13 units apart, heights are irregular (rhythm, not a rising signal), and the dot's radius is 5.4, bottom-aligned with the bars.
- Icons: 100 × 100 full-bleed squares; iOS and Android apply their own corner mask, so no rounded corners are baked in. The mark spans 80 % of the width. Maskable variants span 66 % (primary) and 76 % (bars), inside the 80 % safe circle.
- Favicons bake in a 22 % corner radius, because browsers don't mask them.

## Clear space and minimum sizes

- Clear space around any logo is at least the **cap height of the "R"** on every side; the SVG viewBoxes already include half of it.
- Minimum sizes:
  - horizontal logo: **96 px wide** on screen, 25 mm in print;
  - stacked logo: 64 px wide;
  - full mark on its own: **24 px tall**.
  - below 64 px icon size, use the favicon/compact mark, never the full mark.

## iPhone / PWA: what the optional icon can and cannot do

- A PWA's Home Screen icon is fixed **when the user adds it to the Home Screen** (`apple-touch-icon` on iOS, manifest `icons` on Android). A setting inside the app **cannot change an already installed icon**.
- Supported approach: the app offers an "Icona preferita" setting. It updates the `<link rel="apple-touch-icon">` and the manifest the next time the page loads. The user then **removes and re-adds** the app to the Home Screen to see the new icon. Local data in the browser storage normally survives this on the same origin, but the app must still recommend a backup first.
- No automatic switch is promised.

## Don'ts

- Don't recolour the mark red/amber or use it as a judgement on weight.
- Don't stretch, rotate, outline, shadow, or re-type the wordmark.
- Don't pair the bars-only icon with another name.
- Don't place the light logo on mid-tone backgrounds under 4.5 : 1 contrast.

## Files

```
svg/      masters (UTF-8, outlined text, unique gradient ids per file)
png/      favicon-16/32/48/64, favicon.ico, {primary,bars}-apple-touch-180, -pwa-192, -pwa-512,
          -pwa-maskable-512, -icon-light-512, logo PNGs (2000 px horizontal, 1200 px stacked)
preview/  overview, 1:1 real-size sheet, context mockups (synthetic data only)
```

"Dark"/"light" in logo names describe the background the logo is meant for; logo files have transparent backgrounds. PNGs are rendered from these SVG masters (headless Chromium) and checked at 1:1.

Legal: no trademark, App Store or domain clearance has been done for the name or the marks.
