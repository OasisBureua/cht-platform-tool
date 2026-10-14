import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Stethoscope, X } from "lucide-react";
import { cn } from "../../../../lib/cn";
import { getApiErrorMessage } from "../../../../api/client";
import type { CampaignKol } from "../../../../api/reports";
import {
  ZoomAlert,
  ZoomLoadingState,
  ZoomSectionCard,
} from "../../../../components/admin/zoom-recordings/ZoomRecordingsUi";
import {
  useCampaignKols,
  useKolRoster,
  useSetCampaignKols,
} from "../lib/reportHooks";

const MAX_SUGGESTIONS = 8;

function subtitle(k: Pick<CampaignKol, "title" | "institution">): string {
  return [k.title, k.institution].filter(Boolean).join(" · ");
}

/** Hub KOLs listed in the report's Key Opinion Leaders section (CPR-45). */
export function CampaignKolsCard({ campaignId }: { campaignId: string }) {
  const uid = useId();
  const inputId = `${uid}-input`;
  const listId = `${uid}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const attached = useCampaignKols(campaignId);
  const roster = useKolRoster(open);
  const save = useSetCampaignKols(campaignId);

  const value = useMemo(() => attached.data ?? [], [attached.data]);
  const attachedIds = useMemo(() => new Set(value.map((k) => k.id)), [value]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (roster.data ?? [])
      .filter((k) => !attachedIds.has(k.id))
      .filter(
        (k) =>
          !q ||
          k.name.toLowerCase().includes(q) ||
          (k.institution ?? "").toLowerCase().includes(q),
      )
      .slice(0, MAX_SUGGESTIONS);
  }, [roster.data, attachedIds, query]);

  const activeIndex = Math.min(highlight, Math.max(0, matches.length - 1));
  const showList = open && matches.length > 0;

  const commit = (ids: string[]) => save.mutate(ids);

  const add = (id: string) => {
    commit([...value.map((k) => k.id), id]);
    setQuery("");
    setHighlight(0);
    inputRef.current?.focus();
  };

  const remove = (id: string) => {
    commit(value.map((k) => k.id).filter((v) => v !== id));
    inputRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight(matches.length ? (activeIndex + 1) % matches.length : 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setHighlight(
        matches.length
          ? (activeIndex - 1 + matches.length) % matches.length
          : 0,
      );
    } else if (e.key === "Enter") {
      if (showList && matches[activeIndex]) {
        e.preventDefault();
        add(matches[activeIndex].id);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && !query && value.length > 0) {
      remove(value[value.length - 1].id);
    }
  };

  return (
    <ZoomSectionCard
      title="Key opinion leaders"
      description="KOLs from the Hub roster to list in the report. Use this for Zoom webinars; KOLs from linked video shoots are included automatically."
    >
      {attached.isLoading ? (
        <ZoomLoadingState label="Loading KOLs…" />
      ) : attached.isError ? (
        <ZoomAlert tone="error">
          {getApiErrorMessage(attached.error, "Could not load KOLs.")}
        </ZoomAlert>
      ) : (
        <div className="space-y-3">
          <label htmlFor={inputId} className="text-sm text-muted-foreground">
            Attached KOLs
          </label>
          <div className="relative">
            <div
              className={cn(
                "flex min-h-12 flex-wrap items-center gap-1.5 rounded-[6px] bg-card px-2 py-1.5 shadow-card",
                "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring",
                save.isPending && "opacity-70",
              )}
              onClick={() => inputRef.current?.focus()}
            >
              {value.map((k) => (
                <span
                  key={k.id}
                  title={subtitle(k) || k.name}
                  className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-[6px] bg-brand-600 pl-2.5 pr-1 text-sm text-white"
                >
                  <span className="truncate">{k.name}</span>
                  <button
                    type="button"
                    disabled={save.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(k.id);
                    }}
                    className="grid size-6 place-items-center rounded-[4px] hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
                    aria-label={`Remove ${k.name}`}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>
              ))}
              <input
                ref={inputRef}
                id={inputId}
                type="text"
                role="combobox"
                aria-expanded={showList}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={
                  showList ? `${listId}-${activeIndex}` : undefined
                }
                autoComplete="off"
                disabled={save.isPending}
                value={query}
                placeholder={
                  value.length
                    ? "Add another KOL…"
                    : "Type a name or institution…"
                }
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
                aria-label="Matching KOLs"
                className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-[6px] bg-card py-1 shadow-card-hover"
              >
                {matches.map((k, i) => (
                  <li
                    key={k.id}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      add(k.id);
                    }}
                    onMouseEnter={() => setHighlight(i)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-3 py-2",
                      i === activeIndex ? "bg-muted" : "bg-card",
                    )}
                  >
                    <Stethoscope
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-foreground">
                        {k.name}
                      </span>
                      {subtitle(k) ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {subtitle(k)}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {open && roster.isLoading ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Loading KOL roster…
              </p>
            ) : open && query.trim() && matches.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No KOLs match “{query.trim()}”.
              </p>
            ) : null}
          </div>

          {save.isError ? (
            <ZoomAlert tone="error">
              {getApiErrorMessage(save.error, "Could not save KOLs.")}
            </ZoomAlert>
          ) : null}
        </div>
      )}
    </ZoomSectionCard>
  );
}
