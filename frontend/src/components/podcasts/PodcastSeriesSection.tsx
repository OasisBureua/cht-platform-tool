import { useMemo, useState } from 'react';
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
    'group flex w-full gap-3 rounded-2xl px-4 py-4 text-left shadow-[0_4px_22px_-14px_rgba(0,0,0,0.1)] transition-[background-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-zinc-50/95 hover:shadow-[0_8px_28px_-16px_rgba(0,0,0,0.12)] focus-visible:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 active:scale-[0.995] dark:hover:bg-zinc-800/85 dark:focus-visible:bg-zinc-800 dark:shadow-[0_4px_26px_-14px_rgba(0,0,0,0.4)] sm:gap-4 sm:px-6 sm:py-5',
    isActive ? 'bg-accent-50/80 ring-1 ring-accent-200/80 dark:bg-accent-950/30 dark:ring-accent-800/60' : '',
  ].join(' ');

  const inner = (
    <>
      <div className="flex min-h-[44px] min-w-[3.25rem] shrink-0 flex-col items-center justify-center rounded-xl bg-zinc-50 px-2.5 py-2 text-center shadow-[0_4px_18px_-12px_rgba(0,0,0,0.08)] dark:bg-zinc-800 sm:min-w-[3.5rem] sm:px-3">
        <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">Ep</span>
        <span className="text-lg font-extrabold leading-none text-zinc-900 tabular-nums dark:text-zinc-100">
          {ep.num.replace(/\D/g, '')}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-balance font-semibold leading-snug text-zinc-900 dark:text-zinc-100 sm:text-base">{ep.title}</p>
        <p className="mt-1 line-clamp-1 text-xs font-normal text-zinc-500 dark:text-zinc-500 sm:text-sm">{ep.guests}</p>
        {ep.description ? (
          <p className="mt-1.5 line-clamp-2 font-sans text-pretty text-sm font-normal leading-relaxed text-zinc-600 dark:text-zinc-400">
            {ep.description}
          </p>
        ) : null}
        <p className="mt-1.5 text-xs text-zinc-600 tabular-nums dark:text-zinc-500 sm:hidden">
          {ep.date}
          {ep.duration ? (
            <>
              {' '}
              <span className="text-zinc-400 dark:text-zinc-600">|</span> {ep.duration}
            </>
          ) : null}
          {ep.viewCount ? (
            <>
              {' '}
              <span className="text-zinc-400 dark:text-zinc-600">|</span> {formatViewCount(ep.viewCount)}
            </>
          ) : null}
        </p>
      </div>
      <div className="hidden shrink-0 flex-col items-end justify-center gap-1 text-right sm:flex">
        <time className="whitespace-nowrap text-xs text-zinc-600 tabular-nums dark:text-zinc-500" dateTime={ep.dateIso}>
          {ep.date}
        </time>
        <span className="text-xs font-semibold text-accent-700 tabular-nums dark:text-accent-300">
          {ep.duration}
          {ep.viewCount ? ` · ${formatViewCount(ep.viewCount)}` : ''}
        </span>
      </div>
      <ChevronRight
        className="h-5 w-5 shrink-0 self-center text-zinc-400 transition-[color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] group-hover:translate-x-0.5 group-hover:text-zinc-600 dark:text-zinc-600 dark:group-hover:text-zinc-300"
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
      className="overflow-hidden rounded-2xl bg-white text-zinc-900 shadow-[0_10px_44px_-28px_rgba(0,0,0,0.12)] dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-[0_12px_48px_-30px_rgba(0,0,0,0.55)]"
      aria-label={`${show.title} series`}
    >
      <div className="min-w-0">
        <div className="relative overflow-hidden bg-white px-5 py-5 dark:bg-zinc-950 sm:px-7 sm:py-6 md:px-10 md:py-7">
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <img
              src={show.logo ?? show.image}
              alt=""
              className={[
                'h-24 w-24 shrink-0 rounded-xl shadow-md ring-1 ring-zinc-200/90 sm:h-28 sm:w-28 dark:ring-zinc-700',
                show.logo
                  ? 'object-contain bg-white p-2 dark:bg-white dark:p-2.5'
                  : 'bg-white object-cover dark:bg-white',
              ].join(' ')}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-700 dark:text-accent-300">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent-600 dark:text-accent-400" aria-hidden />
                <span>{show.category}</span>
              </div>
              <h2 className="mt-1 text-balance text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl md:text-4xl">
                {show.title}
              </h2>
              <p className="mt-1.5 max-w-2xl font-sans text-pretty text-sm font-normal leading-relaxed text-zinc-600 dark:text-zinc-400">
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
                    'inline-flex min-h-[40px] min-w-[44px] items-center justify-center gap-2 rounded-md bg-orange-600 px-4 py-2 text-sm font-bold text-white shadow-[0_8px_28px_-12px_rgba(234,88,12,0.45)] transition-[background-color,transform] duration-200 hover:bg-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 active:scale-[0.96]';
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
        <div className="bg-white px-4 py-3 shadow-[inset_0_10px_28px_-22px_rgba(15,23,42,0.12)] dark:bg-zinc-900 dark:shadow-[inset_0_10px_28px_-22px_rgba(0,0,0,0.45)] sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-400">
              Listen on
            </span>
            {listenPlatforms.map((platform) => (
              <a
                key={platform.label}
                href={platform.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[32px] items-center rounded-full bg-zinc-50 px-3 text-xs font-medium text-zinc-700 transition-[background-color,color,transform] duration-200 hover:bg-zinc-100 active:scale-[0.96] dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                {platform.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-zinc-50/95 px-4 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75),inset_0_12px_32px_-24px_rgba(15,23,42,0.08)] dark:bg-zinc-950/85 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04),inset_0_12px_32px_-24px_rgba(0,0,0,0.35)] sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-400">Episodes</h3>
          {show.remoteEpisodes ? (
            <div
              className="inline-flex rounded-full bg-white p-0.5 shadow-sm dark:bg-zinc-900"
              role="tablist"
              aria-label="Sort episodes"
            >
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="tab"
                  aria-selected={sort === opt.value}
                  onClick={() => setSort(opt.value)}
                  className={[
                    'min-h-[32px] rounded-full px-3 text-xs font-semibold transition-colors',
                    sort === opt.value
                      ? 'bg-accent-600 text-white'
                      : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-xs text-zinc-500 dark:text-zinc-500">{episodes.length} episodes</span>
          )}
        </div>
      </div>

      {episodesQuery.isLoading ? (
        <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading episodes…
        </div>
      ) : episodesQuery.isError ? (
        <p className="px-6 py-8 text-sm text-red-600 dark:text-red-400">
          Could not load episodes. Try again later.
        </p>
      ) : episodes.length === 0 ? (
        <p className="px-6 py-8 text-sm text-zinc-500 dark:text-zinc-400">No episodes available yet.</p>
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

/** Latest episode for cards — uses YouTube when configured. */
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
