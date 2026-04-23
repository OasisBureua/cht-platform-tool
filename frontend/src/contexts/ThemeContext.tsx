import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'chm-color-scheme';

export type ColorScheme = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  /** User preference. `system` follows OS. */
  colorScheme: ColorScheme;
  /** Effective theme after resolving `system`. */
  resolvedTheme: 'light' | 'dark';
  setColorScheme: (scheme: ColorScheme) => void;
  /** Toggles between light and dark (if currently system, picks the opposite of the OS value). */
  toggleColorScheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredScheme(): ColorScheme {
  if (typeof window === 'undefined') return 'system';
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  return 'system';
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolve(resolved: ColorScheme, systemIsDark: boolean): 'light' | 'dark' {
  if (resolved === 'system') return systemIsDark ? 'dark' : 'light';
  return resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(() => readStoredScheme());
  const [systemIsDark, setSystemIsDark] = useState(false);

  useEffect(() => {
    setSystemIsDark(systemPrefersDark());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemIsDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme = useMemo(
    () => resolve(colorScheme, systemIsDark),
    [colorScheme, systemIsDark],
  );

  useEffect(() => {
    const root = document.documentElement;
    const dark = resolvedTheme === 'dark';
    root.classList.toggle('dark', dark);
    root.style.colorScheme = dark ? 'dark' : 'light';
  }, [resolvedTheme]);

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    localStorage.setItem(STORAGE_KEY, scheme);
  }, []);

  const toggleColorScheme = useCallback(() => {
    setColorSchemeState((prev) => {
      const effective: 'light' | 'dark' = prev === 'system' ? (systemIsDark ? 'dark' : 'light') : prev;
      const next: 'light' | 'dark' = effective === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, [systemIsDark]);

  const value = useMemo(
    () => ({ colorScheme, resolvedTheme, setColorScheme, toggleColorScheme }),
    [colorScheme, resolvedTheme, setColorScheme, toggleColorScheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
