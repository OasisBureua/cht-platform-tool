import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { PODCAST_SHOWS } from '../data/podcastsCatalog';
import { usePodcastEpisodes } from '../hooks/usePodcastYouTubeEpisodes';
import { YouTubePlayer } from '../components/YouTubePlayer';
import { formatViewCount } from '../utils/youtubeDuration';
import { podcastEpisodeWatchPath, podcastShowPath } from '../utils/podcastRoutes';

export default function PodcastEpisodeWatch() {
  const { showId, episodeId } = useParams<{ showId: string; episodeId: string }>();
  const show = PODCAST_SHOWS.find((s) => s.id === showId);

  const { data, isLoading, isError } = usePodcastEpisodes(
    show?.remoteEpisodes ? show.id : undefined,
    'latest',
  );

  if (!showId || !episodeId || !show) {
    return <Navigate to="/app/podcasts" replace />;
  }

  const episodes = show.remoteEpisodes ? data?.episodes ?? [] : show.episodes;
  const episode = episodes.find((ep) => ep.videoId === episodeId) ?? null;
  const episodeIndex = episodes.findIndex((ep) => ep.videoId === episodeId);
  const prevEp = episodeIndex > 0 ? episodes[episodeIndex - 1] : null;
  const nextEp =
    episodeIndex >= 0 && episodeIndex < episodes.length - 1
      ? episodes[episodeIndex + 1]
      : null;

  if (isLoading && show.remoteEpisodes) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        Loading episode…
      </div>
    );
  }

  if (isError || !episode?.youtubeUrl) {
    return (
      <div className="flex flex-col gap-4 pb-16">
        <Link
          to={podcastShowPath(showId)}
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-accent-700 dark:text-accent-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to {show.title}
        </Link>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Episode not found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-24 md:gap-8 md:pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={podcastShowPath(showId)}
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-accent-700 transition-colors hover:text-accent-600 dark:text-accent-400 dark:hover:text-accent-300"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          {show.title}
        </Link>
        <div className="flex flex-wrap gap-2 text-sm">
          {prevEp?.videoId ? (
            <Link
              to={podcastEpisodeWatchPath(showId, prevEp.videoId)}
              className="rounded-full bg-zinc-100 px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              ← Previous
            </Link>
          ) : null}
          {nextEp?.videoId ? (
            <Link
              to={podcastEpisodeWatchPath(showId, nextEp.videoId)}
              className="rounded-full bg-zinc-100 px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Next →
            </Link>
          ) : null}
        </div>
      </div>

      <article className="overflow-hidden rounded-2xl bg-zinc-950 shadow-xl ring-1 ring-zinc-800">
        <YouTubePlayer
          key={episode.videoId}
          youtubeUrl={episode.youtubeUrl}
          title={episode.title}
          autoplay
          muted={false}
          className="aspect-video w-full"
        />
        <div className="space-y-2 px-5 py-5 sm:px-7 sm:py-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent-400">
            {episode.num} · {show.title}
          </p>
          <h1 className="text-balance text-xl font-bold text-white sm:text-2xl">{episode.title}</h1>
          <p className="text-sm text-zinc-400">
            {episode.date}
            {episode.duration ? ` · ${episode.duration}` : ''}
            {episode.viewCount ? ` · ${formatViewCount(episode.viewCount)}` : ''}
          </p>
          {episode.description ? (
            <p className="text-pretty text-sm leading-relaxed text-zinc-300">{episode.description}</p>
          ) : null}
        </div>
      </article>
    </div>
  );
}
