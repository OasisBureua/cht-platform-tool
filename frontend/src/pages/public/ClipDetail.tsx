import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, isValid } from 'date-fns';
import { ArrowRight, Loader2 } from 'lucide-react';
import { ShareButtons } from '../../components/ShareButtons';
import { YouTubePlayer } from '../../components/YouTubePlayer';
import { Button, Chip, chipKind, Reveal, SectionHead, Thumb } from '../../components/ui';
import { catalogApi } from '../../api/catalog';
import type { GetClipsParams, MediaHubClip } from '../../api/catalog';
import { pushClipView } from '../../lib/analytics';
import { clipAiSummaryText } from '../../utils/mediaHubClipText';
import { doctorLabelFromSlug } from '../../utils/doctorLabel';
import {
  WORDPRESS_CATALOG_STALE_MS,
  formatWordPressCategoryLabel,
  formatWordPressSeriesLabel,
} from '../../utils/wordpressCatalog';
import {
  extractYoutubeVideoIdFromUrl,
  getMediaHubThumbnail,
  getShortClipId,
  isLinkedinCatalogClipId,
  nextCatalogThumbnailFallback,
  shouldSurfaceCatalogClip,
} from '../../utils/clipUrl';

/** Normalize clip from API (handles snake_case and camelCase) */
function normalizeClip(raw: Record<string, unknown>): {
  doctors: string[];
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  postedAt?: string;
} {
  const get = (snake: string, camel: string) =>
    (raw[snake] ?? raw[camel]) as number | string | undefined;
  const num = (snake: string, camel: string) => {
    const v = get(snake, camel);
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string') return parseInt(v, 10) || 0;
    return 0;
  };
  const arr = (snake: string, camel: string) => {
    const v = get(snake, camel);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  };
  return {
    doctors: arr('doctors', 'doctors'),
    durationSeconds: num('duration_seconds', 'durationSeconds'),
    viewCount: num('view_count', 'viewCount'),
    likeCount: num('like_count', 'likeCount'),
    commentCount: num('comment_count', 'commentCount'),
    postedAt: (get('posted_at', 'postedAt') as string) || undefined,
  };
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '-';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Runtime, or nothing at all: a session with no known length shows no slot. */
function runtimeOf(seconds: number | undefined): string | undefined {
  return seconds && seconds > 0 ? formatDuration(seconds) : undefined;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function getClipShootId(raw: Record<string, unknown>): string | undefined {
  const v = raw.shoot_id ?? raw.shootId;
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

/** `biomarker:HER2+` is how the feed stores it; the chip shows `HER2+`. */
function tagLabel(value: string): string {
  const idx = value.indexOf(':');
  return idx === -1 ? value : value.slice(idx + 1);
}

/** `brand:` tags are internal and never shown to users. */
function publicTags(clip: MediaHubClip | null | undefined): string[] {
  return (clip?.tags ?? []).filter((t) => !String(t).startsWith('brand:'));
}

function initialsOf(name: string): string {
  const words = name
    .replace(/^dr\.?\s*/i, '')
    .split(/\s+/)
    .filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

/**
 * The narrowest real facet this clip gives us to build a track from.
 * Category first, then the faculty it features, then a marker — the
 * same widening the library itself does.
 */
function trackParamsFor(clip: MediaHubClip | null | undefined): GetClipsParams | null {
  if (!clip) return null;
  const category = clip.wordpress?.categories?.[0];
  if (category) {
    return { has_wordpress: true, wp_category: category, sort_by: 'recorded_at', limit: 12 };
  }
  const doctor = clip.doctors?.[0];
  if (doctor) return { doctor, sort_by: 'recorded_at', limit: 12 };
  const tag = publicTags(clip)[0];
  if (tag) return { tag, sort_by: 'recorded_at', limit: 12 };
  return null;
}

/**
 * The poster. `Thumb` owns the scrim, the mark and the runtime; this
 * only walks the YouTube poster sizes when ContentHub hands us a URL
 * that 404s.
 */
function ClipThumb({
  clip,
  duration,
  className = '',
}: {
  clip: MediaHubClip;
  duration?: string;
  className?: string;
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

  return (
    <Thumb
      src={src}
      duration={duration}
      className={className}
      onError={() => {
        const next = nextCatalogThumbnailFallback(src, videoId);
        if (next) setSrc(next);
      }}
    />
  );
}

/**
 * The session player. The frame carries its own depth and the artwork
 * keeps its own colour — no tinted wash over it.
 *
 * The strip under the frame carries the session's real numbers, and
 * below it the rest of the track sits as a queue: the most valuable
 * strip on the page, spent on where to go next rather than on chapter
 * timestamps.
 */
function Player({
  formatLabel,
  runtime,
  engagement,
  youtubeUrl,
  title,
  queue,
  hrefFor,
}: {
  formatLabel: string;
  runtime?: string;
  engagement: string[];
  youtubeUrl: string;
  title: string;
  queue: MediaHubClip[];
  hrefFor: (clip: MediaHubClip) => string;
}) {
  return (
    <div className="overflow-hidden rounded-[8px] bg-surface shadow-card">
      {/* The real embed, with its own controls and its own GA4 events. */}
      <div className="relative aspect-video w-full bg-surface-2">
        <YouTubePlayer
          youtubeUrl={youtubeUrl}
          title={title}
          autoplay={false}
          muted={false}
          className="size-full"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3.5">
        <p className="meta text-muted2">
          {formatLabel}
          {runtime ? ` · ${runtime}` : ''}
        </p>
        {engagement.length > 0 ? (
          <p className="meta tabular-nums text-muted2">{engagement.join(' · ')}</p>
        ) : null}
      </div>

      {queue.length > 0 ? (
        <>
          <h2 id="queue-heading" className="eyebrow px-4 pt-1 pb-2 text-faint">
            Up next in this track
          </h2>
          <ol aria-labelledby="queue-heading" className="px-2 pb-2">
            {queue.map((q, i) => (
              <li key={q.id}>
                <Link
                  to={hrefFor(q)}
                  state={{ clip: q }}
                  className="press group flex items-center gap-3 rounded-[6px] p-2 hover:bg-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="meta w-5 shrink-0 tabular-nums text-faint">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <ClipThumb clip={q} className="h-12 w-[5.25rem] shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-s text-dim group-hover:text-text">
                      {q.title}
                    </span>
                    <span className="meta mt-0.5 block tabular-nums text-faint">
                      {runtimeOf(q.duration_seconds) ??
                        (q.doctors?.[0] ? doctorLabelFromSlug(q.doctors[0]) : 'Full session')}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </div>
  );
}

export default function ClipDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isInApp = location.pathname.startsWith('/app');
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}${location.pathname}` : '';
  const skipLinkedInClip = !!id && isLinkedinCatalogClipId(id);
  const stateClip = (location.state as { clip?: MediaHubClip } | null)?.clip;
  const stateClipMatches =
    !!stateClip &&
    !!id &&
    (stateClip.id === id || getShortClipId(stateClip.id) === id);

  const { data: clip, isLoading, isError, error } = useQuery({
    queryKey: ['catalog', 'clip', id],
    queryFn: async () => {
      const fromApi = await catalogApi.getClip(id!);
      if (fromApi) return fromApi;
      // ContentHub detail may 404; keep navigated clip so the player still works.
      if (stateClipMatches) return stateClip!;
      return null;
    },
    enabled: !!id && !skipLinkedInClip,
    retry: 0, // 404s from MediaHub are expected; don't retry
    placeholderData: stateClipMatches ? stateClip : undefined,
  });

  const clipRecord = clip && typeof clip === 'object' ? (clip as unknown as Record<string, unknown>) : undefined;
  const transcriptShootId = clipRecord ? getClipShootId(clipRecord) : undefined;

  const { data: transcript, isLoading: transcriptLoading } = useQuery({
    queryKey: ['catalog', 'transcript', transcriptShootId],
    queryFn: () => catalogApi.getTranscript(transcriptShootId!),
    enabled: !!transcriptShootId,
    retry: 0,
  });

  const meta = useMemo(
    () => normalizeClip((clipRecord ?? {}) as Record<string, unknown>),
    [clipRecord],
  );

  const wp = clip?.wordpress;
  const category = wp?.categories?.[0];
  const seriesSlug = wp?.series?.[0];

  /* ── the track ─────────────────────────────────────────────────────
     Start with the narrowest facet the clip carries, widen to the
     newest of the whole library when that comes back thin. A single
     lonely card is not a track. */

  const trackParams = useMemo(() => trackParamsFor(clip), [clip]);

  const { data: trackPage } = useQuery({
    queryKey: [
      'catalog',
      'clips',
      'track',
      trackParams?.wp_category ?? trackParams?.doctor ?? trackParams?.tag ?? 'none',
    ],
    queryFn: () => catalogApi.getClips(trackParams!),
    enabled: !!trackParams,
    staleTime: WORDPRESS_CATALOG_STALE_MS,
  });

  const nearby = useMemo(
    () => (trackPage?.items ?? []).filter((c) => shouldSurfaceCatalogClip(c)),
    [trackPage],
  );

  const { data: latestPage } = useQuery({
    queryKey: ['catalog', 'clips', 'track', 'latest'],
    queryFn: () => catalogApi.getClips({ sort_by: 'recorded_at', limit: 12 }),
    enabled: !!clip && nearby.length < 8,
    staleTime: WORDPRESS_CATALOG_STALE_MS,
  });

  const track = useMemo(() => {
    if (!clip) return [];
    const self = getShortClipId(clip.id);
    const seen = new Set<string>([self]);
    const out: MediaHubClip[] = [];
    for (const c of [...nearby, ...(latestPage?.items ?? [])]) {
      const key = getShortClipId(c.id);
      if (seen.has(key) || c.id === clip.id) continue;
      if (!shouldSurfaceCatalogClip(c)) continue;
      seen.add(key);
      out.push(c);
    }
    return out;
  }, [clip, nearby, latestPage]);

  const queue = track.slice(0, 5);
  const related = track.slice(0, 3);

  /* ── faculty and series, for the rail's cards ──────────────────── */

  const { data: doctorDirectory = [] } = useQuery({
    queryKey: ['catalog', 'doctors'],
    queryFn: () => catalogApi.getDoctors(),
    staleTime: 30 * 60 * 1000,
    enabled: meta.doctors.length > 0,
  });

  const { data: seriesDetail } = useQuery({
    queryKey: ['catalog', 'wordpress', 'series', seriesSlug],
    queryFn: () => catalogApi.getWordPressSeriesDetail(seriesSlug!),
    enabled: !!seriesSlug,
    staleTime: WORDPRESS_CATALOG_STALE_MS,
  });

  const canonicalUrl = clip?.wordpress?.permalink;

  useEffect(() => {
    if (!clip?.id || !clip?.title) return;
    pushClipView({
      clip_id: clip.id,
      clip_title: clip.title,
      surface: 'clip_detail',
    });
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

  const catalogBase = isInApp ? '/app/catalog' : '/catalog';
  const libraryLabel = isInApp ? 'Conversations' : 'Content Library';
  const clipHref = (c: MediaHubClip) =>
    isInApp ? `/app/clip/${getShortClipId(c.id)}` : `/catalog/clip/${getShortClipId(c.id)}`;

  if (!id) {
    return (
      <div className="min-h-screen min-w-0 bg-ground text-text">
        <div className="rail flex min-h-[60vh] flex-col items-center justify-center gap-5 py-24 text-center">
          <p className="display text-display-s text-text">That link has no session on it</p>
          <p className="prose-lede max-w-[42ch] text-body-m text-muted2">
            The address is missing the part that names a recording.
          </p>
          <Button to={catalogBase} variant="outline">
            Back to the {libraryLabel.toLowerCase()}
          </Button>
        </div>
      </div>
    );
  }

  if (skipLinkedInClip) {
    return <Navigate to={catalogBase} replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen min-w-0 bg-ground text-text">
        <div role="status" className="rail flex min-h-[60vh] items-center justify-center py-24">
          <Loader2 className="size-10 animate-spin text-faint" aria-hidden />
          <span className="sr-only">Loading this session</span>
        </div>
      </div>
    );
  }

  if (isError || !clip) {
    return (
      <div className="min-h-screen min-w-0 bg-ground text-text">
        <div className="rail flex min-h-[60vh] flex-col items-center justify-center gap-5 py-24 text-center">
          <p className="display text-display-s text-text">This session would not load</p>
          <p className="prose-lede max-w-[42ch] text-body-m text-muted2">
            {(error as Error)?.message ||
              'It may have been unpublished since the link was made.'}
          </p>
          <Button to={catalogBase} variant="outline">
            Back to the {libraryLabel.toLowerCase()}
          </Button>
        </div>
      </div>
    );
  }

  const youtubeUrl =
    typeof clip.youtube_url === 'string'
      ? clip.youtube_url
      : typeof (clip as { youtubeUrl?: unknown }).youtubeUrl === 'string'
        ? (clip as { youtubeUrl: string }).youtubeUrl
        : '';

  if (!extractYoutubeVideoIdFromUrl(youtubeUrl)) {
    return <Navigate to={catalogBase} replace />;
  }

  const aiSummary = clipAiSummaryText(clip);
  const shootIdDisplay = transcriptShootId;
  const seriesLabel = seriesSlug
    ? seriesDetail?.name || formatWordPressSeriesLabel(seriesSlug)
    : null;
  const areaLabel = category ? formatWordPressCategoryLabel(category) : seriesLabel;
  const formatLabel = clip.is_short ? 'Clip' : 'Video';
  const runtime = runtimeOf(meta.durationSeconds);
  const posted = meta.postedAt ? new Date(meta.postedAt) : null;
  const engagement = [
    meta.likeCount > 0 ? `${formatCount(meta.likeCount)} likes` : null,
    meta.commentCount > 0 ? `${formatCount(meta.commentCount)} comments` : null,
  ].filter((v): v is string => !!v);
  const tags = publicTags(clip);

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-ground text-text">
      <div className="rail pt-8">
        <nav aria-label="Breadcrumb" className="meta flex flex-wrap items-center gap-2 text-faint">
          <Link
            to={catalogBase}
            className="press -my-1.5 inline-block rounded-[6px] py-1.5 hover:text-anchor"
          >
            {libraryLabel}
          </Link>
          {category ? (
            <>
              <span aria-hidden>/</span>
              <Link
                to={`${catalogBase}/${category}`}
                className="press -my-1.5 inline-block rounded-[6px] py-1.5 hover:text-anchor"
              >
                {formatWordPressCategoryLabel(category)}
              </Link>
            </>
          ) : null}
          {seriesLabel ? (
            <>
              <span aria-hidden>/</span>
              <Link
                to={`${catalogBase}?q=${encodeURIComponent(seriesLabel)}`}
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
          <Player
            formatLabel={formatLabel}
            runtime={runtime}
            engagement={engagement}
            youtubeUrl={youtubeUrl}
            title={clip.title}
            queue={queue}
            hrefFor={clipHref}
          />

          {/* Summary: the AI summary in full, under the frame it belongs to. */}
          <div className="mt-10">
            <h2 className="eyebrow text-faint">What this session covers</h2>
            {aiSummary ? (
              <p className="prose-lede mt-3 max-w-[68ch] whitespace-pre-wrap text-body-m text-muted2">
                {aiSummary}
              </p>
            ) : (
              <p className="mt-3 text-body-s text-faint">
                No summary written for this recording yet.
              </p>
            )}
          </div>

          {/* Transcript, when the shoot has speech-to-text in Media Hub. */}
          <div className="mt-10">
            <h2 className="eyebrow text-faint">Transcript</h2>
            {!shootIdDisplay ? (
              <p className="mt-3 text-body-s text-faint">
                This recording has no transcript linked yet.
              </p>
            ) : transcriptLoading ? (
              <div role="status" className="mt-4">
                <Loader2 className="size-6 animate-spin text-faint" aria-hidden />
                <span className="sr-only">Loading the transcript</span>
              </div>
            ) : transcript ? (
              <TranscriptDisplay data={transcript} />
            ) : (
              <p className="mt-3 text-body-s text-faint">
                No transcript available for this recording.
              </p>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div>
            <p className="eyebrow text-muted2">
              {areaLabel ? `${formatLabel} · ${areaLabel}` : formatLabel}
            </p>
            <h1 className="display display-tight mt-3 text-[1.75rem] leading-[1.12] text-text">
              {clip.title}
            </h1>
            {aiSummary ? (
              <p className="prose-lede mt-3 line-clamp-3 text-body-s text-muted2">{aiSummary}</p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
              {posted && isValid(posted) ? (
                <span className="meta text-faint">{format(posted, 'd MMM yyyy')}</span>
              ) : null}
              <span className="meta tabular-nums text-faint">
                {formatCount(meta.viewCount)} views
              </span>
            </div>

            {/* Tags are filters: each one opens the library narrowed to
                it. Colour is by kind, not per tag. */}
            {category || tags.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {(wp?.categories ?? []).map((cat) => (
                  <li key={`wp-${cat}`}>
                    <Chip kind="site" to={`${catalogBase}/${cat}`}>
                      {formatWordPressCategoryLabel(cat)}
                    </Chip>
                  </li>
                ))}
                {tags.map((tag) => {
                  const label = tagLabel(String(tag));
                  return (
                    <li key={tag}>
                      <Chip
                        kind={chipKind(label)}
                        to={`${catalogBase}?q=${encodeURIComponent(label)}`}
                      >
                        {label}
                      </Chip>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          {meta.doctors.length > 0 ? (
            <div className="card p-5">
              <p className="eyebrow text-muted2">In conversation</p>
              <ul className="mt-4 space-y-4">
                {meta.doctors.map((slug) => {
                  const name = doctorLabelFromSlug(slug);
                  const entry = doctorDirectory.find((d) => d.slug === slug);
                  const sessions = entry?.post_count ?? entry?.shoot_count ?? 0;
                  return (
                    <li key={slug}>
                      <Link
                        to={`${catalogBase}?doctor=${encodeURIComponent(slug)}`}
                        className="press group flex items-center gap-3"
                      >
                        <span
                          aria-hidden
                          className="img-ring grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-body-s font-medium text-dim"
                        >
                          {initialsOf(name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-body-s font-medium text-text group-hover:text-anchor">
                            {name}
                          </span>
                          {sessions > 0 ? (
                            <span className="meta mt-0.5 block tabular-nums text-muted2">
                              {sessions} {sessions === 1 ? 'session' : 'sessions'}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {seriesLabel ? (
            <Link
              to={`${catalogBase}?q=${encodeURIComponent(seriesLabel)}`}
              className="card press lift block p-5"
            >
              <p className="eyebrow text-muted2">Part of the series</p>
              <p className="display mt-2 text-body-l text-text">{seriesLabel}</p>
              {seriesDetail?.description ? (
                <p className="mt-1.5 text-body-s text-muted2">{seriesDetail.description}</p>
              ) : null}
              <p className="eyebrow mt-3 text-anchor">
                {seriesDetail?.post_count
                  ? `${seriesDetail.post_count} sessions →`
                  : 'See the series →'}
              </p>
            </Link>
          ) : null}

          {canonicalUrl ? (
            <a
              href={canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="card press lift block p-5"
            >
              <p className="eyebrow text-muted2">Also published</p>
              <p className="display mt-2 text-body-l text-text">Read the write-up</p>
              <p className="mt-1.5 text-body-s text-muted2">
                The published version of this conversation on the CHM site.
              </p>
              <p className="eyebrow mt-3 text-anchor">Open the article →</p>
            </a>
          ) : null}

          <div className="card p-5">
            <ShareButtons
              title={clip.title}
              url={shareUrl}
              analytics={{ clip_id: clip.id, surface: 'clip_detail' }}
            />
          </div>
        </aside>
      </section>

      {related.length > 0 ? (
        <section aria-labelledby="track-heading" className="rail pb-16">
          <SectionHead
            index="Next"
            title="Next in this track"
            action={
              <Button
                variant="outline"
                to={category ? `${catalogBase}/${category}` : catalogBase}
              >
                See all {areaLabel ? `${areaLabel} sessions` : 'sessions'}
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            }
          />
          <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r, i) => {
              const rTags = publicTags(r).slice(0, 2).map((t) => tagLabel(String(t)));
              const lead = r.doctors?.[0] ? doctorLabelFromSlug(r.doctors[0]) : null;
              return (
                <Reveal as="li" key={r.id} delay={i * 60} className="h-full">
                  <Link
                    to={clipHref(r)}
                    state={{ clip: r }}
                    className="press lift group flex h-full flex-col gap-4 rounded-[6px] p-4 shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <div className="relative">
                      <ClipThumb
                        clip={r}
                        duration={runtimeOf(r.duration_seconds)}
                        className="aspect-video w-full"
                      />
                      <div className="absolute top-3 start-3">
                        <span className="eyebrow inline-flex h-6 items-center rounded-[6px] bg-ground/70 px-3 text-text backdrop-blur-sm">
                          {r.is_short ? 'Clip' : 'Video'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col px-1 pb-1">
                      <h3 className="display line-clamp-2 text-body-m text-text">{r.title}</h3>
                      {/* Spans, not links: the card is already one link,
                          and nesting a second inside it is invalid. */}
                      {rTags.length > 0 ? (
                        <ul className="mt-3 flex flex-wrap gap-1.5">
                          {rTags.map((t) => (
                            <li key={t}>
                              <Chip kind={chipKind(t)}>{t}</Chip>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <p className="meta mt-auto pt-4 text-faint">{lead ?? 'Full session'}</p>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function TranscriptDisplay({ data }: { data: unknown }) {
  if (!data) return null;

  // MediaHub returns { transcript: string, shoot_id, shoot_name, doctors, length }
  if (typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;

    // Plain-string transcript (primary MediaHub shape)
    if (typeof obj.transcript === 'string' && obj.transcript.trim()) {
      const paragraphs = obj.transcript.split(/\n+/).filter(Boolean);
      return (
        <div className="card mt-4 max-h-96 space-y-3 overflow-y-auto p-5">
          {obj.shoot_name ? (
            <p className="eyebrow text-faint">{String(obj.shoot_name)}</p>
          ) : null}
          {paragraphs.map((para, i) => (
            <p key={i} className="text-body-s text-muted2">
              {para}
            </p>
          ))}
        </div>
      );
    }

    // Segment array under a `segments` key
    const segments = obj.segments;
    if (Array.isArray(segments)) {
      return <SegmentList segments={segments} />;
    }
  }

  // Top-level array of segments
  if (Array.isArray(data)) {
    return <SegmentList segments={data} />;
  }

  return <p className="mt-3 text-body-s text-faint">No transcript available for this recording.</p>;
}

function SegmentList({ segments }: { segments: unknown[] }) {
  return (
    <div className="card mt-4 max-h-96 space-y-3 overflow-y-auto p-5">
      {segments.map((seg, i) => {
        const s = seg as { speaker?: string; text?: string };
        return (
          <div key={i} className="flex gap-3">
            {s.speaker ? (
              <span className="shrink-0 text-body-s font-medium text-text">{s.speaker}:</span>
            ) : null}
            <span className="text-body-s text-muted2">{s.text ?? JSON.stringify(seg)}</span>
          </div>
        );
      })}
    </div>
  );
}
