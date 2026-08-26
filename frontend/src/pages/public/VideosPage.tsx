import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowRight, ListVideo, Loader2, Play, Search } from 'lucide-react';
import { catalogApi, type CatalogItem, type MediaHubClip } from '../../api/catalog';
import { ChmMark } from '../../components/brand/ChmMark';
import { Button, Chip } from '../../components/ui';
import {
  ConversationsHero,
  ConversationsHeroSkeleton,
} from '../../components/content/ConversationsHero';
import { CatalogRow, CatalogSessionCard } from '../../components/content/CatalogRow';
import {
  BIOMARKER_CAROUSEL_IDS,
  BiomarkerConversationRow,
} from '../../components/content/BiomarkerConversationRow';
import {
  APP_CATALOG_CLIPS_GRID,
  APP_CATALOG_PLAYLISTS_BROWSE,
} from '../../components/navigation/appNavItems';
import DISEASE_AREAS from '../../data/disease-areas';
import {
  extractYoutubeVideoIdFromUrl,
  getMediaHubThumbnail,
  getShortClipId,
  nextCatalogThumbnailFallback,
  normalizeCatalogThumbnailUrl,
  shouldSurfaceCatalogClip,
} from '../../utils/clipUrl';
import { doctorLabelFromSlug } from '../../utils/doctorLabel';
import { clipStripeSubtitle } from '../../utils/mediaHubClipText';
import { extractPlaylistSpeakers, playlistDisplayTitle } from '../../utils/playlistWpSections';
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
/** How many tiles the "Recently added" rail carries before "see all". */
const RECENT_RAIL_LIMIT = 14;
/** Playlist tiles in the rail beside it. */
const PLAYLIST_RAIL_LIMIT = 12;

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

/* ── playlists ─────────────────────────────────────────────────────────
   A playlist is a set, not a single video, so the card says so twice: a
   second sheet peeks out behind the poster, and the count sits in the
   foot where a clip poster carries its runtime. Same grammar as the clip
   card above it, one different fact. */

/** One tint per playlist, so a wall of cover-less sets is not one block. */
const PLAYLIST_TINTS = [
  'from-cerebral-cyan/40 to-cerebral-blue/10',
  'from-cerebral-pink/40 to-cerebral-purple/10',
  'from-cerebral-green/40 to-cerebral-cyan/10',
  'from-cerebral-purple/40 to-cerebral-pink/10',
  'from-cerebral-coral/40 to-cerebral-pink/10',
  'from-cerebral-blue/35 to-cerebral-cyan/10',
] as const;

/** Keyed off the id, so the tint does not shuffle when the order does. */
function playlistTint(id: string): string {
  let sum = 0;
  for (let i = 0; i < id.length; i += 1) sum = (sum + id.charCodeAt(i)) % 4096;
  return PLAYLIST_TINTS[sum % PLAYLIST_TINTS.length];
}

/** YouTube's playlist poster is its first video's poster, so the id it
    carries lets us walk the same size ladder the clip Thumb walks. */
function playlistPosterVideoId(url: string): string | null {
  return url.match(/\/vi\/([a-zA-Z0-9_-]{11})\//)?.[1] ?? null;
}

function videoCountOf(item: CatalogItem): number {
  return item.videoCount || item.videoNames?.length || 0;
}

/**
 * The playlist poster. Steps down the YouTube sizes on a 404. When the
 * ladder runs out, or ContentHub sent no cover at all, the frame becomes
 * a tinted surface carrying the count rather than a broken image. The
 * foot is permanently dark under the gradient, so the label there takes
 * a fixed bright fill instead of the page-following tokens.
 */
function PlaylistPoster({ item }: { item: CatalogItem }) {
  const given = item.thumbnailUrl?.trim() ?? '';
  const videoId = playlistPosterVideoId(given);
  /* The walked-down size lives in state, and a new cover from the API
     has to restart the ladder rather than inherit a stale rung. The
     caller keys this component on the URL, so that reset is the remount
     and there is no effect to sync it. */
  const [src, setSrc] = useState(() => (given ? normalizeCatalogThumbnailUrl(given, videoId) : ''));

  /** An exhausted ladder returns null, which drops the frame to the tint. */
  const advance = (current: string) => setSrc(nextCatalogThumbnailFallback(current, videoId) ?? '');

  const count = videoCountOf(item);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[6px] bg-surface-2">
      {src ? (
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
      ) : (
        <>
          <span
            aria-hidden
            className={`absolute inset-0 bg-gradient-to-br ${playlistTint(item.id)}`}
          />
          <ListVideo
            aria-hidden
            className="absolute inset-0 m-auto size-7 text-muted2"
            strokeWidth={1.25}
          />
        </>
      )}
      {/* Seats the count on a dark strip whether the fill is a still or
          the tint, which is what keeps the two versions one component. */}
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"
      />
      <span className="img-ring absolute inset-0 rounded-[inherit]" />
      {/* Sits on the permanently dark foot, so the fill and the label here
          are fixed rather than page-following: a token pair would resolve
          to dark-on-dark in one of the two appearances. */}
      {count > 0 ? (
        <Chip className="absolute bottom-2.5 start-2.5 bg-black/55 text-white ring-1 ring-inset ring-white/20 backdrop-blur-md">
          {count} video{count === 1 ? '' : 's'}
        </Chip>
      ) : null}
    </div>
  );
}

function PlaylistCard({ item, href }: { item: CatalogItem; href: string }) {
  /* The title carries the faculty inline ("… with Drs. Rugo & Hurvitz");
     split it so the name row is its own step rather than eating the two
     lines the topic needs. Both helpers already back the /catalog cards. */
  const title = playlistDisplayTitle(item.title ?? '');
  const faculty = extractPlaylistSpeakers(item.title ?? '');

  return (
    <Link
      to={href}
      className="card group flex h-full flex-col p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-4"
    >
      <div className="relative">
        {/* The sheet behind: a set, not a single video. The ring is what
            makes a 6px sliver read as an edge rather than a smudge. */}
        <span
          aria-hidden
          className="img-ring absolute inset-x-3 -top-1.5 h-3 rounded-t-[6px] bg-surface-2"
        />
        <PlaylistPoster key={item.thumbnailUrl ?? ''} item={item} />
      </div>
      <div className="flex flex-1 flex-col px-1 pt-3.5 pb-1">
        <h3 className="display line-clamp-2 text-body-s text-text group-hover:text-anchor sm:text-body-m">
          {title}
        </h3>
        {faculty ? (
          <p className="meta mt-auto line-clamp-1 pt-3 text-faint">{faculty}</p>
        ) : null}
      </div>
    </Link>
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

  /* ── the Conversations tab's own composition ──────────────────────────
     Inside the app the tab opens on one featured conversation and then a
     set of themed rails, which is how it read before the token sweep
     flattened it into the public library's filter grid. The controls
     still sit under the hero, and the moment one of them is touched the
     rails give way to the results grid, so nothing here is a second copy
     of the filter state. */
  const heroClip = featured[0] ?? null;
  const heroLoading = !featuredData;
  const showRails = isInApp && !filtersActive;

  const railItems = useMemo(() => {
    const withoutHero = heroClip ? results.filter((c) => c.id !== heroClip.id) : results;
    return withoutHero.slice(0, RECENT_RAIL_LIMIT);
  }, [results, heroClip]);

  return (
    <div className={`min-h-screen min-w-0 ${isInApp ? 'bg-transparent' : 'bg-ground'}`}>
      {isInApp ? (
        /* Full bleed: cancels the outlet's gutter and its top padding so
           the poster runs edge to edge and passes under the frosted
           header, which is what made this read as a featured strip
           rather than as one more card. */
        <div className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-mt-8">
          {heroLoading ? (
            <ConversationsHeroSkeleton />
          ) : heroClip ? (
            <ConversationsHero clip={heroClip} isInApp />
          ) : null}
        </div>
      ) : (
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
                <Button to="/join" variant="cta" className={BTN}>
                  Start watching free
                  <ArrowRight className="size-4" strokeWidth={1.75} />
                </Button>
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
      )}

      {/* ── search ─────────────────────────────────────── */}
      <div className={`${RAIL} ${isInApp ? 'pt-10 md:pt-12' : ''}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
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
          {/* The public hero carries this; inside the app the hero is the
              poster, so the faculty route lives beside the search. */}
          {isInApp ? (
            <Button
              to="/kol-network"
              variant="outline"
              className={`${BTN} h-14 shrink-0 bg-surface text-text hover:bg-ground hover:text-text hover:shadow-card-hover`}
            >
              Browse by faculty
            </Button>
          ) : null}
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

      {/* ── rails (app, unfiltered) / grid ─────────────── */}
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
        ) : showRails ? (
          <div className="space-y-14 md:space-y-16">
            {railItems.length > 0 ? (
              <CatalogRow
                title="Recently added"
                subtitle={`${railItems.length} video${railItems.length !== 1 ? 's' : ''}`}
                seeAllHref={APP_CATALOG_CLIPS_GRID}
                seeAllLabel="See all in library"
              >
                {railItems.map((item) => (
                  <CatalogSessionCard
                    key={`recent-${item.id}`}
                    clip={item}
                    to={clipHref(item)}
                    title={item.title}
                    imageUrl={getMediaHubThumbnail(item)}
                    duration={clipDuration(item.duration_seconds)}
                    description={
                      item.doctors?.[0]
                        ? doctorLabelFromSlug(item.doctors[0])
                        : clipStripeSubtitle(item) || 'Conversation'
                    }
                  />
                ))}
              </CatalogRow>
            ) : null}

            {playlists.length > 0 ? (
              <CatalogRow
                title="Playlists"
                subtitle={`${playlists.length} curated ${playlists.length === 1 ? 'list' : 'lists'}`}
                seeAllHref={APP_CATALOG_PLAYLISTS_BROWSE}
                seeAllLabel="See all playlists"
              >
                {/* The same playlist card the grid below uses, so a set
                    reads identically in the rail and in the wall. */}
                {playlists.slice(0, PLAYLIST_RAIL_LIMIT).map((p) => (
                  <li
                    key={`playlist-${p.id}`}
                    className="w-[15.5rem] shrink-0 snap-start sm:w-[17.5rem]"
                  >
                    <PlaylistCard item={p} href={`/app/catalog/playlist/${p.id}`} />
                  </li>
                ))}
              </CatalogRow>
            ) : null}

            {/* The themed lanes, driven by `carousels.config.ts`. Same
                contract as the dashboard's rows; `catalog` only swaps the
                presentation onto the design's cards and type. */}
            {BIOMARKER_CAROUSEL_IDS.map((id) => (
              <BiomarkerConversationRow key={id} carouselId={id} isInApp variant="catalog" />
            ))}
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

        {/* The sentinel belongs to the grid. Mounting it under the rails
            would page the whole catalogue in behind a view that only ever
            shows the first fourteen. */}
        {!showRails ? (
          <div ref={loadMoreRef} className="flex justify-center py-10">
            {isFetchingNextPage ? (
              <Loader2 className="size-8 animate-spin text-faint" aria-hidden />
            ) : null}
          </div>
        ) : null}

        {playlists.length > 0 && !showRails ? (
          <section aria-labelledby="featured-playlists" className="mt-16">
            <p className="eyebrow text-muted2">Collections</p>
            <h2 id="featured-playlists" className="display mt-3 text-display-s text-text">
              Featured playlists
            </h2>
            <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
              {playlists.slice(0, 12).map((p) => (
                <li key={p.id} className="min-w-0">
                  <PlaylistCard
                    item={p}
                    href={`${isInApp ? '/app' : ''}/catalog/playlist/${p.id}`}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
