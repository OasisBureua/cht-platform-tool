import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, isValid } from 'date-fns';
import { ArrowRight, Loader2, Play } from 'lucide-react';
import { catalogApi, type MediaHubClip } from '../api/catalog';
import { YouTubePlayer } from '../components/YouTubePlayer';
import { Button, Chip, chipKind, SectionHead, Thumb } from '../components/ui';
import { APP_CATALOG_CONVERSATIONS_HUB } from '../components/navigation/appNavItems';
import { pushClipView } from '../lib/analytics';
import {
  extractYoutubeVideoIdFromUrl,
  getMediaHubThumbnail,
  getShortClipId,
  shouldSurfaceCatalogClip,
} from '../utils/clipUrl';
import { clipDisplaySummary } from '../utils/mediaHubClipText';
import { doctorLabelFromSlug } from '../utils/doctorLabel';
import {
  formatWordPressCategoryLabel,
  formatWordPressSeriesLabel,
  WORDPRESS_CATALOG_STALE_MS,
} from '../utils/wordpressCatalog';

/* ── the track ────────────────────────────────────────────────────────
   A track is only useful if it is actually a track. Start with the
   series the session sits in, widen to the doctor who recorded it, then
   to the newest of everything, and stop at eight. A single lonely card
   was the old behaviour. */
const TRACK_LIMIT = 8;
const QUEUE_LIMIT = 5;
const RELATED_LIMIT = 3;

function formatDuration(seconds: number | undefined): string {
  if (!seconds || seconds < 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function prettyDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isValid(d) ? format(d, 'MMM d, yyyy') : '';
}

/** `brand:` tags are internal bookkeeping and are never shown to a reader. */
function readerTags(clip: MediaHubClip): string[] {
  return (clip.tags ?? []).filter((t) => typeof t === 'string' && !t.startsWith('brand:'));
}

function clipHref(clip: MediaHubClip): string {
  return `/app/clip/${getShortClipId(clip.id)}`;
}

function youtubeUrlOf(clip: MediaHubClip): string {
  const raw = clip.youtube_url ?? (clip as { youtubeUrl?: string }).youtubeUrl ?? '';
  return typeof raw === 'string' ? raw : '';
}

function monogram(label: string): string {
  const words = label.replace(/^Dr\.?\s*/i, '').split(/\s+/).filter(Boolean);
  return (words[0]?.[0] ?? '') + (words[words.length - 1]?.[0] ?? '');
}

/**
 * The session player. The frame carries its own depth and lets the
 * poster keep its colour: a tinted wash over the artwork hid the
 * faculty and made every session look identical.
 *
 * Pressing play swaps the poster for the real embed, so playback keeps
 * the GA4 start / progress / complete events `YouTubePlayer` already
 * fires. `queue` is the rest of the track. It replaces the old chapter
 * timestamps, which were the least useful thing that could occupy the
 * most valuable strip on the page.
 */
function SessionPlayer({ clip, queue }: { clip: MediaHubClip; queue: MediaHubClip[] }) {
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const duration = clip.duration_seconds ?? 0;
  const durationLabel = formatDuration(duration);
  const youtubeUrl = youtubeUrlOf(clip);
  const playable = !!extractYoutubeVideoIdFromUrl(youtubeUrl);

  // The position ticker, same technique the programme player already
  // uses: one second at a time, only while the tab is actually visible,
  // clamped to the recorded duration.
  useEffect(() => {
    if (!playing || !duration) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setElapsed((s) => Math.min(s + 1, duration));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [playing, duration]);

  const progress = duration ? Math.min(100, Math.round((elapsed / duration) * 100)) : 0;

  return (
    <div className="overflow-hidden rounded-[8px] bg-surface shadow-card">
      <div className="relative aspect-video w-full">
        {playing && playable ? (
          <YouTubePlayer
            youtubeUrl={youtubeUrl}
            title={clip.title}
            autoplay
            muted={false}
            className="absolute inset-0 size-full"
          />
        ) : (
          <>
            <img
              src={getMediaHubThumbnail(clip)}
              alt=""
              referrerPolicy="no-referrer"
              className="absolute inset-0 size-full object-cover"
            />
            {/* Just enough scrim at the foot to carry the overlaid meta.
                Permanently dark, so what sits on it takes fixed white. */}
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-black/10"
            />
            <button
              type="button"
              onClick={() => setPlaying(true)}
              disabled={!playable}
              aria-label={`Play ${clip.title}`}
              className="group absolute inset-0 grid place-items-center disabled:cursor-not-allowed"
            >
              <span className="press grid size-[4.5rem] place-items-center rounded-full bg-text text-ground shadow-pop transition-[scale] duration-150 ease-[var(--ease-standard)] group-hover:scale-105">
                <Play className="size-7 ms-0.5" fill="currentColor" strokeWidth={0} />
              </span>
            </button>
            {durationLabel ? (
              <span className="meta absolute end-4 bottom-4 text-white/85">
                Video · {durationLabel}
              </span>
            ) : null}
          </>
        )}
      </div>

      <div className="px-4 py-3.5">
        <div
          role="progressbar"
          aria-label="Playback position"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={`${progress}% through ${clip.title}`}
          className="h-1 w-full overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--color-text)_14%,transparent)]"
        >
          <div
            className="h-full rounded-full bg-anchor transition-[width] duration-500 ease-[var(--ease-out-strong)]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          {/* State is carried by the label, not only by the icon swap. */}
          <p className="meta text-muted2">{playing ? 'Playing' : 'Paused'}</p>
          {durationLabel ? (
            <p className="meta tabular-nums text-muted2">{durationLabel}</p>
          ) : null}
        </div>
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
                  to={clipHref(q)}
                  className="press group flex items-center gap-3 rounded-[6px] p-2 hover:bg-[color-mix(in_oklab,var(--color-text)_6%,transparent)]"
                >
                  <span className="meta w-5 shrink-0 tabular-nums text-faint">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="relative block h-12 w-[5.25rem] shrink-0 overflow-hidden rounded-[6px] bg-ground">
                    <img
                      src={getMediaHubThumbnail(q)}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="size-full object-cover"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-s text-dim group-hover:text-text">
                      {q.title}
                    </span>
                    <span className="meta mt-0.5 block tabular-nums text-faint">
                      {formatDuration(q.duration_seconds) || 'Video'}
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

/** Track card. Tags are spans, not links: the card is already one link,
    and nesting a second inside it is invalid. */
function CompactSessionCard({ clip }: { clip: MediaHubClip }) {
  const tags = readerTags(clip).slice(0, 2);
  const durationLabel = formatDuration(clip.duration_seconds);
  return (
    <Link
      to={clipHref(clip)}
      className="press lift group flex h-full flex-col gap-4 rounded-[6px] p-4 shadow-card"
    >
      <Thumb src={getMediaHubThumbnail(clip)} className="aspect-video w-full" />
      <div className="flex flex-1 flex-col px-1 pb-1">
        <h3 className="display line-clamp-2 text-body-m text-text">{clip.title}</h3>
        {tags.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <li key={t}>
                <Chip kind={chipKind(t)} className="h-6 px-2 text-[0.6875rem] leading-none">
                  {t}
                </Chip>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="meta mt-auto pt-4 tabular-nums text-faint">{durationLabel || 'Video'}</p>
      </div>
    </Link>
  );
}

export default function Watch() {
  /* The page is mounted inside the app shell, which already pads its
     outlet, so nothing here adds a `.rail` or a second page header. */
  const { videoId, id } = useParams<{ videoId?: string; id?: string }>();
  const routeClipId = (videoId ?? id ?? '').trim();

  const {
    data: clip,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['catalog', 'clip', 'watch', routeClipId],
    queryFn: async (): Promise<MediaHubClip | null> => {
      if (routeClipId) {
        const direct = await catalogApi.getClip(routeClipId);
        if (direct && shouldSurfaceCatalogClip(direct)) return direct;
      }
      // No id on the route: the surface opens on the newest playable
      // session rather than on nothing.
      const { items } = await catalogApi.getClips({ sort_by: 'recorded_at', limit: 12 });
      return items.find((c) => shouldSurfaceCatalogClip(c)) ?? null;
    },
    retry: 0, // 404s from MediaHub are expected; a retry only slows the miss down
    staleTime: WORDPRESS_CATALOG_STALE_MS,
  });

  const categorySlug = clip?.wordpress?.categories?.[0];
  const seriesSlug = clip?.wordpress?.series?.[0];
  const leadDoctor = clip?.doctors?.[0];

  const { data: track = [] } = useQuery({
    queryKey: ['catalog', 'clips', 'watch-track', clip?.id, categorySlug, leadDoctor],
    queryFn: async (): Promise<MediaHubClip[]> => {
      const empty = { items: [] as MediaHubClip[], total: 0 };
      const [byCategory, byDoctor, newest] = await Promise.all([
        categorySlug
          ? catalogApi.getClips({
              wp_category: categorySlug,
              has_wordpress: true,
              sort_by: 'recorded_at',
              limit: TRACK_LIMIT,
            })
          : Promise.resolve(empty),
        leadDoctor
          ? catalogApi.getClips({ doctor: leadDoctor, sort_by: 'recorded_at', limit: TRACK_LIMIT })
          : Promise.resolve(empty),
        catalogApi.getClips({ sort_by: 'recorded_at', limit: TRACK_LIMIT }),
      ]);
      const seen = new Set<string>([clip?.id ?? '']);
      const out: MediaHubClip[] = [];
      for (const c of [...byCategory.items, ...byDoctor.items, ...newest.items]) {
        if (seen.has(c.id) || !shouldSurfaceCatalogClip(c)) continue;
        seen.add(c.id);
        out.push(c);
        if (out.length >= TRACK_LIMIT) break;
      }
      return out;
    },
    enabled: !!clip?.id,
    staleTime: WORDPRESS_CATALOG_STALE_MS,
  });

  const { data: seriesDetail } = useQuery({
    queryKey: ['catalog', 'wordpress', 'series', seriesSlug],
    queryFn: () => catalogApi.getWordPressSeriesDetail(seriesSlug!),
    enabled: !!seriesSlug,
    staleTime: WORDPRESS_CATALOG_STALE_MS,
  });

  const { data: wpCategories } = useQuery({
    queryKey: ['catalog', 'wordpress', 'categories'],
    queryFn: () => catalogApi.getWordPressCategories(),
    enabled: !!categorySlug,
    staleTime: WORDPRESS_CATALOG_STALE_MS,
  });

  useEffect(() => {
    if (!clip?.id || !clip?.title) return;
    pushClipView({ clip_id: clip.id, clip_title: clip.title, surface: 'clip_detail' });
  }, [clip?.id, clip?.title]);

  const queue = useMemo(() => track.slice(0, QUEUE_LIMIT), [track]);
  const related = useMemo(() => track.slice(0, RELATED_LIMIT), [track]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-faint" aria-label="Loading session" />
      </div>
    );
  }

  if (isError || !clip) {
    return (
      <div className="rounded-[6px] px-8 py-16 text-center shadow-card">
        <p className="display text-display-s text-text">That session is not available</p>
        <p className="prose-lede mx-auto mt-3 max-w-[34rem] text-body-m text-muted2">
          {(error as Error)?.message ||
            'It may have been unpublished, or the link points at a recording we cannot play here.'}
        </p>
        <div className="mt-7 flex justify-center">
          <Button to={APP_CATALOG_CONVERSATIONS_HUB} variant="outline">
            Back to Conversations
          </Button>
        </div>
      </div>
    );
  }

  const categoryLabel = categorySlug ? formatWordPressCategoryLabel(categorySlug) : '';
  const seriesLabel = seriesSlug ? formatWordPressSeriesLabel(seriesSlug) : '';
  const lede = clipDisplaySummary(clip);
  const postedLabel = prettyDate(clip.posted_at);
  const tags = readerTags(clip);
  const doctors = clip.doctors ?? [];
  const seriesCount = seriesDetail?.post_count ?? 0;
  const categoryCount =
    wpCategories?.items?.find((c) => c.slug === categorySlug)?.post_count ?? 0;
  const seeAllHref = categorySlug
    ? `/app/catalog/${categorySlug}`
    : `${APP_CATALOG_CONVERSATIONS_HUB}?view=clips`;

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="meta flex flex-wrap items-center gap-2 text-faint">
        <Link
          to={APP_CATALOG_CONVERSATIONS_HUB}
          className="press -my-1.5 inline-block rounded-[6px] py-1.5 hover:text-anchor"
        >
          Conversations
        </Link>
        {categorySlug ? (
          <>
            <span aria-hidden>/</span>
            <Link
              to={`/app/catalog/${categorySlug}`}
              className="press -my-1.5 inline-block rounded-[6px] py-1.5 hover:text-anchor"
            >
              {categoryLabel}
            </Link>
          </>
        ) : null}
        {seriesSlug ? (
          <>
            <span aria-hidden>/</span>
            <Link
              to={`${APP_CATALOG_CONVERSATIONS_HUB}?q=${encodeURIComponent(seriesLabel)}`}
              className="press -my-1.5 inline-block rounded-[6px] py-1.5 hover:text-anchor"
            >
              {seriesLabel}
            </Link>
          </>
        ) : null}
      </nav>

      <section className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div>
          <SessionPlayer clip={clip} queue={queue} />
        </div>

        <aside className="space-y-4">
          <div>
            <p className="eyebrow text-muted2">
              Conversation{categoryLabel ? ` · ${categoryLabel}` : ''}
            </p>
            <h1 className="display display-tight mt-3 text-[1.75rem] leading-[1.12] text-text">
              {clip.title}
            </h1>
            {lede ? <p className="prose-lede mt-3 text-body-s text-muted2">{lede}</p> : null}

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
              {postedLabel ? <span className="meta text-faint">{postedLabel}</span> : null}
              <span className="meta tabular-nums text-faint">
                {(clip.view_count ?? 0).toLocaleString()} views
              </span>
            </div>

            {/* Tags are filters: each one opens the library narrowed to
                it. Colour is by kind, not per tag. */}
            {tags.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {tags.map((t) => (
                  <li key={t}>
                    <Chip
                      kind={chipKind(t)}
                      to={`${APP_CATALOG_CONVERSATIONS_HUB}?tag=${encodeURIComponent(t)}`}
                      className="h-8 px-3 text-body-s"
                    >
                      {t}
                    </Chip>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {doctors.length > 0 ? (
            <div className="card p-5">
              <p className="eyebrow text-muted2">In conversation</p>
              <ul className="mt-4 space-y-4">
                {doctors.map((slug) => {
                  const name = doctorLabelFromSlug(slug);
                  return (
                    <li key={slug}>
                      <Link
                        to={`${APP_CATALOG_CONVERSATIONS_HUB}?doctor=${encodeURIComponent(slug)}`}
                        className="press group flex items-center gap-3"
                      >
                        <span className="img-ring grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-body-s font-medium uppercase text-dim">
                          {monogram(name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-body-s font-medium text-text group-hover:text-anchor">
                            {name}
                          </span>
                          <span className="block truncate text-[0.75rem] text-muted2">
                            {categoryLabel ? `${categoryLabel} faculty` : 'CHM faculty'}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {seriesSlug ? (
            <Link
              to={`${APP_CATALOG_CONVERSATIONS_HUB}?q=${encodeURIComponent(seriesLabel)}`}
              className="card press lift block p-5"
            >
              <p className="eyebrow text-muted2">Part of the series</p>
              <p className="display mt-2 text-body-l text-text">{seriesLabel}</p>
              {seriesDetail?.description ? (
                <p className="mt-1.5 text-body-s text-muted2">{seriesDetail.description}</p>
              ) : null}
              {seriesCount > 0 ? (
                <p className="eyebrow mt-3 text-anchor">{seriesCount} sessions →</p>
              ) : null}
            </Link>
          ) : null}

          {categorySlug ? (
            <Link to={`/app/catalog/${categorySlug}`} className="card press lift block p-5">
              <p className="eyebrow text-muted2">From the area</p>
              <p className="display mt-2 text-body-l text-text">{categoryLabel}</p>
              <p className="mt-1.5 text-body-s text-muted2">
                Every recorded conversation filed under {categoryLabel}, newest first.
              </p>
              {categoryCount > 0 ? (
                <p className="eyebrow mt-3 text-anchor">{categoryCount} sessions →</p>
              ) : null}
            </Link>
          ) : null}
        </aside>
      </section>

      {related.length > 0 ? (
        <section aria-label="Next in this track" className="pt-4">
          <SectionHead
            title="Next in this track"
            action={
              <Link
                to={seeAllHref}
                className="press inline-flex h-10 shrink-0 items-center gap-2 rounded-[6px] bg-surface px-5 text-body-s text-dim shadow-card hover:bg-ground hover:text-text hover:shadow-card-hover"
              >
                See all {categoryLabel ? `${categoryLabel} sessions` : 'sessions'}
                <ArrowRight className="size-4" strokeWidth={1.75} />
              </Link>
            }
          />
          <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <li key={r.id}>
                <CompactSessionCard clip={r} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
