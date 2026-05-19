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
        /** Chillax replaces Inter everywhere via `font-sans`; sizing/weights stay the previous UI scale */
        sans: ['Chillax', 'system-ui', 'sans-serif'],
        serif: ['Chillax', 'Georgia', 'serif'],
      },
      borderRadius: {
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
        /**
         * Official CHM brand palette (marketing / guidelines).
         * Use `chm-*` for semantic brand spots; keep `accent` / `brand` for gradual migration.
         */
        chm: {
          /** Base White — app canvas (avoid key `base` / `canvas`: Tailwind `@apply` + JIT quirks) */
          surface: '#f2f4f8',
          /** Knowledge Blue — trust, secondary CTAs, learning moments */
          knowledge: '#3da4c0',
          /** Expertise Blue — depth, hover on knowledge, clinical emphasis */
          expertise: '#3a839b',
          /** Sharing Yellow — highlights, alternate emphasis */
          sharing: '#ff9e40',
          /** Precision Black — primary type on light, strong UI text */
          precision: '#485165',
          /** Connection Orange — warm CTAs, community, “listen” energy */
          connection: '#e7764f',
          /** Discovery Gray — secondary labels, supporting text */
          discovery: '#79869a',
        },
        /**
         * Legacy warm orange scale (maps toward Connection Orange where used for action).
         */
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#ea580c',
          600: '#c2410c',
          700: '#9a3412',
          800: '#7c2d12',
          900: '#431407',
          950: '#271005',
        },
        accent: {
          50: '#f0f7fb',
          100: '#d9eaf4',
          200: '#b7daec',
          300: '#8ac0de',
          400: '#5b9fcd',
          500: '#3f82b5',
          /** Align mid “chrome” blue toward Expertise Blue (#3a839b) for nav / links */
          600: '#3a839b',
          700: '#2a5780',
          800: '#264a6b',
          900: '#1f3f5e',
          950: '#152b40',
        },
        /**
         * Legacy `primary-*` — still maps to CHM orange for backwards compatibility.
         * Prefer `brand-*` for orange fills; prefer `accent-*` for blue UI chrome.
         */
        primary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#ea580c',
          600: '#c2410c',
          700: '#9a3412',
          800: '#7c2d12',
          900: '#431407',
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
