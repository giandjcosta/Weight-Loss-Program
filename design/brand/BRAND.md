# Ritmea — brand note (draft for owner review)

Status: **proposal**. Not yet approved, not used by any app code, nothing deployed.

## System

| Role | Asset | Why |
|---|---|---|
| Primary logo (horizontal) | Wave symbol + "Ritmea" wordmark | The wave carries the meaning: daily oscillations settle into a trend; the end dot is the goal. Neutral for loss, gain or maintenance. |
| Stacked logo | Wave above wordmark | Splash, onboarding, login. |
| App icon / PWA / Apple touch | "R" monogram on charcoal | Most legible at small sizes, fills a square well. Its leg *is* the wave, so both marks share one language. |
| Favicon / compact mark | "R" monogram, small optical variant | Thicker strokes and simplified leg for 16–48 px. |
| UI motif | Wave symbol alone | Section labels, empty states, loading animation. |

Alternatives kept for the owner's choice: **B (rhythm bars)** as an app icon; the A+D hybrid was rejected (too busy, identical to D at small sizes).

## Colours

| Token | Hex | Use |
|---|---|---|
| Charcoal | `#171B1C` | Icon background, dark UI base |
| Charcoal 2 | `#232A2B` | Icon gradient top, raised surfaces |
| Ink | `#1B2022` | Logo on light backgrounds |
| Paper | `#F5F3EE` | Light background |
| Sage | `#8FB39A` | Accent on dark (goal dot, monogram leg) |
| Sage deep | `#5E8A6C` | Accent on light backgrounds (contrast) |
| Mint | `#CFE3D3` | Soft highlight |
| Light text | `#EEF3EF` | Logo and symbol on dark |

## Type

- Wordmark: **Inter SemiBold (600)**, tracking −2.2 %, converted to outlines (no font dependency). The "i" uses a dotless glyph plus a separate round dot in the accent colour.
- UI: Inter, Medium/SemiBold for key numbers, `font-variant-numeric: tabular-nums` in charts and tables, units smaller and lighter than values.

## Geometry

- Symbols are drawn on a 100 × 100 grid with round caps and joins. Regular stroke 9, small (≤ 48 px) stroke 13.
- App icon: symbol inside a 14-unit padding (maskable variant: 22, to stay inside the 80 % safe zone). Icons are full-bleed squares; iOS and Android apply the rounded mask.

## Clear space and minimum size

- Clear space around any logo: at least the **cap height of the "R"** on every side.
- Minimum widths: horizontal logo **96 px** (screen) / 25 mm (print); stacked logo 64 px; wave symbol 16 px tall. Below 48 px use the `favicon` (small) monogram, never the full logo.

## Don'ts

- Don't recolour the wave red/amber or use it as a judgement of weight.
- Don't stretch, rotate, add shadows/outlines, or re-type the wordmark in another font.
- Don't put the light logo on mid-tone backgrounds where contrast is under 4.5 : 1.

## Files

```
svg/   logos (primary, stacked × dark/light/mono-black/mono-white), wave symbol, icons, favicon
png/   favicon-16/32/48/64, favicon.ico, apple-touch-180, pwa-192, pwa-512, pwa-maskable-512,
       icon-light-512, high-res logos (2000 px horizontal, 1200 px stacked)
preview/  comparison sheet and context mockups (synthetic example data only)
```

"Dark"/"light" in logo file names describe the background the logo is meant for; logo files have transparent backgrounds.

Legal: no trademark, App Store or domain clearance has been done for the name or the marks.
