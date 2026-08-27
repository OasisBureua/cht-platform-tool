import { useMemo, useState } from 'react';
import { SegmentedControl } from '../ui';
import { Link, useMatch } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Play, Sparkles, ChevronRight, Loader2 } from 'lucide-react';
import {
  CHM_PODCAST_PLATFORM_LINKS,
  type PodcastEpisode,
  type PodcastShow,
} from '../../data/podcastsCatalog';
import { usePodcastEpisodes } from '../../hooks/usePodcastYouTubeEpisodes';
import { formatViewCount } from '../../utils/youtubeDuration';
import type { PodcastEpisodeSort } from '../../utils/podcastYouTube';
import { podcastsApi } from '../../api/podcasts';
import { mapPodcastEpisodesToUi } from '../../utils/podcastYouTube';
import { podcastEpisodeWatchPath } from '../../utils/podcastRoutes';

export function latestEpisode(show: PodcastShow, episodes?: PodcastEpisode[]): PodcastEpisode | null {
  const eps = episodes?.length ? episodes : show.episodes;
  if (!eps.length) return null;
  const sorted = [...eps].sort(
    (a, b) => new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime(),
  );
  return sorted[0] ?? null;
}

const SORT_OPTIONS: { value: PodcastEpisodeSort; label: string }[] = [
  { value: 'latest', label: 'Latest' },
  { value: 'popular', label: 'Popular' },
  { value: 'oldest', label: 'Oldest' },
];

function EpisodeRow({ ep, showId }: { ep: PodcastEpisode; showId: string }) {
  const watchMatch = useMatch('/app/podcasts/:showId/watch/:episodeId');
  const isActive =
    !!ep.videoId &&
    watchMatch?.params.showId === showId &&
    watchMatch.params.episodeId === ep.videoId;

  const playLabel = `Episode ${ep.num.replace(/\D/g, '')}: ${ep.title}`;
  const className = [
    'group flex w-full gap-3 rounded-card px-4 py-4 text-left shadow-[0_4px_22px_-14px_rgba(0,0,0,0.1)] transition-[background-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-muted/95 hover:shadow-[0_8px_28px_-16px_rgba(0,0,0,0.12)] focus-visible:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 active:scale-[0.995] dark:focus-visible:bg-zinc-800 dark:shadow-[0_4px_26px_-14px_rgba(0,0,0,0.4)] sm:gap-4 sm:px-6 sm:py-5',
    isActive ? 'bg-accent-50/80 ring-1 ring-accent-200/80 dark:bg-accent-950/30 dark:ring-accent-800/60' : '',
  ].join(' ');

  const inner = (
    <>
      <div className="flex min-h-[44px] min-w-[3.25rem] shrink-0 flex-col items-center justify-center rounded-card bg-muted px-2.5 py-2 text-center shadow-[0_4px_18px_-12px_rgba(0,0,0,0.08)] sm:min-w-[3.5rem] sm:px-3">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Ep</span>
        <span className="text-lg font-extrabold leading-none text-foreground tabular-nums">
          {ep.num.replace(/\D/g, '')}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-balance font-semibold leading-snug text-foreground sm:text-base">{ep.title}</p>
        <p className="mt-1 line-clamp-1 text-xs font-normal text-muted-foreground sm:text-sm">{ep.guests}</p>
        {ep.description ? (
          <p className="mt-1.5 line-clamp-2 font-sans text-pretty text-sm font-normal leading-relaxed text-muted-foreground">
            {ep.description}
          </p>
        ) : null}
        <p className="mt-1.5 text-xs text-muted-foreground tabular-nums sm:hidden">
          {ep.date}
          {ep.duration ? (
            <>
              {' '}
              <span className="text-muted-foreground">|</span> {ep.duration}
            </>
          ) : null}
          {ep.viewCount ? (
            <>
              {' '}
              <span className="text-muted-foreground">|</span> {formatViewCount(ep.viewCount)}
            </>
          ) : null}
        </p>
      </div>
      <div className="hidden shrink-0 flex-col items-end justify-center gap-1 text-right sm:flex">
        <time className="whitespace-nowrap text-xs text-muted-foreground tabular-nums" dateTime={ep.dateIso}>
          {ep.date}
        </time>
        <span className="text-xs font-semibold text-accent-700 tabular-nums dark:text-accent-300">
          {ep.duration}
          {ep.viewCount ? ` · ${formatViewCount(ep.viewCount)}` : ''}
        </span>
      </div>
      <ChevronRight
        className="h-5 w-5 shrink-0 self-center text-muted-foreground transition-[color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] group-hover:translate-x-0.5 group-hover:text-foreground"
        aria-hidden
      />
    </>
  );

  if (ep.videoId) {
    return (
      <li>
        <Link
          to={podcastEpisodeWatchPath(showId, ep.videoId)}
          className={className}
          aria-label={playLabel}
        >
          {inner}
        </Link>
      </li>
    );
  }

  return (
    <li>
      <button type="button" className={className} aria-label={playLabel}>
        {inner}
      </button>
    </li>
  );
}

export function SeriesSection({ show }: { show: PodcastShow }) {
  const [sort, setSort] = useState<PodcastEpisodeSort>('latest');

  const episodesQuery = usePodcastEpisodes(
    show.remoteEpisodes ? show.id : undefined,
    sort,
  );
  const episodes = show.remoteEpisodes
    ? episodesQuery.data?.episodes ?? []
    : show.episodes;
  const listenPlatforms = show.platformLinks ?? CHM_PODCAST_PLATFORM_LINKS;
  const seriesHubHref =
    listenPlatforms.find((platform) => platform.label === show.title)?.href ?? null;

  const latest = useMemo(() => latestEpisode(show, episodes), [show, episodes]);

  return (
    <section
      id={show.id}
      className="overflow-hidden rounded-card bg-card text-foreground shadow-[0_10px_44px_-28px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_48px_-30px_rgba(0,0,0,0.55)]"
      aria-label={`${show.title} series`}
    >
      <div className="min-w-0">
        <div className="relative overflow-hidden bg-card px-5 py-5 sm:px-7 sm:py-6 md:px-10 md:py-7">
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <img
              src={show.logo ?? show.image}
              alt=""
              className={[
                'h-24 w-24 shrink-0 rounded-card shadow-md ring-1 ring-zinc-200/90 sm:h-28 sm:w-28 dark:ring-zinc-700',
                show.logo
                  ? 'object-contain bg-card p-2 dark:p-2.5'
                  : 'bg-card object-cover',
              ].join(' ')}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-steel-700 dark:text-steel-300">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-steel-600 dark:text-steel-400" aria-hidden />
                <span>{show.category}</span>
              </div>
              <h2 className="mt-1 text-balance text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl md:text-4xl">
                {show.title}
              </h2>
              <p className="mt-1.5 max-w-2xl font-sans text-pretty text-sm font-normal leading-relaxed text-muted-foreground">
                {show.tagline}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
                {(() => {
                  const play =
                    show.playLatest ??
                    (latest?.videoId
                      ? ({
                          kind: 'app' as const,
                          to: podcastEpisodeWatchPath(show.id, latest.videoId),
                        })
                      : latest?.youtubeUrl
                        ? ({ kind: 'external' as const, href: latest.youtubeUrl })
                        : ({
                            kind: 'external' as const,
                            href: seriesHubHref ?? 'https://communityhealth.media',
                          }));
                  const playClass =
                    'inline-flex min-h-[40px] min-w-[44px] items-center justify-center gap-2 rounded-[6px] bg-accent px-4 py-2 text-sm font-bold text-white shadow-[0_8px_28px_-12px_rgba(234,88,12,0.45)] transition-[background-color,transform] duration-200 hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 active:scale-[0.96]';
                  if (play.kind === 'app') {
                    return (
                      <Link to={play.to} className={playClass}>
                        <Play className="h-4 w-4 fill-current" aria-hidden />
                        Play latest
                      </Link>
                    );
                  }
                  return (
                    <a href={play.href} target="_blank" rel="noopener noreferrer" className={playClass}>
                      <Play className="h-4 w-4 fill-current" aria-hidden />
                      Play latest
                    </a>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-card px-4 py-3 shadow-[inset_0_10px_28px_-22px_rgba(15,23,42,0.12)] dark:shadow-[inset_0_10px_28px_-22px_rgba(0,0,0,0.45)] sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Listen on
            </span>
            {listenPlatforms.map((platform) => (
              <a
                key={platform.label}
                href={platform.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[32px] items-center rounded-[6px] bg-muted px-3 text-xs font-medium text-muted-foreground transition-[background-color,color,transform] duration-200 active:scale-[0.96] dark:hover:bg-zinc-700"
              >
                {platform.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-muted/95 px-4 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75),inset_0_12px_32px_-24px_rgba(15,23,42,0.08)] /85 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04),inset_0_12px_32px_-24px_rgba(0,0,0,0.35)] sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Episodes</h3>
          {show.remoteEpisodes ? (
            <SegmentedControl
              label="Sort episodes"
              segments={SORT_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
              value={sort}
              onChange={setSort}
            />
          ) : (
            <span className="text-xs text-muted-foreground">{episodes.length} episodes</span>
          )}
        </div>
      </div>

      {episodesQuery.isLoading ? (
        <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading episodes…
        </div>
      ) : episodesQuery.isError ? (
        <p className="px-6 py-8 text-sm text-destructive">
          Could not load episodes. Try again later.
        </p>
      ) : episodes.length === 0 ? (
        <p className="px-6 py-8 text-sm text-muted-foreground">No episodes available yet.</p>
      ) : (
        <ul className="flex flex-col gap-2 px-2 py-3 sm:gap-2.5 sm:px-3 sm:py-4">
          {episodes.map((ep) => (
            <EpisodeRow
              key={show.id + (ep.videoId ?? ep.num) + ep.title}
              ep={ep}
              showId={show.id}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Latest episode for cards: uses YouTube when configured. */
export function useShowLatestEpisode(show: PodcastShow): PodcastEpisode | null {
  const { data } = useQuery({
    queryKey: ['podcast', 'episodes', show.id, 'latest-card'],
    queryFn: async () => {
      if (!show.remoteEpisodes) return null;
      const result = await podcastsApi.getEpisodes(show.id, 'latest');
      if (!result.episodes.length) return null;
      return mapPodcastEpisodesToUi(result.episodes, result.show.title, {
        minDurationSeconds: show.minEpisodeDurationSeconds,
      })[0] ?? null;
    },
    enabled: !!show.remoteEpisodes,
    staleTime: 15 * 60 * 1000,
  });
  if (show.remoteEpisodes) return data ?? null;
  return latestEpisode(show);
}
