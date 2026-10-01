import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Mail, X } from 'lucide-react';
import { cn } from '../../../../lib/cn';
import type { ReportRecipient } from '../../../../api/reports';

const MAX_SUGGESTIONS = 8;

function displayName(r: ReportRecipient): string {
  return r.name?.trim() || r.email;
}

export function RecipientPicker({
  recipients,
  value,
  onChange,
  label = 'Notify when ready (optional)',
}: {
  recipients: ReportRecipient[];
  value: string[];
  onChange: (emails: string[]) => void;
  label?: string;
}) {
  const uid = useId();
  const inputId = `${uid}-input`;
  const listId = `${uid}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const byEmail = useMemo(() => new Map(recipients.map((r) => [r.email, r])), [recipients]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipients
      .filter((r) => !value.includes(r.email))
      .filter(
        (r) => !q || r.email.toLowerCase().includes(q) || (r.name ?? '').toLowerCase().includes(q),
      )
      .slice(0, MAX_SUGGESTIONS);
  }, [recipients, value, query]);

  const activeIndex = Math.min(highlight, Math.max(0, matches.length - 1));
  const showList = open && matches.length > 0;

  const add = (email: string) => {
    onChange([...value, email]);
    setQuery('');
    setHighlight(0);
    inputRef.current?.focus();
  };

  const remove = (email: string) => {
    onChange(value.filter((e) => e !== email));
    inputRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight(matches.length ? (activeIndex + 1) % matches.length : 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setHighlight(matches.length ? (activeIndex - 1 + matches.length) % matches.length : 0);
    } else if (e.key === 'Enter') {
      if (showList && matches[activeIndex]) {
        e.preventDefault();
        add(matches[activeIndex].email);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Backspace' && !query && value.length > 0) {
      remove(value[value.length - 1]);
    }
  };

  return (
    <div>
      <label htmlFor={inputId} className="text-sm text-muted-foreground">
        {label}
      </label>
      <div className="relative mt-2">
        <div
          className={cn(
            'flex min-h-12 flex-wrap items-center gap-1.5 rounded-[6px] bg-card px-2 py-1.5 shadow-card',
            'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring',
          )}
          onClick={() => inputRef.current?.focus()}
        >
          {value.map((email) => {
            const r = byEmail.get(email);
            return (
              <span
                key={email}
                title={email}
                className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-[6px] bg-brand-600 pl-2.5 pr-1 text-sm text-white"
              >
                <span className="truncate">{r ? displayName(r) : email}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(email);
                  }}
                  className="grid size-6 place-items-center rounded-[4px] hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
                  aria-label={`Remove ${r ? displayName(r) : email}`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </span>
            );
          })}
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList ? `${listId}-${activeIndex}` : undefined}
            autoComplete="off"
            value={query}
            placeholder={value.length ? 'Add another admin…' : 'Type a name or email…'}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
            className="h-8 min-w-[10rem] flex-1 bg-transparent px-1.5 text-base text-foreground outline-none placeholder:text-muted-foreground/70 sm:text-sm"
          />
        </div>

        {showList ? (
          <ul
            id={listId}
            role="listbox"
            aria-label="Matching admins"
            className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-[6px] bg-card py-1 shadow-card-hover"
          >
            {matches.map((r, i) => (
              <li
                key={r.userId}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(r.email);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 px-3 py-2',
                  i === activeIndex ? 'bg-muted' : 'bg-card',
                )}
              >
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-foreground">{displayName(r)}</span>
                  {r.name?.trim() ? (
                    <span className="block truncate text-xs text-muted-foreground">{r.email}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {open && query.trim() && matches.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No admins match “{query.trim()}”.</p>
        ) : null}
      </div>
    </div>
  );
}
