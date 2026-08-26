import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { suggestCities } from '../../data/us-cities';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  stateCode?: string;
  optional?: boolean;
  placeholder?: string;
  disabled?: boolean;
};

export default function CityTypeahead({
  label,
  value,
  onChange,
  stateCode,
  optional = true,
  placeholder = 'Start typing a city',
  disabled,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const suggestions = useMemo(
    () => suggestCities(value, stateCode || null, 12),
    [value, stateCode],
  );

  useEffect(() => {
    setHighlight(0);
  }, [suggestions]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (city: string) => {
    onChange(city);
    setOpen(false);
  };

  return (
    <div className="relative space-y-1.5" ref={rootRef}>
      <label className="text-sm font-semibold text-foreground">
        {label}
        {optional ? (
          <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
        ) : (
          <span className="ml-1 text-destructive" aria-hidden>
            *
          </span>
        )}
      </label>
      <input
        type="text"
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="address-level2"
        placeholder={
          stateCode ? placeholder : 'Select a state first for suggestions'
        }
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((h) => (h + 1) % suggestions.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === 'Enter' && suggestions[highlight]) {
            e.preventDefault();
            pick(suggestions[highlight]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className="w-full rounded-card border border-border bg-card px-3 py-2.5 text-sm text-foreground shadow-[0_1px_0_0_rgba(255,255,255,0.85)_inset] placeholder:text-muted-foreground transition-[border-color,box-shadow] duration-200 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/25 disabled:opacity-60"
      />
      {open && suggestions.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-card border border-border bg-card py-1 shadow-lg"
        >
          {suggestions.map((city, i) => (
            <li key={city} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                className={[
                  'block w-full px-3 py-2 text-left text-sm',
                  i === highlight ? 'bg-brand-50 text-brand-900' : 'text-foreground hover:bg-muted',
                ].join(' ')}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(city);
                }}
              >
                {city}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!stateCode && value.trim() ? (
        <p className="text-xs text-muted-foreground">Select a state to narrow city suggestions.</p>
      ) : null}
    </div>
  );
}
