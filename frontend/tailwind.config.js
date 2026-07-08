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
        sans: ['Chillax', 'system-ui', 'sans-serif'],
        /** Display/headings — Chillax with a serif fallback (unchanged for existing usage). */
        serif: ['Chillax', 'Georgia', 'serif'],
        /** Report-document body — true editorial serif (matches Report Generator white-papers). */
        report: ['Georgia', '"Times New Roman"', 'serif'],
        /** Numeric/tabular data, tokens, IDs. */
        mono: ['Menlo', 'Monaco', 'ui-monospace', 'monospace'],
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
         * SEMANTIC TOKENS (CSS-var driven — see index.css :root/.dark)
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
          50: '#f1f9fb',
          100: '#dceff4',
          200: '#bde1ea',
          300: '#8fcbd9',
          400: '#5bb0c5',
          500: '#3da4c0',
          600: '#3a839b',
          700: '#316b7f',
          800: '#2c5867',
          900: '#284a58',
          950: '#16303b',
        },
        /** ACCENT = CHM Connection Orange. The pop color — used sparingly. */
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
          hover: 'hsl(var(--accent-hover) / <alpha-value>)',
          50: '#fef4f0',
          100: '#fde4d9',
          200: '#fbc8b3',
          300: '#f7a483',
          400: '#ef7e54',
          500: '#e7764f',
          600: '#d15b34',
          700: '#ae4728',
          800: '#8f3c25',
          900: '#763523',
          950: '#401a0f',
        },
        /**
         * Official CHM brand palette (marketing / guidelines). Unchanged —
         * knowledge=teal and connection=orange are already correct.
         */
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
         * `brand-*` — REMAPPED from orange to teal so the ~45 files using
         * `bg-brand-600` etc. become teal-primary with zero per-file churn.
         * Deprecated alias of `primary-*`; new code should use `primary`.
         */
        brand: {
          50: '#f1f9fb',
          100: '#dceff4',
          200: '#bde1ea',
          300: '#8fcbd9',
          400: '#5bb0c5',
          500: '#3da4c0',
          600: '#3a839b',
          700: '#316b7f',
          800: '#2c5867',
          900: '#284a58',
          950: '#16303b',
        },
        /**
         * `steel-*` — the former blue `accent-*` chrome scale, renamed so the
         * `accent` token can mean orange. Neutral cool chrome for nav/links.
         */
        steel: {
          50: '#f0f7fb',
          100: '#d9eaf4',
          200: '#b7daec',
          300: '#8ac0de',
          400: '#5b9fcd',
          500: '#3f82b5',
          600: '#3a839b',
          700: '#2a5780',
          800: '#264a6b',
          900: '#1f3f5e',
          950: '#152b40',
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
