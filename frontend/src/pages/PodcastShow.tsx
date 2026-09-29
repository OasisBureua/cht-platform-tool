import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { PODCAST_SHOWS } from '../data/podcastsCatalog';
import { PodcastChannel } from '../components/podcasts/PodcastChannel';
import { podcastEpisodeWatchPath } from '../utils/podcastRoutes';

export default function PodcastShow() {
  const { showId } = useParams<{ showId: string }>();
  const [searchParams] = useSearchParams();
  const legacyVideoId = searchParams.get('v');
  const show = PODCAST_SHOWS.find((s) => s.id === showId);

  if (!showId || !show) {
    return <Navigate to="/app/podcast-network" replace />;
  }

  if (legacyVideoId) {
    return <Navigate to={podcastEpisodeWatchPath(showId, legacyVideoId)} replace />;
  }

  return (
    <div className="flex flex-col gap-4 pb-24 md:pb-16">
      <Link
        to="/app/podcast-network"
        className="inline-flex min-h-[44px] w-fit items-center gap-1 text-sm font-medium text-muted2 transition-colors hover:text-text"
      >
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        Podcast network
      </Link>
      <PodcastChannel show={show} mode="app" />
    </div>
  );
}
