import defaultColors from 'tailwindcss/colors.js'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        /** Type mix: Chillax = shared UI/display; Georgia serif = report documents; mono = data/tokens. */
        sans: ['Geist', 'system-ui', 'sans-serif'],
        /** Display/headings. Kept under the `serif` key so the ~existing
            font-serif usages keep working; the face is no longer a serif. */
        serif: ['Geist', 'system-ui', 'sans-serif'],
        /** Report-document body: true editorial serif (matches Report Generator white-papers). */
        report: ['Georgia', '"Times New Roman"', 'serif'],
        /** Numeric/tabular data, tokens, IDs. */
        mono: ['Geist Mono', 'Menlo', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        /** Token-driven radius (see --radius). Platform keeps its fully-rounded language. */
        'DEFAULT': 'var(--radius)',
        'sm': 'calc(var(--radius) - 4px)',
        'md': 'calc(var(--radius) - 2px)',
        'lg': 'var(--radius)',
        'xl': 'calc(var(--radius) + 4px)',
        'card': '1rem',
        'input': '0.5rem',
        'pill': '9999px',
      },
      boxShadow: {
        /* Repointed at the theme-aware vars in index.css so `shadow-card`
           follows the appearance instead of staying tuned for white. The
           light values are within a hair of the old literals. */
        'card': 'var(--s-card)',
        'card-hover': 'var(--s-card-hover)',
        'pop': 'var(--s-pop)',
        'nav': 'var(--s-nav)',
      },
      keyframes: {
        fadeSlideUp: {
          from: { opacity: '0', transform: 'translateY(2px)' },
          to: { opacity: '1', transform: 'none' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'fade-slide-up': 'fadeSlideUp 400ms cubic-bezier(0, 0, 0.2, 1) both',
        marquee: 'marquee 40s linear infinite',
      },
      fontSize: {
        'label': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.05em', fontWeight: '600' }],
        /* ------------------------------------------------------------
         * chm-composio type scale (additive).
         * Display sizes carry tight negative tracking and 1.02-1.08
         * leading; body opens up to 1.62. `label` above is the
         * platform's own and is left untouched — the design's label
         * step is carried by the `.eyebrow` class in index.css.
         * ---------------------------------------------------------- */
        'hero': ['4.25rem', { lineHeight: '1.02', letterSpacing: '-0.032em' }],
        'display-l': ['3rem', { lineHeight: '1.05', letterSpacing: '-0.028em' }],
        'display-m': ['2.25rem', { lineHeight: '1.08', letterSpacing: '-0.025em' }],
        'display-s': ['1.375rem', { lineHeight: '1.2', letterSpacing: '-0.018em' }],
        'body-l': ['1.125rem', { lineHeight: '1.62' }],
        'body-m': ['1rem', { lineHeight: '1.6' }],
        'body-s': ['0.875rem', { lineHeight: '1.5' }],
        'meta': ['0.75rem', { lineHeight: '1.4' }],
      },
      colors: {
        /* ============================================================
         * SEMANTIC TOKENS (CSS-var driven: see index.css :root/.dark)
         * These are the preferred surface. `hsl(var(--x) / <alpha-value>)`
         * so opacity modifiers (bg-primary/20) work in both themes.
         * ============================================================ */
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        /** PRIMARY = CHM Knowledge/Expertise teal (was orange). Drives CTAs, active nav, rings. */
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
          hover: 'hsl(var(--primary-hover) / <alpha-value>)',
          50: '#c7f8ff',
          100: '#aeeaff',
          200: '#8fd5ff',
          300: '#68baff',
          400: '#3b9aff',
          500: '#007cff',
          600: '#0068fc',
          700: '#0050c4',
          800: '#00419c',
          900: '#00337c',
          950: '#001a52',
        },
        /** ACCENT = CHM Connection Orange. The pop color: used sparingly. */
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
          hover: 'hsl(var(--accent-hover) / <alpha-value>)',
          50: '#ffdfff',
          100: '#ffcdff',
          200: '#ffb3fe',
          300: '#f293ea',
          400: '#da70d2',
          500: '#c54ebe',
          600: '#a841a2',
          700: '#883184',
          800: '#6d2569',
          900: '#561c53',
          950: '#350833',
        },
        /**
         * Legacy CHM marketing palette. Superseded by `cerebral`; kept
         * only so the 3 files still referencing it keep compiling.
         */
        /** CEREBRAL: the brand spectrum, for taxonomy and decoration. */
        cerebral: {
          blue: 'hsl(var(--cerebral-blue) / <alpha-value>)',
          'blue-deep': 'hsl(var(--cerebral-blue-deep) / <alpha-value>)',
          cyan: 'hsl(var(--cerebral-cyan) / <alpha-value>)',
          pink: 'hsl(var(--cerebral-pink) / <alpha-value>)',
          coral: 'hsl(var(--cerebral-coral) / <alpha-value>)',
          purple: 'hsl(var(--cerebral-purple) / <alpha-value>)',
          green: 'hsl(var(--cerebral-green) / <alpha-value>)',
          'on-bright': 'hsl(var(--cerebral-on-bright) / <alpha-value>)',
        },
        /** Spectrum hues tuned for TEXT: they deepen on a light ground. */
        ink: {
          cyan: 'hsl(var(--ink-cyan) / <alpha-value>)',
          pink: 'hsl(var(--ink-pink) / <alpha-value>)',
          purple: 'hsl(var(--ink-purple) / <alpha-value>)',
          coral: 'hsl(var(--ink-coral) / <alpha-value>)',
          green: 'hsl(var(--ink-green) / <alpha-value>)',
        },
        success: 'hsl(var(--success) / <alpha-value>)',
        warning: 'hsl(var(--warning) / <alpha-value>)',
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        /** Superseded by `cerebral`. Retained: 3 files still name these. */
        chm: {
          surface: '#f2f4f8',
          knowledge: '#3da4c0',
          expertise: '#3a839b',
          sharing: '#ff9e40',
          precision: '#485165',
          connection: '#e7764f',
          discovery: '#79869a',
        },
        /**
         * `brand-*`: alias of `primary-*`, now the Cerebral blue. 68 files
         * still use `bg-brand-600` etc., so remapping here moves them all
         * with zero per-file churn. Deprecated: new code uses `primary`.
         */
        brand: {
          50: '#c7f8ff',
          100: '#aeeaff',
          200: '#8fd5ff',
          300: '#68baff',
          400: '#3b9aff',
          500: '#007cff',
          600: '#0068fc',
          700: '#0050c4',
          800: '#00419c',
          900: '#00337c',
          950: '#001a52',
        },
        /* ============================================================
         * CHM-COMPOSIO COMPATIBILITY LAYER (additive)
         * Colour names the design's pages use that this platform did
         * not have. Backed by the light/dark var pairs at the foot of
         * index.css. No existing platform token is renamed.
         *
         * `muted2` is the design's `muted` text step, renamed only
         * because `muted` is already a platform background token.
         * Rewrite the design's `text-muted` to `text-muted2`.
         * ============================================================ */
        ground: 'hsl(var(--ground) / <alpha-value>)',
        /* The signed-in shell's field. Distinct from `ground`, which is
           the marketing pages' white; see --app-ground in index.css. */
        'app-ground': 'hsl(var(--app-ground) / <alpha-value>)',
        surface: 'hsl(var(--surface-1) / <alpha-value>)',
        'surface-2': 'hsl(var(--surface-2) / <alpha-value>)',
        text: 'hsl(var(--text) / <alpha-value>)',
        dim: 'hsl(var(--dim) / <alpha-value>)',
        muted2: 'hsl(var(--muted2) / <alpha-value>)',
        faint: 'hsl(var(--faint) / <alpha-value>)',
        anchor: 'hsl(var(--anchor) / <alpha-value>)',
        cta: 'hsl(var(--cta) / <alpha-value>)',
        'cta-deep': 'hsl(var(--cta-deep) / <alpha-value>)',
        signature: 'hsl(var(--signature) / <alpha-value>)',
        inverse: 'hsl(var(--inverse) / <alpha-value>)',
        'on-bright': 'hsl(var(--on-bright) / <alpha-value>)',
        'amber-ink': 'hsl(var(--amber-ink) / <alpha-value>)',
        /* The design writes `text-amber` for the same hue. Spread the
           stock scale back in first: a bare string here would wipe out
           Tailwind's amber-50..950, which ~40 platform usages still need. */
        amber: {
          ...defaultColors.amber,
          DEFAULT: 'hsl(var(--amber-ink) / <alpha-value>)',
          /* `text-amber-on-deep`: fixed in both appearances, for the
             permanently dark bands where `amber` itself would deepen
             into the ground. */
          'on-deep': 'hsl(var(--amber-on-deep) / <alpha-value>)',
        },
        /* These carry their own alpha, so no <alpha-value> slot: an
           opacity modifier on them is a no-op, not a broken colour. */
        hairline: 'hsl(var(--hairline))',
        'hairline-strong': 'hsl(var(--hairline-strong))',
        wash: 'hsl(var(--wash))',
        placeholder: 'hsl(var(--placeholder))',

        /**
         * `steel-*`: the former blue `accent-*` chrome scale, renamed so the
         * `accent` token can mean orange. Neutral cool chrome for nav/links.
         */
        steel: {
          50: '#e9f7ff',
          100: '#daebf7',
          200: '#c3d7e6',
          300: '#a7becf',
          400: '#89a2b5',
          500: '#6e8a9f',
          600: '#5d7587',
          700: '#495e6d',
          800: '#394a56',
          900: '#2c3a44',
          950: '#162128',
        },
      },
    },
  },
  plugins: [],
  /** CHM palette utilities used in components (JIT + nested colors: explicit avoids missing rules in dev). */
  safelist: [
    'bg-chm-surface',
    'text-chm-precision',
    'text-chm-discovery',
    'text-chm-sharing',
    'bg-chm-knowledge',
    'bg-chm-connection',
    'text-chm-expertise',
    'group-hover:text-chm-knowledge',
    'bg-chm-connection/95',
    'bg-chm-connection/12',
    'bg-chm-connection/20',
    'text-chm-connection',
    'hover:bg-chm-expertise',
    'focus-visible:outline-chm-expertise',
    'bg-chm-discovery/60',
  ],
}
