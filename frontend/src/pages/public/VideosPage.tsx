import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { Search, Loader2, ChevronDown, MonitorPlay } from 'lucide-react';
import { catalogApi, type MediaHubTags } from '../../api/catalog';
import { Button, Card, Chip, chipKind, SectionHead } from '../../components/ui';
import { cn } from '../../lib/cn';
import { getShortClipId, getMediaHubThumbnail, shouldSurfaceCatalogClip } from '../../utils/clipUrl';
import { clipStripeSubtitle } from '../../utils/mediaHubClipText';
import { doctorLabelFromSlug } from '../../utils/doctorLabel';
import { ContentLibraryNavTabs } from '../../components/content/ContentLibraryNavTabs';
import { PlaylistSections } from '../../components/content/PlaylistSections';
import { ConversationsHero, ConversationsHeroSkeleton } from '../../components/content/ConversationsHero';
import { ConversationsClipCard } from '../../components/content/ConversationsClipCard';
import { ConversationRow, StripCard, StripRowLoading } from '../../components/home/ConversationRow';
import { BiomarkerConversationRow, BIOMARKER_CAROUSEL_IDS } from '../../components/content/BiomarkerConversationRow';
import {
  parsePlaylistFocus,
  playlistBrowseHeading as playlistBrowseHeadingText,
  PLAYLIST_FOCUS_TO_TAG,
  PUBLIC_CATALOG_PLAYLIST_NAV_FOCUS,
} from '../../utils/playlistFocusFilters';
import { PlaylistFocusNav } from '../../components/content/PlaylistFocusNav';
import { APP_CATALOG_CLIPS_GRID, APP_CATALOG_CONVERSATIONS_HUB } from '../../components/navigation/appNavItems';
import { getPublicLibraryViewFromSearch } from '../../utils/catalogBrowseLocation';
import { useWordPressCatalog, WORDPRESS_CATALOG_STALE_MS } from '../../utils/wordpressCatalog';

/**
 * Sort options surfaced in the catalog "Sort by" dropdown.
 * - `recorded_at`: orders by shoot date (Shoot.shoot_date with posted_at fallback).
 *   Distinct from `posted`: this is when the content was *recorded*, not when it
 *   was published to social media. Default UX choice for "what's new in the catalog".
 * - `posted`: orders by social-media post date (`posted_at`). Renamed in the UI from
 *   the older "Most recent" / "Recently posted" pair (which were byte-identical at
 *   the backend: see 2026-05-16 audit). The duplicate "Most recent" option has been
 *   removed; legacy `?sort=recent` URLs are redirected to `posted` below.
 * - `views`/`likes`: engagement-driven sorts.
 */
const SORT_OPTIONS = [
  { value: 'recorded_at', label: 'Recently recorded' },
  { value: 'posted', label: 'Recently posted' },
  { value: 'views', label: 'Most watched' },
  { value: 'likes', label: 'Most liked' },
];

/** Valid values for ?sort= / sort_by (MediaHub catalog API). */
const SORT_PARAM_VALUES = new Set(['views', 'likes', 'posted', 'recorded_at']);

/** Default sort the user lands on when no `?sort=` query param is present. */
const DEFAULT_SORT = 'recorded_at';

/**
 * Tag-namespace ordering + display labels for the grouped tag dropdown.
 * Backend `/api/catalog/tags` returns `Record<namespace, string[]>`; we render one
 * `<optgroup>` per namespace in this order. `doctor` is intentionally omitted, 
 * the "All doctors" dropdown sitting next to this control already covers it.
 */
const TAG_NAMESPACE_ORDER: { key: string; label: string }[] = [
  { key: 'biomarker', label: 'Biomarkers' },
  { key: 'stage', label: 'Stages' },
  { key: 'drug', label: 'Drugs' },
  { key: 'trial', label: 'Trials' },
  { key: 'topic', label: 'Topics' },
  { key: 'brand', label: 'Brands' },
];

/**
 * Client-side alias map: collapse equivalent tag values to a single canonical form
 * so the dropdown doesn't show both "TNBC" and "Triple Negative" as separate entries.
 * Canonical form picks the compact clinician-friendly code ("TNBC", "eBC", "mBC").
 */
const TAG_ALIASES: Record<string, string> = {
  'Triple Negative': 'TNBC',
  'triple negative': 'TNBC',
  'early breast cancer': 'eBC',
  'Early Breast Cancer': 'eBC',
  'metastatic breast cancer': 'mBC',
  'Metastatic Breast Cancer': 'mBC',
};

function stripNamespacePrefix(value: string): string {
  const idx = value.indexOf(':');
  if (idx === -1) return value;
  return value.slice(idx + 1);
}

function canonicalizeTag(value: string): string {
  return TAG_ALIASES[value] ?? value;
}

function groupTagsByNamespace(
  tags: MediaHubTags,
): { label: string; options: { value: string; label: string }[] }[] {
  const groups: { label: string; options: { value: string; label: string }[] }[] = [];
  for (const { key, label } of TAG_NAMESPACE_ORDER) {
    const raw = tags[key];
    if (!Array.isArray(raw) || raw.length === 0) continue;
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    for (const v of raw) {
      if (!v) continue;
      const stripped = stripNamespacePrefix(String(v));
      const canonical = canonicalizeTag(stripped);
      if (seen.has(canonical)) continue;
      seen.add(canonical);
      opts.push({ value: canonical, label: canonical });
    }
    opts.sort((a, b) => a.label.localeCompare(b.label));
    if (opts.length > 0) groups.push({ label, options: opts });
  }
  return groups;
}

function getDoctorOptions(doctors: { slug: string }[]): { value: string; label: string }[] {
  return doctors.map((d) => ({ value: d.slug, label: doctorLabelFromSlug(d.slug) }));
}

const SEARCH_DEBOUNCE_MS = 300;
const CLIPS_PAGE_SIZE = 24;

/**
 * The page rail. Its padding matches `--page-gutter`, so a scroller that
 * breaks out with `.bleed-x` still lines its first card up with the page.
 */
const RAIL = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8';
/** In the app shell the layout already pays the gutter, so the rail only caps width. */
const APP_RAIL = 'mx-auto w-full max-w-7xl';
/** The gutter on its own, for in-app sections the shell renders full width. */
const APP_GUTTER = 'px-4 sm:px-6 lg:px-8';
/** Space separates sections here; there are no rules between them. */
const BAND = 'py-14 md:py-20';
/** 2 → 3 → 4. Fewer, larger tiles with air between them. */
const CLIP_GRID = 'grid min-w-0 grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6';
/**
 * Every filter control is the same rectangular chip: a surface change plus
 * elevation, never a hairline, and a 6px corner rather than a pill.
 */
const CONTROL =
  'h-11 rounded-[6px] bg-card text-sm font-medium text-foreground shadow-card outline-none ' +
  'transition-[box-shadow,background-color] duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] ' +
  'hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

type ClipsPage = Awaited<ReturnType<typeof catalogApi.getClips>>;
type SortByParam = 'views' | 'likes' | 'posted' | 'recorded_at';

export default function VideosPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const isInApp = location.pathname.startsWith('/app');
  const basePath = isInApp ? '/app' : '';
  const wpMode = useWordPressCatalog();
  /** Server already filters with has_wordpress=true; do not require inline wordpress blob yet. */
  const clipSurfaceOpts = undefined;
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [sortBy, setSortBy] = useState<string>(DEFAULT_SORT);
  const [sortOpen, setSortOpen] = useState(false);

  // Ref so the filter-sync effect can read the current location without being
  // retriggered by navigation (which caused the playlists ↔ catalog ping-pong).
  const locationRef = useRef(location);
  useEffect(() => {
    locationRef.current = location;
  });

  const effectiveLibraryView: 'clips' | 'playlists' = useMemo(() => {
    if (isInApp) return new URLSearchParams(location.search).get('view') === 'playlists' ? 'playlists' : 'clips';
    return getPublicLibraryViewFromSearch(location.search || '');
  }, [isInApp, location.search]);

  // Apply URL → state (shared for /catalog and /app/catalog).
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qRaw = params.get('q') ?? '';
    setQuery(qRaw);
    setDebouncedQuery(qRaw.trim());
    setTagFilter(params.get('tag') ?? '');
    setDoctorFilter(params.get('doctor') ?? '');
    const sortRaw = params.get('sort') ?? params.get('sort_by') ?? '';
    // Back-compat: legacy `?sort=recent` was byte-identical to `?sort=posted` at
    // the backend (2026-05-16 audit). Redirect old links to `posted`.
    const sortNormalized = sortRaw === 'recent' ? 'posted' : sortRaw;
    setSortBy(SORT_PARAM_VALUES.has(sortNormalized) ? sortNormalized : DEFAULT_SORT);
  }, [location.search, isInApp]);

  useLayoutEffect(() => {
    const qs = location.search ?? '';
    const p = new URLSearchParams(qs.startsWith('?') ? qs.slice(1) : qs);
    if (p.get('view') !== 'playlists') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname, location.search]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Keep query string in sync with filter state only. Reads location via ref so
  // that tab navigation (which changes location.search) does NOT retrigger this
  // effect: preventing the playlists ↔ catalog ping-pong caused by stale filter
  // state being seen after a navigation but before the URL→state effect resets it.
  useEffect(() => {
    const loc = locationRef.current;
    const liveParams = new URLSearchParams(location.search.replace(/^\?/, ''));
    const params = new URLSearchParams();
    const q = query.trim();
    if (q) params.set('q', q);
    if (tagFilter) params.set('tag', tagFilter);
    if (doctorFilter) params.set('doctor', doctorFilter);
    // Only emit `?sort=` when it differs from the default: keeps URLs clean.
    if (sortBy && sortBy !== DEFAULT_SORT) params.set('sort', sortBy);

    const curParams = new URLSearchParams((loc.search || '').replace(/^\?/, ''));

    if (!isInApp) {
      // Always preserve the view already in the URL. Tab clicks own the view;
      // this effect only owns the filter params.
      const pv = curParams.get('view');
      const view: 'clips' | 'playlists' = pv === 'playlists' ? 'playlists' : 'clips';
      params.set('view', view);
      if (view === 'playlists') {
        const pf = parsePlaylistFocus('?' + curParams.toString());
        if (pf) params.set('playlistFocus', pf);
      }
    } else if (isInApp) {
      // Use live URL for view= so typing search never drops ?view=clips (locationRef can lag).
      const pv = liveParams.get('view') ?? curParams.get('view');
      const filterActive =
        !!q || !!tagFilter || !!doctorFilter || (sortBy && sortBy !== DEFAULT_SORT);
      if (pv === 'playlists') {
        params.set('view', 'playlists');
        const pfSource = liveParams.toString() || curParams.toString();
        const pfApp = parsePlaylistFocus('?' + pfSource);
        if (pfApp) params.set('playlistFocus', pfApp);
      } else if (pv === 'clips' || filterActive) {
        params.set('view', 'clips');
      }
    }

    const next = params.toString();
    const cur = location.search.replace(/^\?/, '');
    if (next === cur) return;
    navigate({ pathname: location.pathname, search: next ? `?${next}` : '' }, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tagFilter, doctorFilter, sortBy, isInApp, navigate, location.search]);
  const { data: tags = {}, isSuccess: tagsReady } = useQuery({
    queryKey: ['catalog', 'tags'],
    queryFn: catalogApi.getTags,
    staleTime: WORDPRESS_CATALOG_STALE_MS,
    enabled: !wpMode,
  });

  const { data: doctors = [], isSuccess: doctorsReady } = useQuery({
    queryKey: ['catalog', 'doctors'],
    queryFn: catalogApi.getDoctors,
    staleTime: WORDPRESS_CATALOG_STALE_MS,
    enabled: !wpMode,
  });

  const tagGroups = useMemo(() => groupTagsByNamespace(tags), [tags]);
  const doctorOptions = useMemo(() => getDoctorOptions(doctors), [doctors]);
  /** WordPress catalog: clips load without waiting on MediaHub tags/doctors. */
  const useMediaHub = wpMode || (tagsReady && doctorsReady);

  const { data: playlists = [] } = useQuery({
    queryKey: ['catalog', 'playlists'],
    queryFn: catalogApi.getPlaylists,
    staleTime: WORDPRESS_CATALOG_STALE_MS,
  });

  const playlistFocus = useMemo(() => parsePlaylistFocus(location.search || ''), [location.search]);
  const focusTag = playlistFocus ? PLAYLIST_FOCUS_TO_TAG[playlistFocus] : null;

  const {
    data: focusClipsData,
    isLoading: focusClipsLoading,
    isError: focusClipsError,
  } = useQuery({
    queryKey: ['catalog', 'clips', 'playlist-focus', playlistFocus, focusTag],
    queryFn: () =>
      catalogApi.getClips({
        tag: focusTag!,
        sort_by: 'recorded_at',
        limit: 48,
        ...(wpMode ? { has_wordpress: true } : {}),
      }),
    enabled: !!playlistFocus && !!focusTag && effectiveLibraryView === 'playlists' && useMediaHub,
    staleTime: WORDPRESS_CATALOG_STALE_MS,
  });

  const focusClips = useMemo(
    () => (focusClipsData?.items ?? []).filter((c) => shouldSurfaceCatalogClip(c, clipSurfaceOpts)),
    [focusClipsData?.items],
  );

  const {
    data: rawClipsData,
    isLoading: clipsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<
    ClipsPage,
    Error,
    InfiniteData<ClipsPage, number>,
    readonly [string, string, string, string, string, string],
    number
  >({
    queryKey: ['catalog', 'clips', debouncedQuery, tagFilter, doctorFilter, sortBy, wpMode ? 'wp' : 'legacy'],
    queryFn: ({ pageParam = 0 }) =>
      catalogApi.getClips({
        q: debouncedQuery || undefined,
        tag: tagFilter || undefined,
        doctor: doctorFilter || undefined,
        sort_by: sortBy ? (sortBy as SortByParam) : undefined,
        limit: CLIPS_PAGE_SIZE,
        offset: pageParam,
        ...(wpMode ? { has_wordpress: true } : {}),
      }),
    getNextPageParam: (lastPage, allPages) => {
      const lastItems = lastPage?.items ?? [];
      // Full page ⇒ assume more exist. Do not trust `total` when it equals
      // the page size (ContentHub currently returns total === items.length).
      if (lastItems.length < CLIPS_PAGE_SIZE) return undefined;
      const loaded = allPages.reduce((acc, p) => acc + (p?.items?.length ?? 0), 0);
      const total = lastPage?.total ?? 0;
      if (total > CLIPS_PAGE_SIZE && loaded >= total) return undefined;
      return loaded;
    },
    initialPageParam: 0,
    enabled: useMediaHub && effectiveLibraryView === 'clips',
    staleTime: WORDPRESS_CATALOG_STALE_MS,
  });

  const clipsData: InfiniteData<ClipsPage, number> | undefined =
    rawClipsData as unknown as InfiniteData<ClipsPage, number> | undefined;
  const clipsPageCount = clipsData?.pages.length ?? 0;

  const loadMoreRef = useRef<HTMLDivElement>(null);

  // In-app full library grid only at ?view=clips (“See all in library”). Default /app/catalog = strip home.
  const showClipsGrid =
    isInApp && new URLSearchParams(location.search).get('view') === 'clips';

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (
        target?.isIntersecting &&
        hasNextPage &&
        !isFetchingNextPage &&
        !clipsLoading &&
        clipsPageCount > 0
      ) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage, clipsLoading, clipsPageCount],
  );

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const clipsPagerActive =
      effectiveLibraryView === 'clips' && (!isInApp || showClipsGrid);
    // Wait until the first page is on screen before observing, so an empty
    // first paint can't chain-load every offset.
    if (!clipsPagerActive || clipsLoading || clipsPageCount === 0) return;
    const observer = new IntersectionObserver(handleObserver, {
      rootMargin: '200px',
      threshold: 0,
    });
    // Defer observe one frame so the sentinel isn't treated as "already
    // intersecting" during the initial layout of page 1.
    const raf = requestAnimationFrame(() => observer.observe(el));
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [effectiveLibraryView, handleObserver, isInApp, showClipsGrid, clipsLoading, clipsPageCount]);

  const mediaHubItems = useMemo(
    () =>
      (clipsData?.pages?.flatMap((p) => p?.items ?? []) ?? []).filter((c) =>
        shouldSurfaceCatalogClip(c, clipSurfaceOpts),
      ),
    [clipsData?.pages],
  );

  const displayItems = useMediaHub ? mediaHubItems : [];
  const isLoading = useMediaHub ? clipsLoading : false;

  const firstPageItems = (clipsData?.pages?.[0]?.items ?? []).filter((c) =>
    shouldSurfaceCatalogClip(c, clipSurfaceOpts),
  );
  const featuredClip = firstPageItems[0] ?? null;
  const gridItems = useMemo(
    () => (featuredClip ? displayItems.filter((c) => c.id !== featuredClip.id) : displayItems),
    [displayItems, featuredClip],
  );

  const isInitialClipsLoad =
    useMediaHub && effectiveLibraryView === 'clips' && clipsLoading && clipsPageCount === 0;
  const newestItems = useMemo(() => gridItems.slice(0, 14), [gridItems]);
  const filterOrSortActive = !!(
    debouncedQuery.trim() || tagFilter || doctorFilter || (sortBy && sortBy !== DEFAULT_SORT)
  );

  const playlistDescription = (p: (typeof playlists)[0]) =>
    p.videoNames?.slice(0, 3).join(' • ') || `${p.videoCount} video${p.videoCount !== 1 ? 's' : ''}`;

  const playlistsCarouselStrip =
    playlists.length > 0 ? (
      <section className="space-y-0">
        <ConversationRow
          title="Playlists"
          subtitle={`${playlists.length} curated ${playlists.length === 1 ? 'list' : 'lists'}`}
          seeAllHref={isInApp ? '/app/catalog?view=playlists' : '/catalog?view=playlists'}
          seeAllLabel="See all playlists"
        >
          {playlists.slice(0, 12).map((p) => (
            <StripCard
              key={p.id}
              to={isInApp ? `/app/catalog/playlist/${p.id}` : `/catalog/playlist/${p.id}`}
              title={p.title}
              imageUrl={p.thumbnailUrl || 'https://via.placeholder.com/400x260?text=Playlist'}
              description={playlistDescription(p)}
              videoLabel={
                p.videoCount != null && p.videoCount > 0
                  ? `${p.videoCount.toLocaleString()} video${p.videoCount !== 1 ? 's' : ''}`
                  : p.videoNames && p.videoNames.length > 0
                    ? `${p.videoNames.length} video${p.videoNames.length !== 1 ? 's' : ''}`
                    : undefined
              }
            />
          ))}
        </ConversationRow>
      </section>
    ) : null;

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Sort by';

  /**
   * One line of copy under the playlist heading. Same three states the
   * inline markup carried before, lifted out so `SectionHead` can take it.
   */
  const playlistsSub = playlistFocus
    ? focusClipsLoading
      ? 'Loading conversations…'
      : focusClips.length > 0
        ? `${focusClips.length} conversation${focusClips.length !== 1 ? 's' : ''}`
        : 'No conversations in this category yet'
    : 'Browse KOL playlists and ASCO 2026 series';

  /* Filters read as a row of rectangular chips. Each control is carried by
     elevation on a surface change; nothing here draws a hairline. */
  const libraryControls = (
    <div className="mt-8 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
      <div className="relative min-w-[15rem] flex-1 md:max-w-sm">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          aria-label="Search the catalogue"
          className={cn(CONTROL, 'w-full pl-11 pr-4 font-normal placeholder:text-muted-foreground')}
        />
      </div>

      {!wpMode ? (
        <>
          <div className="relative">
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              aria-label="Filter by tag"
              className={cn(CONTROL, 'w-full min-w-[10rem] appearance-none pl-4 pr-10 md:w-auto')}
            >
              <option value="">All tags</option>
              {tagGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((opt) => (
                    <option key={`${group.label}:${opt.value}`} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
          </div>

          <div className="relative">
            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              aria-label="Filter by doctor"
              className={cn(CONTROL, 'w-full min-w-[10rem] appearance-none pl-4 pr-10 md:w-auto')}
            >
              <option value="">All doctors</option>
              {doctorOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
          </div>
        </>
      ) : null}

      <div className="relative">
        <button
          type="button"
          onClick={() => setSortOpen(!sortOpen)}
          aria-expanded={sortOpen}
          className={cn(
            CONTROL,
            'inline-flex w-full min-w-[10rem] items-center justify-between gap-2 px-4 md:w-auto',
            'motion-safe:active:scale-[0.96]',
          )}
        >
          {sortLabel}
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform duration-150 ${sortOpen ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
        {sortOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} aria-hidden />
            <div className="absolute right-0 top-full z-20 mt-2 min-w-[11rem] rounded-card bg-card p-1 shadow-card-hover">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setSortBy(opt.value);
                    setSortOpen(false);
                  }}
                  className={cn(
                    'block w-full rounded-[6px] px-3 py-2 text-left text-sm transition-colors duration-150',
                    sortBy === opt.value
                      ? 'bg-muted font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );

  /* What the grid below is actually filtered by, said back in colour:
     the tag takes its kind, so the scheme holds as the vocabulary grows. */
  const activeFilterChips = filterOrSortActive ? (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {debouncedQuery ? <Chip>Search: {debouncedQuery}</Chip> : null}
      {tagFilter ? <Chip kind={chipKind(tagFilter)}>{tagFilter}</Chip> : null}
      {doctorFilter ? <Chip kind="setting">{doctorLabelFromSlug(doctorFilter)}</Chip> : null}
      {sortBy !== DEFAULT_SORT ? <Chip>{sortLabel}</Chip> : null}
    </div>
  ) : null;

  const libraryHead = (
    <>
      <SectionHead
        index="01 / Library"
        title="Video library"
        action={
          useMediaHub && displayItems.length > 0 ? (
            <p className="text-label uppercase tabular-nums text-muted-foreground">
              {displayItems.length} video{displayItems.length !== 1 ? 's' : ''}
            </p>
          ) : undefined
        }
      />
      {useMediaHub ? libraryControls : null}
      {useMediaHub ? activeFilterChips : null}
    </>
  );

  const loadMoreSentinel = useMediaHub ? (
    <div ref={loadMoreRef} className="flex justify-center py-10">
      {isFetchingNextPage && <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />}
    </div>
  ) : null;

  return (
    /* The public shell paints its own cool grey, which sits a hair off
       bg-card and would leave every chip and card invisible on it. The page
       carries the background token so the surfaces separate. */
    <div className={cn('min-h-screen min-w-0', isInApp ? 'bg-transparent' : 'bg-background')}>
      {/* ── Hero ──────────────────────────────────────────────────
          A permanently dark band, so the white here is fixed rather
          than tokenised: the page-following tokens would resolve to
          dark grey on black in light mode. */}
      {effectiveLibraryView === 'clips' && !isInApp ? (
        <section
          aria-labelledby="catalogue-heading"
          className="relative isolate overflow-hidden bg-zinc-950"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(104deg, transparent 24%, hsl(var(--cerebral-blue) / 0.30) 46%, hsl(var(--cerebral-cyan) / 0.18) 58%, transparent 78%)',
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(72% 72% at 10% 100%, rgb(9 9 11 / 0.08) 28%, rgb(9 9 11 / 0.9) 100%)',
              }}
            />
          </div>

          <div
            className={cn(
              RAIL,
              'relative flex min-h-[16rem] flex-col justify-end py-16 md:min-h-[20rem] md:py-24',
            )}
          >
            <p className="home-enter text-label uppercase text-white/60">Content library</p>
            <h1
              id="catalogue-heading"
              className="home-enter mt-4 flex items-center gap-3 text-balance text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.028em] text-white sm:text-[3rem]"
              style={{ animationDelay: '60ms' }}
            >
              <MonitorPlay
                className="hidden h-9 w-9 shrink-0 text-white/70 sm:block"
                strokeWidth={1.5}
                aria-hidden
              />
              Explore our catalogue
            </h1>
          </div>
        </section>
      ) : null}

      {/* ── Sections ── the three ways into the library, under the hero */}
      {effectiveLibraryView === 'clips' && !isInApp ? (
        <div className={cn(RAIL, 'home-enter pt-12 md:pt-16')} style={{ animationDelay: '120ms' }}>
          <ContentLibraryNavTabs isInApp={isInApp} />
        </div>
      ) : null}

      <div className={isInApp && !showClipsGrid ? 'w-full space-y-12 md:space-y-16' : ''}>
        {effectiveLibraryView === 'clips' && useMediaHub && isInitialClipsLoad && isInApp && !showClipsGrid && (
          <section className="-mx-4 -mt-6 sm:-mx-6 sm:-mt-8 lg:-mx-8 lg:-mt-8">
            <ConversationsHeroSkeleton />
          </section>
        )}

        {effectiveLibraryView === 'clips' && useMediaHub && !isInitialClipsLoad && featuredClip && isInApp && !showClipsGrid && (
          <section className="-mx-4 -mt-6 sm:-mx-6 sm:-mt-8 lg:-mx-8 lg:-mt-8">
            <ConversationsHero clip={featuredClip} isInApp={isInApp} />
          </section>
        )}

        {effectiveLibraryView === 'playlists' ? (
          /* ── Playlists ── */
          <section aria-label="Playlists">
            <div className={cn(isInApp ? `w-full ${APP_GUTTER}` : RAIL, BAND)}>
              <SectionHead
                index="01 / Playlists"
                title={playlistBrowseHeadingText(playlistFocus)}
                sub={playlistsSub}
                action={
                  !isInApp ? (
                    <Button to="/catalog?view=clips" variant="outline" size="sm">
                      Browse conversations
                    </Button>
                  ) : undefined
                }
              />

              <div className="mt-8">
                <PlaylistFocusNav
                  isInApp={isInApp}
                  allowedPlaylistFocusFilters={isInApp ? undefined : PUBLIC_CATALOG_PLAYLIST_NAV_FOCUS}
                />
              </div>

              <div className="mt-8 md:mt-10">
                {playlistFocus ? (
                  focusClipsLoading ? (
                    <div className="flex justify-center py-16" aria-busy="true">
                      <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                    </div>
                  ) : focusClipsError ? (
                    <Card className="px-6 py-14 text-center">
                      <p className="text-destructive">Could not load conversations. Try again later.</p>
                    </Card>
                  ) : focusClips.length > 0 ? (
                    <div className={CLIP_GRID}>
                      {focusClips.map((item) => (
                        <ConversationsClipCard
                          key={item.id}
                          item={item}
                          href={
                            isInApp
                              ? `/app/clip/${getShortClipId(item.id)}`
                              : `/catalog/clip/${getShortClipId(item.id)}`
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <Card className="px-6 py-14 text-center">
                      <p className="text-pretty text-muted-foreground">
                        No conversations match this category yet.
                      </p>
                    </Card>
                  )
                ) : (
                  <>
                    <PlaylistSections playlists={playlists} isInApp={isInApp} />
                    {playlists.length === 0 ? (
                      <Card className="px-6 py-14 text-center">
                        <p className="text-pretty text-muted-foreground">
                          No playlists configured. Add YouTube playlist IDs on the server.
                        </p>
                      </Card>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </section>
        ) : isInApp && showClipsGrid ? (
          /* ── /app/catalog?view=clips: the full searchable grid ── */
          <section aria-label="Video library">
            <div className={cn(APP_RAIL, 'pb-12 pt-2')}>
              {libraryHead}
              <div className="mt-10">
                <div className={CLIP_GRID}>
                  {!useMediaHub ? (
                    <Card className="col-span-full px-6 py-16 text-center">
                      <p className="text-pretty text-muted-foreground">Video catalog is not connected.</p>
                    </Card>
                  ) : useMediaHub && isLoading && displayItems.length === 0 ? (
                    <div className="col-span-full flex items-center justify-center py-16">
                      <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                    </div>
                  ) : useMediaHub && displayItems.length === 0 ? (
                    <Card className="col-span-full px-6 py-16 text-center">
                      <p className="text-pretty text-muted-foreground">No results match.</p>
                      <p className="mt-2 text-pretty text-sm text-muted-foreground">
                        Change search or filters and try again.
                      </p>
                    </Card>
                  ) : (
                    displayItems.map((item) => (
                      <ConversationsClipCard
                        key={item.id}
                        item={item}
                        href={`/app/clip/${getShortClipId(item.id)}`}
                      />
                    ))
                  )}
                </div>
              </div>
              {loadMoreSentinel}
            </div>
          </section>
        ) : isInApp ? (
          /* ── /app/catalog: the strip home ── */
          <section className="space-y-14 md:space-y-16" aria-label="Video library">
            {!useMediaHub && playlists.length === 0 ? (
              <Card className="px-6 py-16 text-center">
                <p className="text-pretty text-muted-foreground">
                  Video catalog needs a MediaHub API key or playlists.
                </p>
                <p className="mt-2 text-pretty text-sm text-muted-foreground">
                  Set mediahub_api_key or youtube_playlist_ids in the backend.
                </p>
                <div className="mt-6 flex justify-center">
                  <Button to={APP_CATALOG_CLIPS_GRID} variant="outline">
                    Browse catalog
                  </Button>
                </div>
              </Card>
            ) : !useMediaHub && playlists.length > 0 ? (
              <>
                {playlistsCarouselStrip}
                <Card className="px-6 py-14 text-center">
                  <p className="mx-auto max-w-[54ch] text-pretty text-muted-foreground">
                    MediaHub is not connected. Add API keys in the server to load the featured banner
                    and conversation rows.
                  </p>
                </Card>
              </>
            ) : useMediaHub && isLoading && displayItems.length === 0 ? (
              <>
                <ConversationRow title="Loading conversations" seeAllHref={APP_CATALOG_CLIPS_GRID}>
                  <StripRowLoading />
                </ConversationRow>
                <ConversationRow title="Browse by series" seeAllHref={APP_CATALOG_CLIPS_GRID}>
                  <StripRowLoading />
                </ConversationRow>
                {playlistsCarouselStrip}
              </>
            ) : useMediaHub && displayItems.length === 0 ? (
              <>
                {playlistsCarouselStrip}
                <Card className="px-6 py-14 text-center">
                  <p className="text-pretty text-muted-foreground">No results match.</p>
                  <p className="mt-2 text-pretty text-sm text-muted-foreground">
                    Change search or filters and try again.
                  </p>
                </Card>
                {BIOMARKER_CAROUSEL_IDS.map((id) => (
                  <BiomarkerConversationRow key={id} carouselId={id} isInApp={true} />
                ))}
              </>
            ) : (
              <>
                {newestItems.length > 0 ? (
                  <ConversationRow
                    title={filterOrSortActive ? 'Matching videos' : 'Recently added'}
                    subtitle={`${newestItems.length} videos`}
                    seeAllHref={APP_CATALOG_CLIPS_GRID}
                  >
                    {newestItems.map((item) => (
                      <StripCard
                        key={`new-${item.id}`}
                        to={`/app/clip/${getShortClipId(item.id)}`}
                        title={item.title}
                        imageUrl={getMediaHubThumbnail(item)}
                        description={clipStripeSubtitle(item) || 'Conversation'}
                      />
                    ))}
                  </ConversationRow>
                ) : null}
                {playlistsCarouselStrip}
                {BIOMARKER_CAROUSEL_IDS.map((id) => (
                  <BiomarkerConversationRow key={id} carouselId={id} isInApp={true} />
                ))}
              </>
            )}
          </section>
        ) : (
          /* ── /catalog: the public library ── */
          <section aria-label="Video library">
            <div
              className={cn(RAIL, 'home-enter pb-20 pt-12 md:pb-28 md:pt-16')}
              style={{ animationDelay: '180ms' }}
            >
              {libraryHead}
              <div className="mt-10 md:mt-12">
                <div className={CLIP_GRID}>
                  {!useMediaHub && playlists.length === 0 ? (
                    <Card className="col-span-full px-6 py-16 text-center">
                      <p className="text-pretty text-muted-foreground">
                        Video catalog needs a MediaHub API key or playlists.
                      </p>
                      <p className="mt-2 text-pretty text-sm text-muted-foreground">
                        Set mediahub_api_key or youtube_playlist_ids in the backend.
                      </p>
                      <div className="mt-6 flex justify-center">
                        <Button to="/catalog?view=clips" variant="outline">
                          Browse catalog
                        </Button>
                      </div>
                    </Card>
                  ) : !useMediaHub && playlists.length > 0 ? (
                    <Card className="col-span-full px-6 py-16 text-center">
                      <p className="mx-auto max-w-[54ch] text-pretty text-muted-foreground">
                        MediaHub is not connected. Add API keys in the server to load the featured
                        banner and conversation grid.
                      </p>
                      <div className="mt-6 flex justify-center">
                        <Button to="/catalog?view=clips" variant="outline">
                          Open catalog
                        </Button>
                      </div>
                    </Card>
                  ) : useMediaHub && isLoading && displayItems.length === 0 ? (
                    <div className="col-span-full flex items-center justify-center py-16">
                      <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                    </div>
                  ) : useMediaHub && displayItems.length === 0 ? (
                    <Card className="col-span-full px-6 py-16 text-center">
                      <p className="text-pretty text-muted-foreground">No results match.</p>
                      <p className="mt-2 text-pretty text-sm text-muted-foreground">
                        Change search or filters and try again.
                      </p>
                    </Card>
                  ) : (
                    displayItems.map((item) => {
                      const detailUrl = isInApp
                        ? `/app/clip/${getShortClipId(item.id)}`
                        : `/catalog/clip/${getShortClipId(item.id)}`;
                      return <ConversationsClipCard key={item.id} item={item} href={detailUrl} />;
                    })
                  )}
                </div>
              </div>
              {loadMoreSentinel}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
