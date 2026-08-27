import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { suggestCities } from '../../data/us-cities';
import { cn } from '../../lib/cn';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  stateCode?: string;
  optional?: boolean;
  placeholder?: string;
  disabled?: boolean;
  /** Lets a form grid place the control, e.g. `sm:col-span-2`. */
  className?: string;
};

export default function CityTypeahead({
  label,
  value,
  onChange,
  stateCode,
  optional = true,
  placeholder = 'Start typing a city',
  disabled,
  className,
}: Props) {
  const listId = useId();
  const inputId = `${listId}-city`;
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
    <div className={cn('relative', className)} ref={rootRef}>
      <label htmlFor={inputId} className="block text-sm text-muted-foreground">
        {label}
        {optional ? (
          <span className="ml-1 text-muted-foreground">(optional)</span>
        ) : (
          <span className="ml-1 text-destructive" aria-hidden>
            *
          </span>
        )}
      </label>
      <input
        id={inputId}
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
        className="mt-2 h-12 w-full rounded-[6px] bg-card px-4 text-base text-foreground shadow-card outline-none placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60 sm:text-sm"
      />
      {open && suggestions.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-card bg-card py-1 shadow-card-hover"
        >
          {suggestions.map((city, i) => (
            <li key={city} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                className={cn(
                  'block w-full px-4 py-2 text-left text-sm transition-colors duration-150',
                  i === highlight ? 'bg-brand-600 text-white' : 'text-foreground hover:bg-muted',
                )}
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
        <p className="mt-2 text-sm text-muted-foreground">Select a state to narrow city suggestions.</p>
      ) : null}
    </div>
  );
}
