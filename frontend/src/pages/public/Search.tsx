import { useMemo, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search as SearchIcon, SlidersHorizontal, X, Loader2 } from 'lucide-react';
import { catalogApi } from '../../api/catalog';
import { getShortClipId, shouldSurfaceCatalogClip } from '../../utils/clipUrl';
import { clipStripeSubtitle } from '../../utils/mediaHubClipText';

type ResultType = 'Video' | 'Webinar' | 'Collection';

type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  type: ResultType;
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

  return (
    <div className="bg-card">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12 md:py-16 space-y-8">
        <header className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">Explore catalog</h1>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-2xl">
            Quick clip search (type at least 2 characters for live catalog matches). For filters and playlists, open
            the{' '}
            <Link to="/catalog" className="font-semibold text-foreground underline underline-offset-2">
              content library
            </Link>
            .
          </p>
        </header>

        <section className="space-y-4">
          <form
            className="flex flex-col md:flex-row md:items-center gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              applyUrl();
            }}
          >
            <div className="flex-1 relative">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by condition, speaker, topic…"
                className="w-full rounded-card border border-border bg-card pl-11 pr-12 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gray-200"
              />

              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setSearchParams({}, { replace: true });
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full hover:bg-muted flex items-center justify-center"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              ) : null}
            </div>

            <button
              type="submit"
              className="rounded-card bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Search
            </button>

            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="rounded-card border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground hover:bg-muted inline-flex items-center gap-2"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </button>
          </form>

          {showFilters ? (
            <div className="rounded-card border border-border bg-card p-5 space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Type</p>
                <div className="flex flex-wrap gap-2">
                  {TYPE_FILTERS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={[
                        'rounded-[6px] px-4 py-2 text-sm font-semibold border',
                        type === t
                          ? 'bg-brand-600 text-white border-foreground'
                          : 'bg-card text-foreground border-border hover:bg-muted',
                      ].join(' ')}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setType('All');
                    setQuery('');
                    setSearchParams({}, { replace: true });
                  }}
                  className="rounded-[6px] border border-border bg-card px-5 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className="rounded-[6px] bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Apply
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <p>
              Showing <span className="font-semibold text-foreground">{filtered.length}</span> results
            </p>
            {debouncedQ.length >= 2 && apiLoading && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching catalog…
              </span>
            )}
            {debouncedQ.length >= 2 && apiError && (
              <span className="text-warning">Catalog search unavailable: showing curated matches only.</span>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <div className="rounded-card border border-border bg-card overflow-hidden">
            <div className="divide-y divide-gray-200">
              {filtered.map((r) => (
                <Link key={r.id} to={r.href} className="block px-5 py-4 hover:bg-muted">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{r.title}</p>
                      <p className="text-sm text-muted-foreground truncate">{r.subtitle}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Pill label={r.type} />
                        {r.tag ? <Pill label={r.tag} muted /> : null}
                      </div>
                    </div>

                    <span className="shrink-0 text-muted-foreground">→</span>
                  </div>
                </Link>
              ))}

              {filtered.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-base font-semibold text-foreground">No results found</p>
                  <p className="mt-1 text-sm text-muted-foreground">Try a different search term or reset filters.</p>
                  <div className="mt-6 flex justify-center gap-3">
                    <Link
                      to="/catalog"
                      className="rounded-[6px] border border-border bg-card px-7 py-3 text-sm font-semibold text-foreground hover:bg-muted"
                    >
                      Browse Catalogue
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setType('All');
                        setQuery('');
                        setSearchParams({}, { replace: true });
                      }}
                      className="rounded-[6px] bg-brand-600 px-7 py-3 text-sm font-semibold text-white hover:bg-brand-700"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Pill({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-[6px] px-3 py-1 text-xs font-semibold border',
        muted
          ? 'bg-muted text-muted-foreground border-border'
          : 'bg-card text-foreground border-border',
      ].join(' ')}
    >
      {label}
    </span>
  );
}
