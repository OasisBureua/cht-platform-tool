import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowRight, Loader2, Play, Search } from 'lucide-react';
import { catalogApi, type MediaHubClip } from '../../api/catalog';
import { ChmMark } from '../../components/brand/ChmMark';
import { Button } from '../../components/ui';
import DISEASE_AREAS from '../../data/disease-areas';
import {
  extractYoutubeVideoIdFromUrl,
  getMediaHubThumbnail,
  getShortClipId,
  nextCatalogThumbnailFallback,
  shouldSurfaceCatalogClip,
} from '../../utils/clipUrl';
import { doctorLabelFromSlug } from '../../utils/doctorLabel';
import {
  WORDPRESS_CATALOG_STALE_MS,
  formatWordPressCategoryLabel,
  sortWordPressCategories,
  useWordPressCatalog,
} from '../../utils/wordpressCatalog';

/* ── the facets the library narrows by ─────────────────────────────────
   Search first, then the two taxonomies the brief calls for (format and
   disease state) narrowing the same grid at once. */

type FormatKey = 'all' | 'video' | 'podcast' | 'editorial';

const FORMATS: { key: FormatKey; label: string }[] = [
  { key: 'all', label: 'All formats' },
  { key: 'video', label: 'Video' },
  { key: 'podcast', label: 'Podcast' },
  { key: 'editorial', label: 'Editorial' },
];

/**
 * The catalogue carries video today, so format is read off the clip
 * itself: a full conversation, or one with a published written explainer
 * behind it. Podcast has no source in the catalogue yet and returns
 * nothing, which is exactly what the empty state below says.
 */
function matchesFormat(clip: MediaHubClip, format: FormatKey): boolean {
  if (format === 'all') return true;
  if (format === 'video') return !clip.is_short;
  if (format === 'editorial') return !!clip.wordpress?.permalink;
  return false;
}

/** Valid values for ?sort= / sort_by (MediaHub catalog API). */
const SORT_PARAM_VALUES = new Set(['views', 'likes', 'posted', 'recorded_at']);
/** Default sort the user lands on when no `?sort=` query param is present. */
const DEFAULT_SORT = 'recorded_at';
type SortByParam = 'views' | 'likes' | 'posted' | 'recorded_at';

const SEARCH_DEBOUNCE_MS = 300;
const CLIPS_PAGE_SIZE = 24;

/**
 * Collapse equivalent tag values to a single canonical form so the chip
 * row doesn't show both "TNBC" and "Triple Negative" as separate entries.
 */
const TAG_ALIASES: Record<string, string> = {
  'Triple Negative': 'TNBC',
  'triple negative': 'TNBC',
  'early breast cancer': 'eBC',
  'Early Breast Cancer': 'eBC',
  'metastatic breast cancer': 'mBC',
  'Metastatic Breast Cancer': 'mBC',
};

function tagLabel(value: string): string {
  const idx = value.indexOf(':');
  const stripped = idx === -1 ? value : value.slice(idx + 1);
  return TAG_ALIASES[stripped] ?? stripped;
}

/* Every filter control is the same rectangular chip: a surface change
   plus elevation, never a hairline, and a 6px corner rather than a pill. */
const CHIP = 'press inline-flex h-10 items-center rounded-[6px] px-4 text-body-s';
const CHIP_ON = 'bg-inverse text-ground shadow-card';
const CHIP_OFF =
  'bg-surface text-dim shadow-card hover:bg-ground hover:text-text hover:shadow-card-hover';

/** The design's button type: mono label, 6px corner, 44px tall. */
const BTN = 'press px-6 font-mono text-[0.875rem] font-normal tracking-[-0.011em]';

function clipDuration(seconds: number | undefined): string | undefined {
  if (!seconds || seconds <= 0) return undefined;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** YouTube serves a 120×90 gray box (HTTP 200) for missing videos: treat as failure. */
function isYoutubeMissingPoster(img: HTMLImageElement): boolean {
  return img.naturalWidth > 0 && img.naturalWidth <= 120 && img.naturalHeight <= 90;
}

/**
 * The poster. Permanently dark under the gradient, so the label colours
 * here are fixed white rather than the page-following tokens. Falls back
 * through the YouTube poster sizes when ContentHub sends a 404ing URL.
 */
function Thumb({
  clip,
  className = '',
  rounded = 'rounded-[6px]',
}: {
  clip: MediaHubClip;
  className?: string;
  rounded?: string;
}) {
  const short = getShortClipId(clip.id);
  const videoId =
    extractYoutubeVideoIdFromUrl(clip.youtube_url) ||
    (/^[a-zA-Z0-9_-]{11}$/.test(short) ? short : null);
  const [src, setSrc] = useState(() => getMediaHubThumbnail(clip));

  useEffect(() => {
    setSrc(getMediaHubThumbnail(clip));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.id, clip.thumbnail_url, clip.youtube_url]);

  const advance = (current: string) => {
    const next = nextCatalogThumbnailFallback(current, videoId);
    if (next) setSrc(next);
  };

  const duration = clipDuration(clip.duration_seconds);

  return (
    <div className={`relative overflow-hidden bg-surface-2 ${rounded} ${className}`}>
      <img
        src={src}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        draggable={false}
        onError={() => advance(src)}
        onLoad={(e) => {
          if (isYoutubeMissingPoster(e.currentTarget)) advance(src);
        }}
        className="absolute inset-0 size-full object-cover opacity-90 transition-[scale,opacity] duration-300 ease-[var(--ease-out-strong)] group-hover:scale-[1.03] group-hover:opacity-100"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
      <div className="img-ring absolute inset-0 rounded-[inherit]" />
      <ChmMark className="absolute bottom-3 start-3 size-5 text-white/80" />
      {duration ? (
        <span className="meta absolute end-3 bottom-3 text-white/80">{duration}</span>
      ) : null}
    </div>
  );
}

function FormatBadge({ clip }: { clip: MediaHubClip }) {
  return (
    <span className="eyebrow inline-flex h-6 items-center rounded-[6px] bg-ground/70 px-3 text-text backdrop-blur-sm">
      {clip.is_short ? 'clip' : 'video'}
    </span>
  );
}

/**
 * Shared frame for the hero visual: a raised panel on a soft brand-tinted
 * field, with a bevel highlight along the top edge. Depth only, no outlines.
 */
function HeroPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 rounded-[24px] opacity-80 blur-2xl"
        style={{
          background:
            'radial-gradient(50% 50% at 70% 30%, color-mix(in oklab, var(--color-beam) 34%, transparent), transparent 70%), radial-gradient(45% 45% at 25% 75%, color-mix(in oklab, var(--color-pink) 30%, transparent), transparent 70%)',
        }}
      />
      <div className="relative overflow-hidden rounded-[6px] bg-surface p-3 shadow-pop">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
        />
        <div className="overflow-hidden rounded-[6px] bg-ground">{children}</div>
      </div>
    </div>
  );
}

/**
 * Featured video carousel: three items, auto-advancing, with dots to
 * jump. Advancing pauses on hover and under reduced motion, and each
 * slide is a real link so the featured item is always reachable.
 */
function FeaturedCarousel({
  clips,
  hrefFor,
}: {
  clips: MediaHubClip[];
  hrefFor: (clip: MediaHubClip) => string;
}) {
  const slides = clips.slice(0, 3);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setI((v) => (v + 1) % slides.length), 6000);
    return () => clearInterval(id);
  }, [paused, slides.length]);

  const idx = slides.length > 0 ? Math.min(i, slides.length - 1) : -1;
  const active = idx >= 0 ? slides[idx] : null;

  if (!active) {
    return (
      <HeroPanel>
        <div className="p-3">
          <div className="aspect-video w-full rounded-[6px] bg-surface-2" />
          <div className="mt-4 h-1.5 w-full rounded-[6px] bg-surface-2" />
        </div>
      </HeroPanel>
    );
  }

  const lead = active.doctors?.[0] ? doctorLabelFromSlug(active.doctors[0]) : null;

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <HeroPanel>
        <div className="p-3">
          <Link
            to={hrefFor(active)}
            state={{ clip: active }}
            className="press group block"
            aria-label={`Featured: ${active.title}`}
          >
            <span className="relative block">
              <Thumb
                key={active.id}
                clip={active}
                className="aspect-video w-full motion-safe:animate-[fadeSlideUp_320ms_var(--ease-out-soft)_both]"
              />
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid size-14 place-items-center rounded-[6px] bg-ground/90 text-anchor shadow-card transition-[scale] duration-150 ease-[var(--ease-standard)] group-hover:scale-105">
                  <Play className="size-6 translate-x-px" fill="currentColor" strokeWidth={0} />
                </span>
              </span>
            </span>

            <span className="mt-4 block px-1">
              <span className="eyebrow text-amber-ink">
                Featured · {idx + 1} of {slides.length}
              </span>
              <span className="display mt-2 block text-body-l text-text group-hover:text-anchor">
                {active.title}
              </span>
              {lead ? (
                <span className="meta mt-2 flex items-center gap-2 text-faint">
                  {lead}
                  <ArrowRight
                    className="size-3.5 transition-[translate] duration-150 ease-[var(--ease-standard)] group-hover:translate-x-1"
                    strokeWidth={1.75}
                  />
                </span>
              ) : null}
            </span>
          </Link>

          <div className="mt-4 flex gap-2 px-1 pb-1">
            {slides.map((s, n) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setI(n)}
                aria-label={`Show featured video ${n + 1}: ${s.title}`}
                aria-current={n === idx}
                className="press -my-2.5 flex h-6 flex-1 items-center py-2.5"
              >
                <span
                  aria-hidden
                  className="block h-1.5 w-full rounded-[6px] transition-[background-color] duration-150"
                  style={{
                    background: n === idx ? 'var(--color-anchor)' : 'var(--color-surface-2)',
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      </HeroPanel>
    </div>
  );
}

export default function VideosPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const isInApp = location.pathname.startsWith('/app');
  const wpMode = useWordPressCatalog();

  /* The public shell lets the page carry its own rail; inside the app
     shell the layout already pays the gutter, so the rail only caps width. */
  const RAIL = isInApp ? 'mx-auto w-full max-w-[90rem]' : 'rail';

  const clipHref = useCallback(
    (clip: MediaHubClip) =>
      isInApp ? `/app/clip/${getShortClipId(clip.id)}` : `/catalog/clip/${getShortClipId(clip.id)}`,
    [isInApp],
  );

  /* ── filter state ─────────────────────────────────────────────────────
     The query string is the state, not a copy of it. Every control reads
     the URL and writes back to it, so a shared link opens on exactly the
     view the sender was looking at, and there is no second source of
     truth to fall out of sync with. */
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const query = params.get('q') ?? '';

  const formatRaw = params.get('format') ?? '';
  const format: FormatKey = FORMATS.some((f) => f.key === formatRaw)
    ? (formatRaw as FormatKey)
    : 'all';

  // A chip elsewhere on the site links here with ?q= or ?tag=, so the
  // library opens already narrowed. An inbound tag that spells out a whole
  // disease area lights that chip; anything narrower lands on the
  // biomarker row beside it.
  const inboundTag = params.get('tag') ?? '';
  const taggedArea = inboundTag
    ? (DISEASE_AREAS.find((d) => (d.clipTags?.join(',') ?? '') === inboundTag) ?? null)
    : null;
  const areaRaw = params.get('area') ?? '';
  const area =
    taggedArea?.slug ?? (DISEASE_AREAS.some((d) => d.slug === areaRaw) ? areaRaw : 'all');

  /** '' | `wp:<category slug>` | `tag:<namespaced MediaHub tag>` */
  const marker = params.get('marker') || (inboundTag && !taggedArea ? `tag:${inboundTag}` : '');

  const doctorFilter = params.get('doctor') ?? '';

  // Back-compat: legacy `?sort=recent` was byte-identical to `?sort=posted`
  // at the backend (2026-05-16 audit). Redirect old links to `posted`.
  const sortRaw = params.get('sort') ?? params.get('sort_by') ?? '';
  const sortNormalized = sortRaw === 'recent' ? 'posted' : sortRaw;
  const sortBy = SORT_PARAM_VALUES.has(sortNormalized) ? sortNormalized : DEFAULT_SORT;

  const areaDef = area === 'all' ? null : (DISEASE_AREAS.find((d) => d.slug === area) ?? null);
  const areaTag = areaDef?.clipTags?.length ? areaDef.clipTags.join(',') : '';
  /** An area carrying no clip tags has nothing in the catalogue yet. */
  const areaIsEmpty = !!areaDef && !areaTag;
  const markerTag = marker.startsWith('tag:') ? marker.slice(4) : '';
  const wpCategory = marker.startsWith('wp:') ? marker.slice(3) : '';
  /** Both taxonomies live in the biomarker namespace, so the narrower wins. */
  const tagParam = markerTag || areaTag;

  /**
   * Writes a filter change back to the query string. The whole string is
   * rebuilt from what the controls hold, so an inbound `?tag=` normalises
   * to the chip that absorbed it and the resolved tag never lingers as a
   * second, sticky filter no chip owns.
   */
  const setFilters = useCallback(
    (patch: Partial<Record<'q' | 'format' | 'area' | 'marker' | 'doctor' | 'sort', string>>) => {
      const merged = {
        q: query.trim(),
        format: format === 'all' ? '' : format,
        area: area === 'all' ? '' : area,
        marker,
        doctor: doctorFilter,
        sort: sortBy === DEFAULT_SORT ? '' : sortBy,
        ...patch,
      };
      const next = new URLSearchParams();
      for (const [key, value] of Object.entries(merged)) {
        if (value) next.set(key, value);
      }
      const serialised = next.toString();
      if (serialised === location.search.replace(/^\?/, '')) return;
      navigate(
        { pathname: location.pathname, search: serialised ? `?${serialised}` : '' },
        { replace: true },
      );
    },
    [query, format, area, marker, doctorFilter, sortBy, navigate, location.pathname, location.search],
  );

  // The typed value lands in the URL immediately; the request behind it
  // waits for the typing to settle.
  const [debouncedQuery, setDebouncedQuery] = useState(() => query.trim());
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  /* ── data ─────────────────────────────────────────────────────────── */

  const { data: wpCategoriesData } = useQuery({
    queryKey: ['catalog', 'wordpress', 'categories'],
    queryFn: () => catalogApi.getWordPressCategories(),
    staleTime: WORDPRESS_CATALOG_STALE_MS,
  });

  const { data: mediaHubTags = {} } = useQuery({
    queryKey: ['catalog', 'tags'],
    queryFn: catalogApi.getTags,
    staleTime: WORDPRESS_CATALOG_STALE_MS,
    enabled: !wpMode,
  });

  const { data: playlists = [] } = useQuery({
    queryKey: ['catalog', 'playlists'],
    queryFn: catalogApi.getPlaylists,
    staleTime: WORDPRESS_CATALOG_STALE_MS,
  });

  // The featured rail is the newest of the whole catalogue, not of the
  // current filter: it stays put while the grid underneath narrows.
  const { data: featuredData } = useQuery({
    queryKey: ['catalog', 'clips', 'featured', wpMode ? 'wp' : 'legacy'],
    queryFn: () =>
      catalogApi.getClips({
        sort_by: 'recorded_at',
        limit: 8,
        ...(wpMode ? { has_wordpress: true } : {}),
      }),
    staleTime: WORDPRESS_CATALOG_STALE_MS,
  });

  const featured = useMemo(
    () => (featuredData?.items ?? []).filter((c) => shouldSurfaceCatalogClip(c)).slice(0, 3),
    [featuredData],
  );

  const {
    data: clipsData,
    isLoading: clipsLoading,
    isError: clipsError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [
      'catalog',
      'clips',
      debouncedQuery,
      tagParam,
      wpCategory,
      doctorFilter,
      sortBy,
      wpMode ? 'wp' : 'legacy',
    ],
    queryFn: ({ pageParam }) =>
      catalogApi.getClips({
        q: debouncedQuery || undefined,
        tag: tagParam || undefined,
        wp_category: wpCategory || undefined,
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
    staleTime: WORDPRESS_CATALOG_STALE_MS,
  });

  const clipsPageCount = clipsData?.pages.length ?? 0;

  const surfaced = useMemo(
    () =>
      (clipsData?.pages?.flatMap((p) => p?.items ?? []) ?? []).filter((c) =>
        shouldSurfaceCatalogClip(c),
      ),
    [clipsData?.pages],
  );

  const results = useMemo(
    () => (areaIsEmpty ? [] : surfaced.filter((c) => matchesFormat(c, format))),
    [surfaced, format, areaIsEmpty],
  );

  const loadMoreRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (target?.isIntersecting && hasNextPage && !isFetchingNextPage && !clipsLoading) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage, clipsLoading],
  );

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    // Wait until the first page is on screen before observing, so an empty
    // first paint can't chain-load every offset.
    if (clipsLoading || clipsPageCount === 0) return;
    const observer = new IntersectionObserver(handleObserver, { rootMargin: '200px', threshold: 0 });
    // Defer observe one frame so the sentinel isn't treated as "already
    // intersecting" during the initial layout of page 1.
    const raf = requestAnimationFrame(() => observer.observe(el));
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [handleObserver, clipsLoading, clipsPageCount]);

  /* Biomarker chips: the WordPress taxonomy carries real counts, so it is
     preferred; the MediaHub tag namespace is the fallback when a site has
     no WordPress mirror. */
  const biomarkerChips = useMemo(() => {
    const wp = sortWordPressCategories(wpCategoriesData?.items ?? [])
      .filter((c) => c.post_count > 0)
      .slice(0, 8);
    if (wp.length > 0) {
      return wp.map((c) => ({
        value: `wp:${c.slug}`,
        label: formatWordPressCategoryLabel(c.slug),
        count: c.post_count as number | null,
      }));
    }
    const seen = new Set<string>();
    const out: { value: string; label: string; count: number | null }[] = [];
    for (const raw of mediaHubTags['biomarker'] ?? []) {
      const value = String(raw);
      const label = tagLabel(value);
      if (!label || seen.has(label)) continue;
      seen.add(label);
      out.push({ value: `tag:${value}`, label, count: null });
    }
    return out.slice(0, 8);
  }, [wpCategoriesData, mediaHubTags]);

  const filtersActive = !!(
    query ||
    format !== 'all' ||
    area !== 'all' ||
    marker ||
    doctorFilter ||
    sortBy !== DEFAULT_SORT
  );

  const reset = () => {
    setDebouncedQuery('');
    setFilters({ q: '', format: '', area: '', marker: '', doctor: '', sort: '' });
  };

  const isFirstLoad = clipsLoading && clipsPageCount === 0;

  return (
    <div className={`min-h-screen min-w-0 ${isInApp ? 'bg-transparent' : 'bg-ground'}`}>
      <section aria-labelledby="library-heading" className={`${RAIL} pt-14 pb-12 md:pt-16 md:pb-16`}>
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.02fr] lg:gap-16">
          <div>
            <p className="eyebrow text-muted2">Content library</p>
            <h1
              id="library-heading"
              className="display mt-6 max-w-[16ch] text-[2.5rem] leading-[1.04] tracking-[-0.03em] text-text md:text-display-l"
            >
              Every conversation, every cut
            </h1>
            <p className="prose-lede mt-6 max-w-[50ch] text-body-l text-muted2">
              Filter by format and disease state at the same time. Every session exists as
              long-form video, an audio cut, a written explainer and a set of clips.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              {/* Inside the app shell the reader is already signed in, so
                  the join CTA is the one thing the hero drops. */}
              {!isInApp ? (
                <Button to="/join" variant="cta" className={BTN}>
                  Start watching free
                  <ArrowRight className="size-4" strokeWidth={1.75} />
                </Button>
              ) : null}
              <Button
                to="/kol-network"
                variant="outline"
                className={`${BTN} bg-surface text-text hover:bg-ground hover:text-text hover:shadow-card-hover`}
              >
                Browse by faculty
              </Button>
            </div>
          </div>

          <FeaturedCarousel clips={featured} hrefFor={clipHref} />
        </div>
      </section>

      {/* ── search ─────────────────────────────────────── */}
      <div className={RAIL}>
        <div className="relative">
          <Search
            className="pointer-events-none absolute start-5 top-1/2 size-5 -translate-y-1/2 text-faint"
            strokeWidth={1.5}
            aria-hidden
          />
          <label htmlFor="library-search" className="sr-only">
            Search the content library
          </label>
          <input
            id="library-search"
            type="search"
            value={query}
            onChange={(e) => setFilters({ q: e.target.value })}
            placeholder="Search sessions, trials, faculty"
            className="h-14 w-full rounded-[6px] bg-surface ps-14 pe-5 text-base text-text shadow-card outline-none placeholder:text-faint focus:bg-ground focus:shadow-card-hover"
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {FORMATS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilters({ format: f.key === 'all' ? '' : f.key })}
              aria-pressed={format === f.key}
              className={`${CHIP} ${format === f.key ? CHIP_ON : CHIP_OFF}`}
            >
              {f.label}
            </button>
          ))}

          <span aria-hidden className="mx-2 h-6 w-px bg-transparent" />

          <button
            type="button"
            onClick={() => setFilters({ area: '' })}
            aria-pressed={area === 'all'}
            className={`${CHIP} ${area === 'all' ? CHIP_ON : CHIP_OFF}`}
          >
            Every area
          </button>
          {DISEASE_AREAS.map((a) => (
            <button
              key={a.slug}
              type="button"
              onClick={() => setFilters({ area: a.slug, marker: '' })}
              aria-pressed={area === a.slug}
              className={`${CHIP} ${area === a.slug ? CHIP_ON : CHIP_OFF}`}
            >
              {a.title}
            </button>
          ))}

          <p role="status" className="meta ms-auto text-faint">
            {results.length} {results.length === 1 ? 'result' : 'results'}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {doctorFilter ? (
            <button
              type="button"
              onClick={() => setFilters({ doctor: '' })}
              aria-pressed={true}
              className={`${CHIP} ${CHIP_ON}`}
            >
              {doctorLabelFromSlug(doctorFilter)}
            </button>
          ) : null}
          {biomarkerChips.map((b) => (
            <button
              key={b.value}
              type="button"
              onClick={() => setFilters({ marker: marker === b.value ? '' : b.value })}
              aria-pressed={marker === b.value}
              className={`${CHIP} gap-2 ${marker === b.value ? CHIP_ON : CHIP_OFF}`}
            >
              {b.label}
              {b.count != null ? <span className="meta opacity-70">{b.count}</span> : null}
            </button>
          ))}
          {filtersActive ? (
            <button
              type="button"
              onClick={reset}
              className="press ms-1 text-body-s text-muted2 hover:text-text"
            >
              Clear all
            </button>
          ) : null}
        </div>
      </div>

      {/* ── grid ───────────────────────────────────────── */}
      <div className={`${RAIL} pt-12 pb-20`}>
        {isFirstLoad ? (
          <div className="flex items-center justify-center py-16" aria-busy="true">
            <Loader2 className="size-10 animate-spin text-faint" aria-hidden />
          </div>
        ) : clipsError ? (
          <div className="rounded-[6px] px-8 py-16 text-center shadow-card">
            <p className="display text-display-s text-text">Could not load the library</p>
            <p className="prose-lede mx-auto mt-3 max-w-[34rem] text-body-m text-muted2">
              The catalogue did not answer. Try again in a moment.
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-[6px] px-8 py-16 text-center shadow-card">
            <p className="display text-display-s text-text">Nothing matches that yet</p>
            <p className="prose-lede mx-auto mt-3 max-w-[34rem] text-body-m text-muted2">
              The library covers {DISEASE_AREAS.length} disease states across video, podcast and
              editorial, but not every combination is filled. Widen the filter to see more of it.
            </p>
            <div className="mt-7 flex justify-center">
              <Button
                type="button"
                onClick={reset}
                variant="outline"
                className={`${BTN} bg-surface text-text hover:bg-ground hover:text-text hover:shadow-card-hover`}
              >
                Clear all filters
              </Button>
            </div>
          </div>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((item) => {
              const lead = item.doctors?.[0] ? doctorLabelFromSlug(item.doctors[0]) : null;
              return (
                <li key={item.id}>
                  <Link
                    to={clipHref(item)}
                    state={{ clip: item }}
                    className="card group flex h-full flex-col p-4"
                  >
                    <div className="relative">
                      <Thumb clip={item} className="aspect-video w-full" />
                      <span className="absolute top-3 start-3">
                        <FormatBadge clip={item} />
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col px-1 pt-4 pb-1">
                      <h3 className="display line-clamp-2 text-body-m text-text">{item.title}</h3>
                      <p className="meta mt-auto pt-5 text-faint">{lead}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div ref={loadMoreRef} className="flex justify-center py-10">
          {isFetchingNextPage ? (
            <Loader2 className="size-8 animate-spin text-faint" aria-hidden />
          ) : null}
        </div>

        {playlists.length > 0 ? (
          <div className="mt-16">
            <h2 className="display text-display-s text-text">Featured playlists</h2>
            <ul className="mt-6 flex flex-wrap gap-3">
              {playlists.slice(0, 12).map((p) => (
                <li key={p.id}>
                  <Link
                    to={`${isInApp ? '/app' : ''}/catalog/playlist/${p.id}`}
                    className="press inline-flex h-11 items-center gap-3 rounded-[6px] bg-surface px-5 text-body-s text-dim shadow-card hover:bg-ground hover:text-text hover:shadow-card-hover"
                  >
                    {p.title}
                    {p.videoCount ? <span className="meta text-faint">{p.videoCount}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
