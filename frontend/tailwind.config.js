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
         * CHM palette (Brand Guidelines-oriented):
         * - `brand`: primary orange (~60–30 presence — surfaces, fills, carousel emphasis)
         * - `accent`: “Knowledge Blue” (~10 — links, outlines, subtle focus chrome)
         * Neutrals (stone/zinc/grays in components) remain the majority “60” base.
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
          600: '#316995',
          700: '#2a5780',
          800: '#264a6b',
          900: '#1f3f5e',
          950: '#152b40',
        },
        /**
         * Legacy `primary-*` classes — aliases CHM orange so older utilities never read “blue/teal-forward”.
         * Prefer `brand-*` in new code; keep `accent-*` for Knowledge Blue (~10%).
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
}
