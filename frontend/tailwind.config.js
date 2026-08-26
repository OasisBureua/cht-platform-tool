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
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 4px 12px 0 rgb(0 0 0 / 0.08)',
      },
      fontSize: {
        'label': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.05em', fontWeight: '600' }],
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
