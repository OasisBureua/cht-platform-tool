import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

type ThemeToggleProps = {
  className?: string;
};

/**
 * Toggles between light and dark. Persists choice and sets `class="dark"` on `documentElement`.
 * WCAG: named button, `aria-pressed` reflects dark mode, visible focus ring.
 */
export default function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { resolvedTheme, toggleColorScheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleColorScheme}
      className={[
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200/90 bg-white text-zinc-800 shadow-sm transition-[color,background-color,border-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 active:scale-[0.96] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] dark:hover:bg-zinc-800',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-pressed={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
    </button>
  );
}
