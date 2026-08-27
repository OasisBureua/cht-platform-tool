import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Play } from 'lucide-react';
import { format as formatDate, isValid } from 'date-fns';

import { catalogApi, type MediaHubClip } from '../../api/catalog';
import { ChmMark } from '../../components/brand/ChmMark';
import { YouTubePlayer } from '../../components/YouTubePlayer';
import { Button, Chip, chipKind, Reveal } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { pushClipView } from '../../lib/analytics';
import { doctorLabelFromSlug } from '../../utils/doctorLabel';
import { clipDisplaySummary } from '../../utils/mediaHubClipText';
import {
  extractYoutubeVideoIdFromUrl,
  getMediaHubThumbnail,
  getShortClipId,
  isLinkedinCatalogClipId,
  nextCatalogThumbnailFallback,
  shouldSurfaceCatalogClip,
} from '../../utils/clipUrl';
import {
  WORDPRESS_CATALOG_STALE_MS,
  formatWordPressCategoryLabel,
  formatWordPressSeriesLabel,
} from '../../utils/wordpressCatalog';

/* ────────────────────────────────────────────────────────────────────────
   The public session page. One record — a MediaHub clip — read through
   the catalog API and laid out as the design's watch surface: player and
   track on the left, the session's own dossier on the right.
   ──────────────────────────────────────────────────────────────────── */

const TRACK_FETCH_LIMIT = 12;

/** mm:ss, or h:mm:ss past the hour. */
function clipDuration(seconds: number | undefined): string | undefined {
  if (!seconds || seconds <= 0) return undefined;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat().format(n);
}

/** MediaHub sends snake_case; some ContentHub paths send camelCase. */
function readNumber(clip: MediaHubClip, snake: string, camel: string): number {
  const raw = clip as unknown as Record<string, unknown>;
  const v = raw[snake] ?? raw[camel];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') return parseInt(v, 10) || 0;
  return 0;
}

function readString(clip: MediaHubClip, snake: string, camel: string): string {
  const raw = clip as unknown as Record<string, unknown>;
  const v = raw[snake] ?? raw[camel];
  return typeof v === 'string' ? v : '';
}

function clipYoutubeUrl(clip: MediaHubClip): string {
  const direct = readString(clip, 'youtube_url', 'youtubeUrl').trim();
  if (direct) return direct;
  const short = getShortClipId(clip.id);
  return /^[a-zA-Z0-9_-]{11}$/.test(short) ? `https://www.youtube.com/watch?v=${short}` : '';
}

/** `biomarker:HER2+` reads as `HER2+` on a chip. */
function tagLabel(value: string): string {
  const at = value.indexOf(':');
  return at === -1 ? value : value.slice(at + 1);
}

/** `brand:` tags are internal routing, never shown to a reader. */
function readerTags(clip: MediaHubClip): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of clip.tags ?? []) {
    const value = String(raw);
    if (value.startsWith('brand:')) continue;
    const label = tagLabel(value).trim();
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    out.push(label);
  }
  return out;
}

function initials(name: string): string {
  const parts = name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase());
  return letters.join('') || '·';
}

/* ── page-local design chrome ────────────────────────────────────────── */

function Eyebrow({
  children,
  tone = 'faint',
  className = '',
}: {
  children: ReactNode;
  tone?: 'faint' | 'cyan' | 'amber';
  className?: string;
}) {
  const tones = { faint: 'text-muted2', cyan: 'text-anchor', amber: 'text-amber' };
  return <p className={`eyebrow ${tones[tone]} ${className}`}>{children}</p>;
}

/** Reading-direction glyph: mirrors under dir="rtl". */
function Arrow({ className = '', strokeWidth = 1.5 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={`shrink-0 rtl:-scale-x-100 ${className}`}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/**
 * Section chrome: the heading and the one "see all" affordance a band is
 * allowed, on a single centred baseline.
 */
function SectionHead({
  id,
  title,
  sub,
  seeAll,
}: {
  id?: string;
  title: string;
  sub?: string;
  seeAll?: { noun: string; to: string };
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <h2 id={id} className="display min-w-0 text-display-m text-text">
          {title}
        </h2>
        {seeAll ? (
          <Link
            to={seeAll.to}
            className="press inline-flex h-10 shrink-0 items-center gap-2 rounded-[6px] bg-surface px-5 text-body-s text-dim shadow-card hover:bg-ground hover:text-text hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            See all {seeAll.noun}
            <Arrow className="size-4" strokeWidth={1.75} />
          </Link>
        ) : null}
      </div>
      {sub ? <p className="prose-lede mt-4 max-w-[52ch] text-body-m text-muted2">{sub}</p> : null}
    </div>
  );
}

/**
 * The poster image on its own. ContentHub hands out maxres URLs that
 * YouTube 404s, and a missing video answers 200 with a 120×90 grey box,
 * so both failures walk down the size ladder rather than showing a hole.
 */
function PosterImage({ clip, className = '' }: { clip: MediaHubClip; className?: string }) {
  const short = getShortClipId(clip.id);
  const videoId =
    extractYoutubeVideoIdFromUrl(clipYoutubeUrl(clip)) ||
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

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => advance(src)}
      onLoad={(e) => {
        const img = e.currentTarget;
        if (img.naturalWidth > 0 && img.naturalWidth <= 120 && img.naturalHeight <= 90) {
          advance(src);
        }
      }}
      className={className}
    />
  );
}

/**
 * The card poster. Permanently dark under the gradient, so the mark and
 * the runtime take fixed white rather than the page-following tokens.
 */
function Thumb({ clip, className = '' }: { clip: MediaHubClip; className?: string }) {
  const duration = clipDuration(clip.duration_seconds);
  return (
    <div className={`relative overflow-hidden rounded-[6px] bg-surface-2 ${className}`}>
      <PosterImage
        clip={clip}
        className="absolute inset-0 size-full object-cover opacity-90 transition-[scale,opacity] duration-300 ease-[var(--ease-out-strong)] group-hover:scale-[1.03] group-hover:opacity-100"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
      <div className="img-ring absolute inset-0 rounded-[inherit]" />
      <ChmMark className="absolute bottom-3 start-3 size-5 text-white/80" />
      {duration ? <span className="meta absolute end-3 bottom-3 text-white/80">{duration}</span> : null}
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
 * The session player. The frame carries its own depth and lets the poster
 * keep its colour. Clicking the disc mounts the real YouTube embed, which
 * is what fires the GA4 video_start / video_progress / video_complete
 * events, so playback telemetry survives the click-to-play poster.
 *
 * `queue` is the rest of the track. It replaces the design's chapter
 * timestamps, which were the least useful thing that could occupy the
 * most valuable strip on the page.
 */
function SessionPlayer({
  clip,
  youtubeUrl,
  queue,
  hrefFor,
}: {
  clip: MediaHubClip;
  youtubeUrl: string;
  queue: MediaHubClip[];
  hrefFor: (clip: MediaHubClip) => string;
}) {
  const [playing, setPlaying] = useState(false);
  const duration = clipDuration(clip.duration_seconds);

  return (
    <div className="overflow-hidden rounded-[8px] bg-surface shadow-card">
      <div className="relative aspect-video w-full bg-surface-2">
        {playing ? (
          <YouTubePlayer
            youtubeUrl={youtubeUrl}
            title={clip.title}
            autoplay
            muted={false}
            className="absolute inset-0 size-full"
          />
        ) : (
          <>
            <PosterImage clip={clip} className="absolute inset-0 size-full object-cover" />
            {/* Just enough scrim at the foot to carry the overlaid meta.
                Permanently dark, so the runtime takes fixed white. */}
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-black/10"
            />
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label={`Play ${clip.title}`}
              className="group absolute inset-0 grid place-items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="press grid size-[4.5rem] place-items-center rounded-full bg-text text-ground shadow-pop transition-[scale] duration-150 ease-[var(--ease-standard)] group-hover:scale-105">
                <Play className="size-7 translate-x-px" fill="currentColor" strokeWidth={0} />
              </span>
            </button>
            <span className="meta absolute end-4 bottom-4 text-white/85">
              Video{duration ? ` · ${duration}` : ''}
            </span>
          </>
        )}
      </div>

      {/* The design's foot strip. Playback position is owned by the
          YouTube chrome once the embed mounts, so this carries the state
          the page actually knows rather than a bar it would have to
          invent. */}
      <div className="px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="meta text-muted2">{playing ? 'Playing' : 'Ready to play'}</p>
          {duration ? <p className="meta tabular-nums text-muted2">{duration}</p> : null}
        </div>
      </div>

      {queue.length > 0 ? (
        <>
          <h2 id="queue-heading" className="eyebrow px-4 pt-1 pb-2 text-faint">
            Up next in this track
          </h2>
          <ol aria-labelledby="queue-heading" className="px-2 pb-2">
            {queue.map((q, i) => {
              const runtime = clipDuration(q.duration_seconds);
              return (
                <li key={q.id}>
                  <Link
                    to={hrefFor(q)}
                    state={{ clip: q }}
                    className="press group flex items-center gap-3 rounded-[6px] p-2 hover:bg-[color-mix(in_oklab,var(--color-text)_6%,transparent)]"
                  >
                    <span className="meta w-5 shrink-0 tabular-nums text-faint">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="relative block h-12 w-[5.25rem] shrink-0 overflow-hidden rounded-[6px] bg-ground">
                      <PosterImage clip={q} className="absolute inset-0 size-full object-cover" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-s text-dim group-hover:text-text">
                        {q.title}
                      </span>
                      {runtime ? (
                        <span className="meta mt-0.5 block tabular-nums text-faint">{runtime}</span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </>
      ) : null}
    </div>
  );
}

/** The track card. One link, so its tags are labels rather than links. */
function CompactCard({ clip, to }: { clip: MediaHubClip; to: string }) {
  const tags = readerTags(clip).slice(0, 2);
  const runtime = clipDuration(clip.duration_seconds);
  const lead = clip.doctors?.[0] ? doctorLabelFromSlug(clip.doctors[0]) : null;

  return (
    <Link to={to} state={{ clip }} className="card group flex h-full flex-col gap-4 p-4">
      <div className="relative">
        <Thumb clip={clip} className="aspect-video w-full" />
        <span className="absolute top-3 start-3">
          <FormatBadge clip={clip} />
        </span>
      </div>
      <div className="flex flex-1 flex-col px-1 pb-1">
        <h3 className="display line-clamp-2 text-body-m text-text">{clip.title}</h3>
        {tags.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <li key={t}>
                <Chip kind={chipKind(t)}>{t}</Chip>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="meta mt-auto flex items-center justify-between gap-3 pt-4 tabular-nums text-faint">
          <span className="truncate">{lead}</span>
          {runtime ? <span className="shrink-0">{runtime}</span> : null}
        </p>
      </div>
    </Link>
  );
}

/** Full-height state pages keep the page ground and the rail. */
function Shell({ children, isInApp }: { children: ReactNode; isInApp: boolean }) {
  return (
    <div className={`min-h-screen min-w-0 ${isInApp ? 'bg-transparent' : 'bg-ground'}`}>
      {children}
    </div>
  );
}

export default function PublicWatch() {
  /* Mounted at the public watch path, and reachable from the in-app
     shell, so every id spelling the router uses is accepted. */
  const params = useParams<{ videoId?: string; id?: string; slug?: string }>();
  const clipId = params.videoId ?? params.id ?? params.slug;

  const location = useLocation();
  const isInApp = location.pathname.startsWith('/app');
  const base = isInApp ? '/app' : '';

  const { user, isAuthenticated } = useAuth();

  const skipLinkedInClip = !!clipId && isLinkedinCatalogClipId(clipId);
  const stateClip = (location.state as { clip?: MediaHubClip } | null)?.clip;
  const stateClipMatches =
    !!stateClip && !!clipId && (stateClip.id === clipId || getShortClipId(stateClip.id) === clipId);

  const {
    data: clip,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['catalog', 'clip', clipId],
    queryFn: async () => {
      const fromApi = await catalogApi.getClip(clipId!);
      if (fromApi) return fromApi;
      // ContentHub detail may 404; keep the navigated clip so the player
      // still works from a card that already carried the record.
      if (stateClipMatches) return stateClip!;
      return null;
    },
    enabled: !!clipId && !skipLinkedInClip,
    retry: 0,
    placeholderData: stateClipMatches ? stateClip : undefined,
  });

  const category = clip?.wordpress?.categories?.[0];
  const seriesSlug = clip?.wordpress?.series?.[0];

  /* The track widens the way the design's does: the session's own
     category first, then the newest of the whole library, so a lightly
     tagged session still gets a real track instead of one lonely card. */
  const { data: trackPool = [] } = useQuery({
    queryKey: ['catalog', 'clips', 'track', category ?? '', clipId ?? ''],
    queryFn: async () => {
      const [inCategory, newest] = await Promise.all([
        category
          ? catalogApi.getClips({
              wp_category: category,
              limit: TRACK_FETCH_LIMIT,
              sort_by: 'recorded_at',
            })
          : Promise.resolve({ items: [] as MediaHubClip[], total: 0 }),
        catalogApi.getClips({ limit: TRACK_FETCH_LIMIT, sort_by: 'recorded_at' }),
      ]);
      return [...inCategory.items, ...newest.items];
    },
    enabled: !!clip,
    retry: 0,
    staleTime: WORDPRESS_CATALOG_STALE_MS,
  });

  const { data: series } = useQuery({
    queryKey: ['catalog', 'wordpress', 'series', seriesSlug],
    queryFn: () => catalogApi.getWordPressSeriesDetail(seriesSlug!),
    enabled: !!seriesSlug,
    retry: 0,
    staleTime: WORDPRESS_CATALOG_STALE_MS,
  });

  const { data: doctorIndex = [] } = useQuery({
    queryKey: ['catalog', 'doctors'],
    queryFn: catalogApi.getDoctors,
    enabled: (clip?.doctors?.length ?? 0) > 0,
    retry: 0,
    staleTime: WORDPRESS_CATALOG_STALE_MS,
  });

  const track = useMemo(() => {
    const seen = new Set<string>();
    const out: MediaHubClip[] = [];
    for (const candidate of trackPool) {
      if (!candidate?.id) continue;
      if (candidate.id === clip?.id) continue;
      if (getShortClipId(candidate.id) === clipId) continue;
      if (seen.has(candidate.id)) continue;
      if (!shouldSurfaceCatalogClip(candidate)) continue;
      seen.add(candidate.id);
      out.push(candidate);
    }
    return out;
  }, [trackPool, clip?.id, clipId]);

  const queue = track.slice(0, 5);
  const related = track.slice(0, 3);

  const canonicalUrl = clip?.wordpress?.permalink;

  useEffect(() => {
    if (!clip?.id || !clip?.title) return;
    pushClipView({ clip_id: clip.id, clip_title: clip.title, surface: 'clip_detail' });
  }, [clip?.id, clip?.title]);

  useEffect(() => {
    if (!canonicalUrl) return;
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = canonicalUrl;
    return () => {
      if (link?.parentNode) link.parentNode.removeChild(link);
    };
  }, [canonicalUrl]);

  /* ── states ───────────────────────────────────────────────────────── */

  if (!clipId) {
    return (
      <Shell isInApp={isInApp}>
        <section className="rail py-24">
          <div className="card mx-auto max-w-[34rem] px-8 py-16 text-center">
            <p className="display text-display-s text-text">No session in this link</p>
            <p className="prose-lede mx-auto mt-3 max-w-[30rem] text-body-m text-muted2">
              The address is missing the session it should open.
            </p>
            <div className="mt-7 flex justify-center">
              <Button to={`${base}/catalog`} variant="outline">
                Browse the library
              </Button>
            </div>
          </div>
        </section>
      </Shell>
    );
  }

  if (skipLinkedInClip) {
    return <Navigate to={`${base}/catalog`} replace />;
  }

  if (isLoading) {
    return (
      <Shell isInApp={isInApp}>
        <div className="rail flex min-h-[60vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-faint" aria-label="Loading session" />
        </div>
      </Shell>
    );
  }

  if (isError || !clip) {
    return (
      <Shell isInApp={isInApp}>
        <section className="rail py-24">
          <div className="card mx-auto max-w-[34rem] px-8 py-16 text-center">
            <p className="display text-display-s text-text">This session is not available</p>
            <p className="prose-lede mx-auto mt-3 max-w-[30rem] text-body-m text-muted2">
              {(error as Error)?.message || 'It may have moved, or it was never published here.'}
            </p>
            <div className="mt-7 flex justify-center">
              <Button to={`${base}/catalog`} variant="outline">
                Browse the library
              </Button>
            </div>
          </div>
        </section>
      </Shell>
    );
  }

  const youtubeUrl = clipYoutubeUrl(clip);
  if (!extractYoutubeVideoIdFromUrl(youtubeUrl)) {
    // Nothing this page can play. The library is the honest destination.
    return <Navigate to={`${base}/catalog`} replace />;
  }

  /* ── the record, in the design's slots ────────────────────────────── */

  const hrefFor = (c: MediaHubClip) => `${base}/catalog/clip/${getShortClipId(c.id)}`;

  const categoryLabel = category ? formatWordPressCategoryLabel(category) : null;
  const seriesLabel = seriesSlug
    ? (series?.name ?? formatWordPressSeriesLabel(seriesSlug))
    : null;

  const lede = clipDisplaySummary(clip);
  const viewCount = readNumber(clip, 'view_count', 'viewCount');
  const postedRaw = readString(clip, 'posted_at', 'postedAt');
  const posted = postedRaw ? new Date(postedRaw) : null;
  const postedLabel = posted && isValid(posted) ? formatDate(posted, 'd MMMM yyyy') : null;

  const categories = clip.wordpress?.categories ?? [];
  const tags = readerTags(clip);
  const doctors = clip.doctors ?? [];

  const showLoginPrompt = !isAuthenticated || !user;

  return (
    <Shell isInApp={isInApp}>
      <div className="rail pt-8">
        <nav aria-label="Breadcrumb" className="meta flex flex-wrap items-center gap-2 text-faint">
          <Link
            to={`${base}/catalog`}
            className="press -my-1.5 inline-block rounded-[6px] py-1.5 hover:text-anchor"
          >
            Latest
          </Link>
          {category && categoryLabel ? (
            <>
              <span aria-hidden>/</span>
              <Link
                to={`${base}/catalog/${encodeURIComponent(category)}`}
                className="press -my-1.5 inline-block rounded-[6px] py-1.5 hover:text-anchor"
              >
                {categoryLabel}
              </Link>
            </>
          ) : null}
          {seriesSlug && seriesLabel ? (
            <>
              <span aria-hidden>/</span>
              <Link
                to={`${base}/catalog/playlist/series/${encodeURIComponent(seriesSlug)}`}
                className="press -my-1.5 inline-block rounded-[6px] py-1.5 hover:text-anchor"
              >
                {seriesLabel}
              </Link>
            </>
          ) : null}
        </nav>
      </div>

      <section className="rail grid gap-10 pt-6 pb-14 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0">
          <SessionPlayer clip={clip} youtubeUrl={youtubeUrl} queue={queue} hrefFor={hrefFor} />
        </div>

        <aside className="space-y-4">
          <div>
            <Eyebrow>
              {clip.is_short ? 'clip' : 'video'}
              {categoryLabel ? ` · ${categoryLabel}` : ''}
            </Eyebrow>
            <h1 className="display display-tight mt-3 text-[1.75rem] leading-[1.12] text-text">
              {clip.title}
            </h1>
            {lede ? <p className="prose-lede mt-3 text-body-s text-muted2">{lede}</p> : null}

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
              {postedLabel ? <span className="meta text-faint">{postedLabel}</span> : null}
              {viewCount > 0 ? (
                <span className="meta tabular-nums text-faint">{formatCount(viewCount)} views</span>
              ) : null}
            </div>

            {/* Tags are filters: each one opens the library narrowed to
                it. Colour is by kind, not per tag. */}
            {categories.length > 0 || tags.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {categories.map((c) => (
                  <li key={`wp-${c}`}>
                    <Chip kind="site" to={`${base}/catalog/${encodeURIComponent(c)}`}>
                      {formatWordPressCategoryLabel(c)}
                    </Chip>
                  </li>
                ))}
                {tags.map((t) => (
                  <li key={`tag-${t}`}>
                    <Chip kind={chipKind(t)} to={`${base}/catalog?q=${encodeURIComponent(t)}`}>
                      {t}
                    </Chip>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* The page is open to everyone; the account is what carries a
              session across visits. The prompt says so rather than
              blocking the play button. */}
          {showLoginPrompt ? (
            <div className="card p-5">
              <Eyebrow tone="amber">Free to watch</Eyebrow>
              <p className="display mt-2 text-body-l text-text">Keep your track</p>
              <p className="mt-1.5 text-body-s text-muted2">
                An account saves sessions, follows a series, and opens Live and CHM Office Hours.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button to="/join" size="sm" variant="cta">
                  Join CHM
                </Button>
                <Button to="/login" size="sm" variant="outline">
                  Sign in
                </Button>
              </div>
            </div>
          ) : null}

          {doctors.length > 0 ? (
            <div className="card p-5">
              <Eyebrow>In conversation</Eyebrow>
              <ul className="mt-4 space-y-4">
                {doctors.map((slug) => {
                  const name = doctorLabelFromSlug(slug);
                  const entry = doctorIndex.find((d) => d.slug === slug);
                  const sessions = entry?.shoot_count ?? entry?.post_count ?? 0;
                  return (
                    <li key={slug}>
                      <Link
                        to={`${base}/catalog?doctor=${encodeURIComponent(slug)}`}
                        className="press group flex items-center gap-3"
                      >
                        <span
                          aria-hidden
                          className="img-ring grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 font-mono text-[0.75rem] tracking-[0.04em] text-muted2"
                        >
                          {initials(name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-body-s font-medium text-text group-hover:text-anchor">
                            {name}
                          </span>
                          <span className="block truncate text-[0.75rem] text-muted2">
                            {sessions > 0 ? `${sessions} sessions on CHM` : 'CHM faculty'}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {seriesSlug && seriesLabel ? (
            <Link
              to={`${base}/catalog/playlist/series/${encodeURIComponent(seriesSlug)}`}
              className="card press lift block p-5"
            >
              <Eyebrow>Part of the series</Eyebrow>
              <p className="display mt-2 text-body-l text-text">{seriesLabel}</p>
              {series?.description ? (
                <p className="mt-1.5 text-body-s text-muted2">{series.description}</p>
              ) : null}
              <p className="eyebrow mt-3 text-anchor">
                {series?.post_count ? `${series.post_count} episodes →` : 'Open the series →'}
              </p>
            </Link>
          ) : null}
        </aside>
      </section>

      {related.length > 0 ? (
        <section aria-labelledby="track-heading" className="rail pb-16">
          <SectionHead
            id="track-heading"
            title="Next in this track"
            seeAll={
              category && categoryLabel
                ? {
                    noun: `${categoryLabel} sessions`,
                    to: `${base}/catalog/${encodeURIComponent(category)}`,
                  }
                : { noun: 'sessions', to: `${base}/catalog` }
            }
          />
          <Reveal className="mt-7">
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => (
                <li key={r.id}>
                  <CompactCard clip={r} to={hrefFor(r)} />
                </li>
              ))}
            </ul>
          </Reveal>
        </section>
      ) : null}
    </Shell>
  );
}
