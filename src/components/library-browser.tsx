"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { biomarkers, diseaseAreas, playlists } from "@/lib/platform";
import { byNewest, facultyBySlug, formatHref, type Format, type Item } from "@/lib/data";
import { SearchIcon } from "./icons";
import { EmptyState, FormatBadge, Thumb } from "./ui";

const FORMATS: { key: Format | "all"; label: string }[] = [
  { key: "all", label: "All formats" },
  { key: "video", label: "Video" },
  { key: "podcast", label: "Podcast" },
  { key: "editorial", label: "Editorial" },
];

/**
 * Search first, then the two taxonomies the brief calls for
 * (format and disease state) narrowing the same grid at once.
 */
export function LibraryBrowser({ items }: { items: Item[] }) {
  // A tag chip elsewhere on the site links here with ?q=, so the
  // library opens already narrowed to that tag.
  const seed = useSearchParams().get("q") ?? "";
  const [q, setQ] = useState(seed);
  const [format, setFormat] = useState<Format | "all">("all");
  const [area, setArea] = useState("all");
  const [marker, setMarker] = useState("all");

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hit = (s: string) => s.toLowerCase().includes(needle);
    return byNewest(
      items.filter(
        (i) =>
          (!needle || hit(i.title) || hit(i.dek) || i.tags.some(hit)) &&
          (format === "all" || i.format === format) &&
          (area === "all" || i.disease === area)
      )
    );
  }, [items, q, format, area]);

  const active = q || format !== "all" || area !== "all" || marker !== "all";
  const reset = () => {
    setQ("");
    setFormat("all");
    setArea("all");
    setMarker("all");
  };

  const pill = "press inline-flex h-10 items-center rounded-[6px] px-4 text-body-s";
  const on = "bg-inverse text-ground shadow-[var(--shadow-card)]";
  const off = "bg-surface text-dim shadow-[var(--shadow-card)] hover:bg-ground hover:text-text hover:shadow-[var(--shadow-card-hover)]";

  return (
    <>
      {/* ── search ─────────────────────────────────────── */}
      <div className="rail">
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute start-5 top-1/2 size-5 -translate-y-1/2 text-faint"
            strokeWidth={1.5}
          />
          <label htmlFor="library-search" className="sr-only">
            Search the content library
          </label>
          <input
            id="library-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search sessions, trials, faculty"
            className="h-14 w-full rounded-[6px] bg-surface ps-14 pe-5 text-base text-text shadow-[var(--shadow-card)] outline-none placeholder:text-faint focus:bg-ground focus:shadow-[var(--shadow-card-hover)]"
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {FORMATS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFormat(f.key)}
              aria-pressed={format === f.key}
              className={`${pill} ${format === f.key ? on : off}`}
            >
              {f.label}
            </button>
          ))}

          <span aria-hidden className="mx-2 h-6 w-px bg-transparent" />

          <button
            type="button"
            onClick={() => setArea("all")}
            aria-pressed={area === "all"}
            className={`${pill} ${area === "all" ? on : off}`}
          >
            Every area
          </button>
          {diseaseAreas.map((a) => (
            <button
              key={a.slug}
              type="button"
              onClick={() => setArea(a.slug)}
              aria-pressed={area === a.slug}
              style={area === a.slug ? { background: a.tone, color: "#fff" } : undefined}
              className={`${pill} ${area === a.slug ? "shadow-[var(--shadow-card)]" : off}`}
            >
              {a.label}
            </button>
          ))}

          <p role="status" className="meta ms-auto text-faint">
            {results.length} {results.length === 1 ? "result" : "results"}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {biomarkers.map((b) => (
            <button
              key={b.slug}
              type="button"
              onClick={() => setMarker(marker === b.slug ? "all" : b.slug)}
              aria-pressed={marker === b.slug}
              className={`${pill} gap-2 ${marker === b.slug ? on : off}`}
            >
              {b.label}
              <span className="meta opacity-70">{b.count}</span>
            </button>
          ))}
          {active ? (
            <button type="button" onClick={reset} className="press ms-1 text-body-s text-muted hover:text-text">
              Clear all
            </button>
          ) : null}
        </div>
      </div>

      {/* ── grid ───────────────────────────────────────── */}
      <div className="rail pt-12 pb-20">
        {results.length === 0 ? (
          <EmptyState
            title="Nothing matches that yet"
            body="The library covers six disease states across video, podcast and editorial, but not every combination is filled. Widen the filter to see more of it."
            action={{ label: "Clear all filters", href: "/catalog" }}
          />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((item) => {
              const lead = facultyBySlug(item.faculty[0]);
              return (
                <li key={item.slug}>
                  <Link href={formatHref(item)} className="card group flex h-full flex-col p-4">
                    <div className="relative">
                      <Thumb src={item.thumb} duration={item.duration} className="aspect-video w-full" />
                      <span className="absolute top-3 start-3">
                        <FormatBadge format={item.format} />
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col px-1 pt-4 pb-1">
                      <h3 className="display line-clamp-2 text-body-m text-text">{item.title}</h3>
                      <p className="meta mt-auto pt-5 text-faint">{lead?.name}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-16">
          <h2 className="display text-display-s text-text">Featured playlists</h2>
          <ul className="mt-6 flex flex-wrap gap-3">
            {playlists.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/catalog/${p.area}?playlist=${p.slug}`}
                  className="press inline-flex h-11 items-center gap-3 rounded-[6px] bg-surface px-5 text-body-s text-dim shadow-[var(--shadow-card)] hover:bg-ground hover:text-text hover:shadow-[var(--shadow-card-hover)]"
                >
                  {p.label}
                  <span className="meta text-faint">{p.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
