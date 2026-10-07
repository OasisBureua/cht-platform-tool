import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui';
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
      <Button to="/app/podcast-network" variant="outline" size="sm" className="w-fit">
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        Podcasts
      </Button>
      <PodcastChannel show={show} mode="app" />
    </div>
  );
}
