"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

/**
 * Appearance control. Three states in practice: an explicit dark or
 * light choice stamps data-theme on the root and wins; with nothing
 * stored the page follows the system preference.
 */
export function ThemeToggle() {
  // The pre-paint script in the document head owns the initial value.
  // This component must never write on mount, or it would clobber the
  // stored choice and the system preference with its own default.
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme((document.documentElement.dataset.theme as Theme) ?? "dark");
  }, []);

  const choose = (t: Theme) => {
    setTheme(t);
    const root = document.documentElement;
    root.dataset.theme = t;
    root.style.colorScheme = t;
    try {
      localStorage.setItem("chm-theme", t);
    } catch {
      // Private mode: the choice just doesn't persist.
    }
  };

  const next = theme === "light" ? "dark" : "light";

  return (
    <button
      type="button"
      onClick={() => choose(next)}
      aria-label={`Switch to ${next} appearance`}
      className="press grid size-9 shrink-0 place-items-center rounded-[6px] text-dim hover:text-text"
    >
      {/* Both glyphs stay mounted and cross-fade, so the swap
          animates in and out without a motion dependency. */}
      <span className="relative grid size-[18px] place-items-center">
        <SunIcon
          className={`absolute size-[18px] transition-[opacity,scale,filter] duration-300 ease-[var(--ease-cross)] ${
            theme === "light" ? "scale-100 opacity-100 blur-0" : "scale-[0.25] opacity-0 blur-[4px]"
          }`}
        />
        <MoonIcon
          className={`size-[18px] transition-[opacity,scale,filter] duration-300 ease-[var(--ease-cross)] ${
            theme === "light" ? "scale-[0.25] opacity-0 blur-[4px]" : "scale-100 opacity-100 blur-0"
          }`}
        />
      </span>
    </button>
  );
}

function SunIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
    </svg>
  );
}

function MoonIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z" />
    </svg>
  );
}
