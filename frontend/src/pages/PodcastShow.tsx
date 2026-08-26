import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PODCAST_SHOWS } from '../data/podcastsCatalog';
import { SeriesSection } from '../components/podcasts/PodcastSeriesSection';
import { podcastEpisodeWatchPath } from '../utils/podcastRoutes';

export default function PodcastShow() {
  const { showId } = useParams<{ showId: string }>();
  const [searchParams] = useSearchParams();
  const legacyVideoId = searchParams.get('v');
  const show = PODCAST_SHOWS.find((s) => s.id === showId);

  if (!showId || !show) {
    return <Navigate to="/app/podcasts" replace />;
  }

  if (legacyVideoId) {
    return <Navigate to={podcastEpisodeWatchPath(showId, legacyVideoId)} replace />;
  }

  return (
    <div className="flex flex-col gap-6 pb-24 md:gap-8 md:pb-16">
      <div>
        <Link
          to="/app/podcasts"
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-steel-700 transition-colors hover:text-steel-600 dark:text-steel-400 dark:hover:text-steel-300"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          Back to podcasts
        </Link>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {show.updateNote}
        </p>
      </div>

      <SeriesSection show={show} />
    </div>
  );
}
