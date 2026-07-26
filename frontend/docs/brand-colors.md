# CHM brand colors: where they show up

Official hex values live in `tailwind.config.js` under `theme.extend.colors.chm` and as CSS variables in `src/index.css` (`:root`).

| Token | Hex | Role |
|--------|-----|------|
| `chm.surface` | `#f2f4f8` | Base White: app canvas |
| `chm.knowledge` | `#3da4c0` | Knowledge Blue: secondary CTAs, learning emphasis |
| `chm.expertise` | `#3a839b` | Expertise Blue: depth, hovers, icon accents |
| `chm.sharing` | `#ff9e40` | Sharing Yellow: eyebrows, highlights on dark imagery |
| `chm.precision` | `#485165` | Precision Black: headings, strong body |
| `chm.connection` | `#e7764f` | Connection Orange: energy CTAs, badges, survey accents |
| `chm.discovery` | `#79869a` | Discovery Gray: labels, supporting text |

The legacy `accent` scale is still used in places while the UI migrates; new work should prefer `chm-*` for brand-semantic spots.

## App shell

- **`bg-chm-surface`**: `Layout.tsx`, `PublicLayout.tsx` main backgrounds (Base White in light mode).
- **Body text**: `index.css` sets `color: var(--chm-precision-black)` in light theme (Precision Black).

## Dashboard (`src/pages/Dashboard.tsx`)

- **Overview**
  - “Overview” eyebrow: `accent` (migration target: tie to Expertise/Knowledge).
  - Section title “Your dashboard”: **`text-chm-precision`**.
  - Subtitle copy: **`text-chm-discovery`**.
- **Next LIVE card**
  - When the next session has **`imageUrl`**: full-bleed cover `object-cover`, dark gradients for readability; title/meta in white; “Tap to open session” uses **`text-chm-sharing`** on imagery.
  - **“Next LIVE” pill**: frosted glass: **`border-white/80`**, **`bg-white/70`**, **`backdrop-blur-md`**, label + icon **`text-chm-knowledge`** (Knowledge Blue). For Sharing Yellow instead, swap those classes to **`text-chm-sharing`**.
  - Chevron (no image): **`text-chm-expertise`**, hover **`text-chm-knowledge`**.
  - Empty / no image: soft gradient (accent/amber) fallback; headline **`text-chm-precision`**, supporting **`text-chm-discovery`**.
- **Earnings & Activity tiles**
  - Upper labels: **`text-chm-discovery`**.
  - Icons: **`text-chm-expertise`**, dark mode **`text-chm-knowledge`**.
  - Large numbers: **`text-chm-precision`**.
- **Required surveys row**
  - Clipboard icon: **`text-chm-connection`**, dark **`text-chm-sharing`**.
  - “Pending actions”: **`text-chm-discovery`**.
  - “Required surveys” title: **`text-chm-precision`**.
  - Description: **`text-chm-discovery`**.
  - “Due” module: **`bg-chm-connection/12`** (dark: **`/20`**), “Due” label **`text-chm-connection`**, count **`text-chm-precision`**, “required” **`text-chm-discovery`**.
- **Featured spotlight carousel**
  - Eyebrows: **`text-chm-sharing`**.
  - Primary CTA (white button): **`text-chm-precision`**.
  - Secondary CTA (e.g. Playlists): **`bg-chm-knowledge`**, hover **`bg-chm-expertise`**, focus ring **`outline-chm-expertise`**.
  - Dot indicators: active **`bg-chm-knowledge`**, inactive **`bg-chm-discovery/60`**.

## Tailwind / CSS pipeline

- **`safelist`** in `tailwind.config.js` lists dynamic or conditional `chm-*` classes so JIT does not drop them.

## Adding new usage

1. Prefer an existing semantic token over raw hex.
2. Pair **Precision** (headings) + **Discovery** (secondary) for typographic hierarchy.
3. Use **Connection** for urgency and **Knowledge/Expertise** for trust and interactive blues.
4. Use **Sharing** for small highlights on **dark** or **busy** backdrops (e.g. photo cards).

When in doubt, extend this document with the file path and class names so the map stays accurate.
