# CHM — Composio palette study

The `chm-brand-site-xai` build, re-skinned in Composio's visual
system. Same CHM content, structure and IA; the colour, radius and
control typography come from Composio.

```bash
npm run dev        # :3003
```

## Where the system came from

Two sources, both measured rather than guessed:

- **composio.dev** — read the live computed styles: near-black
  ground, the mint signature, the 4px radius, JetBrains Mono on
  controls.
- **hex.inc/work/composio** — the brand rationale ("rooted in
  electricity… high-saturation beams, intense light, motion and
  pace") plus the case-study imagery, sampled locally, which showed
  an electric blue family and a beam-white the live site alone did
  not surface.

| Role | Value |
|---|---|
| Ground | `#0a0a0a` |
| Surface | `#151515` |
| Electric blue (primary action) | `#007cff` |
| Deep blue | `#1600ec` |
| Cyan | `#00dcfe` |
| Pink | `#ff9ff8` |
| Coral | `#f99d9d` |
| Violet | `oklch(0.74 0.16 292)` |
| Anchor (text on dark) | `#5dcbff` |
| Radius | `4px` |

Therapeutic areas ride the same spectrum, each pill carrying a
gradient rather than a flat fill. Breast keeps the pink it owns by
convention.

Authored in OKLCH, which is the right call here: this is a new
system, not the hex-authored CHM brand spec being preserved.

## Substitutions

Composio pairs ABC Diatype with Roobert. Diatype is a commercial
Dinamo licence and Roobert is loaded there as a **TRIAL** face, not
licensed for production. Geist stands in for both. **JetBrains
Mono is genuine** — it is what Composio actually uses on controls,
and it is SIL OFL, so it carried over directly.

CHM's logo, content and IA are unchanged.

## Contrast

The mint is a light fill. White on it measures **1.94**; the ground
on it measures **9.7**, so every bright fill takes a dark label.
The therapeutic-area hues were re-pitched for a dark ground and
also take dark labels — at their previous lightness white was
measuring 2.37–3.02.

Zero contrast failures, lowest pair 5.01.
