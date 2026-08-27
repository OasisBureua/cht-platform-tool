import { useMemo, useState, useEffect, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search as SearchIcon, SlidersHorizontal, X, Loader2, ArrowRight } from 'lucide-react';
import { catalogApi } from '../../api/catalog';
import { getShortClipId, getMediaHubThumbnail, shouldSurfaceCatalogClip } from '../../utils/clipUrl';
import { clipStripeSubtitle } from '../../utils/mediaHubClipText';
import { Button, Card, Chip, chipKind, SectionHead } from '../../components/ui';
import { cn } from '../../lib/cn';

type ResultType = 'Video' | 'Webinar' | 'Collection';

type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  type: ResultType;
  image?: string;
  tag?: string;
  href: string;
};

const MOCK_RESULTS: SearchResult[] = [
  {
    id: 'r1',
    title: 'Breast Cancer 101: Current Landscape',
    subtitle: 'Foundations • 18 min • Dr. Paolo Tarantino',
    type: 'Video',
    tag: 'Breast Cancer',
    href: '/catalog',
  },
  {
    id: 'r2',
    title: 'HER2+ Treatment Sequencing',
    subtitle: 'HER2+ • 16 min • Dr. Jason Mouabbi',
    type: 'Video',
    tag: 'Breast Cancer',
    href: '/catalog/clip/bc-her2-1',
  },
  {
    id: 'r3',
    title: 'Breast Cancer Collection',
    subtitle: 'Curated playlists + webinars',
    type: 'Collection',
    tag: 'Oncology',
    href: '/catalog',
  },
  {
    id: 'r4',
    title: 'Lung Cancer 101: Biomarkers & Workup',
    subtitle: 'General • 18 min • Biomarkers',
    type: 'Video',
    tag: 'Lung Cancer',
    href: '/catalog',
  },
  {
    id: 'r5',
    title: 'Upcoming Webinar: Clinical Updates (Demo)',
    subtitle: 'Webinar • 1 CME Credit • Sponsor Name',
    type: 'Webinar',
    tag: 'Webinars',
    href: '/webinars',
  },
];

const TYPE_FILTERS: Array<ResultType | 'All'> = ['All', 'Video', 'Webinar', 'Collection'];

const SEARCH_DEBOUNCE_MS = 350;

/**
 * The page gutter, matching `--page-gutter` in index.css so `bleed-x`
 * and the rail agree about where the content edge sits.
 */
const RAIL = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8';

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQ = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(urlQ);
  const [type, setType] = useState<ResultType | 'All'>('All');
  const [showFilters, setShowFilters] = useState(false);
  const [debouncedQ, setDebouncedQ] = useState(query.trim());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setQuery(urlQ);
  }, [urlQ]);

  const { data: searchData, isFetching: apiLoading, isError: apiError } = useQuery({
    queryKey: ['catalog', 'search', debouncedQ],
    queryFn: () => catalogApi.search(debouncedQ, { limit: 40 }),
    enabled: debouncedQ.length >= 2,
    staleTime: 60 * 1000,
  });

  const apiResults: SearchResult[] = useMemo(() => {
    if (!searchData?.items?.length) return [];
    return searchData.items
      .filter((clip) => shouldSurfaceCatalogClip(clip))
      .map((clip) => ({
        id: `api-${clip.id}`,
        title: clip.title,
        subtitle: clipStripeSubtitle(clip) || 'Video',
        type: 'Video' as const,
        tag: Array.isArray(clip.tags) ? clip.tags[0] : undefined,
        href: `/catalog/clip/${getShortClipId(clip.id)}`,
        image: getMediaHubThumbnail(clip),
      }));
  }, [searchData]);

  const filtered = useMemo(() => {
    const q = debouncedQ.toLowerCase();
    const mockFiltered = MOCK_RESULTS.filter((r) => {
      const matchesQuery = q
        ? r.title.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q)
        : true;
      const matchesType = type === 'All' ? true : r.type === type;
      return matchesQuery && matchesType;
    });

    if (debouncedQ.length < 2) {
      return mockFiltered;
    }

    const apiFiltered =
      type === 'All' || type === 'Video'
        ? apiResults
        : [];

    const seen = new Set(apiFiltered.map((r) => r.href));
    const merged = [
      ...apiFiltered,
      ...mockFiltered.filter((r) => !seen.has(r.href) && (type === 'All' || r.type === type)),
    ];

    if (type === 'All') return merged;
    return merged.filter((r) => r.type === type);
  }, [debouncedQ, type, apiResults]);

  const applyUrl = () => {
    const q = query.trim();
    if (q) setSearchParams({ q }, { replace: true });
    else setSearchParams({}, { replace: true });
  };

  const resetAll = () => {
    setType('All');
    setQuery('');
    setSearchParams({}, { replace: true });
  };

  return (
    <div className="bg-background">
      {/* ── 01 / Search ─────────────────────────────────────────
          The query is the page's subject, so the field sits inside
          the head rather than in a toolbar bolted above it. */}
      <section aria-labelledby="search-heading">
        <div className={cn(RAIL, 'py-16 md:py-24')}>
          <Reveal>
            <p className="text-label uppercase text-muted-foreground">01 / Search</p>
            <h1
              id="search-heading"
              className={cn(
                'mt-2 text-balance font-semibold text-foreground',
                'text-[2.25rem] leading-[1.08] tracking-[-0.025em]',
                'md:text-[3rem] md:leading-[1.05] md:tracking-[-0.028em]',
              )}
            >
              Explore catalog
            </h1>
            <p className="mt-5 max-w-[54ch] text-pretty leading-relaxed text-muted-foreground">
              Quick clip search (type at least 2 characters for live catalog matches). For filters and playlists, open
              the{' '}
              <Link
                to="/catalog"
                className="font-medium text-foreground underline decoration-muted-foreground/40 underline-offset-4 transition-[text-decoration-color] duration-150 hover:decoration-foreground"
              >
                content library
              </Link>
              .
            </p>
          </Reveal>

          <Reveal delay={60}>
            <form
              className="mt-10 flex max-w-3xl flex-col gap-3 md:flex-row md:items-center"
              onSubmit={(e) => {
                e.preventDefault();
                applyUrl();
              }}
            >
              <div className="relative flex-1">
                <SearchIcon
                  aria-hidden
                  className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by condition, speaker, topic…"
                  aria-label="Search by condition, speaker, topic"
                  className={cn(
                    'h-12 w-full rounded-[6px] bg-card pl-12 pr-14 text-base text-foreground shadow-card sm:text-sm',
                    'outline-none placeholder:text-muted-foreground/70',
                    'transition-shadow duration-150 hover:shadow-card-hover',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  )}
                />

                {query ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setSearchParams({}, { replace: true });
                    }}
                    className={cn(
                      'absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-[6px]',
                      'text-muted-foreground transition-[background-color,color,scale] duration-150',
                      'hover:bg-muted hover:text-foreground motion-safe:active:scale-[0.96]',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    )}
                    aria-label="Clear search"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>

              <Button type="submit" size="lg" className="md:min-w-[7.5rem]">
                Search
              </Button>
            </form>
          </Reveal>
        </div>
      </section>

      {/* ── 02 / Results ────────────────────────────────────────
          Filters sit above what they filter, never beside it: a
          sidebar would push the results into a column narrower
          than the rows they are ranked in. */}
      <section aria-label="Results">
        <div className={cn(RAIL, 'pb-20 md:pb-28')}>
          <Reveal delay={120}>
            <SectionHead
              index="02 / Results"
              title="Results"
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowFilters((v) => !v)}
                  aria-expanded={showFilters}
                >
                  <SlidersHorizontal className="size-4" />
                  Filters
                </Button>
              }
            />

            <div
              aria-live="polite"
              className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground"
            >
              <span>
                Showing <span className="font-medium tabular-nums text-foreground">{filtered.length}</span> results
              </span>
              {debouncedQ.length >= 2 && apiLoading && (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="size-4 animate-spin" />
                  Searching catalog…
                </span>
              )}
              {debouncedQ.length >= 2 && apiError && (
                <span className="text-warning">Catalog search unavailable: showing curated matches only.</span>
              )}
            </div>

            {showFilters ? (
              <div className="mt-8">
                <p className="text-label uppercase text-muted-foreground">Type</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {TYPE_FILTERS.map((t) => (
                    <Button
                      key={t}
                      type="button"
                      size="sm"
                      variant={type === t ? 'solid' : 'outline'}
                      aria-pressed={type === t}
                      onClick={() => setType(t)}
                    >
                      {t}
                    </Button>
                  ))}
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Button type="button" size="sm" variant="outline" onClick={resetAll}>
                    Reset
                  </Button>
                  <Button type="button" size="sm" onClick={() => setShowFilters(false)}>
                    Apply
                  </Button>
                </div>
              </div>
            ) : null}
          </Reveal>

          {filtered.length > 0 ? (
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((r, i) => (
                // The stagger caps out so a 40-result page does not
                // spend two seconds arriving.
                <Reveal as="li" key={r.id} delay={Math.min(i, 8) * 60} className="h-full">
                  <Card to={r.href} className="group flex h-full flex-col overflow-hidden p-3">
                    {/* The poster is why a result is recognisable at a
                        glance; a title-only row made every hit look the
                        same. Falls back to a plain tile when a clip has
                        no usable thumbnail. */}
                    <div className="relative aspect-video w-full overflow-hidden rounded-[6px] bg-surface-2">
                      {r.image ? (
                        <img
                          src={r.image}
                          alt=""
                          loading="lazy"
                          className="absolute inset-0 size-full object-cover transition-[scale] duration-300 ease-[var(--ease-out-strong)] group-hover:scale-[1.04]"
                        />
                      ) : null}
                    </div>

                    <div className="mt-3 flex min-w-0 flex-1 flex-col">
                      <h3 className="line-clamp-2 text-base font-medium text-foreground">{r.title}</h3>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{r.subtitle}</p>

                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <Chip kind="neutral">{r.type}</Chip>
                        {r.tag ? <Chip kind={chipKind(r.tag)}>{r.tag}</Chip> : null}
                      </div>
                    </div>
                  </Card>
                </Reveal>
              ))}
            </ul>
          ) : (
            <Reveal delay={180}>
              <Card className="mt-10 px-8 py-16 text-center">
                <p className="text-xl font-semibold tracking-tight text-foreground">No results found</p>
                <p className="mx-auto mt-2 max-w-[42ch] text-muted-foreground">
                  Try a different search term or reset filters.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Button to="/catalog" variant="outline" size="lg">
                    Browse Catalogue
                  </Button>
                  <Button type="button" size="lg" onClick={resetAll}>
                    Reset
                  </Button>
                </div>
              </Card>
            </Reveal>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * Entrance: opacity plus a 2px lift, nothing more. The flag flips on the
 * next frame rather than on an observer, so content can never be left
 * stuck invisible, and reduced motion drops the transition entirely.
 */
function Reveal({
  children,
  delay = 0,
  className,
  as: As = 'div',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'li';
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <As
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        'transition-[opacity,transform] duration-500 ease-[cubic-bezier(0,0,0.2,1)]',
        'motion-reduce:transition-none',
        shown ? 'opacity-100' : 'translate-y-0.5 opacity-0',
        className,
      )}
    >
      {children}
    </As>
  );
}
