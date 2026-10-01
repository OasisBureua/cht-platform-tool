import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import { PODCAST_SHOWS } from '../../data/podcastsCatalog';
import { PodcastChannel } from '../../components/podcasts/PodcastChannel';
import { Button } from '../../components/ui';

/**
 * The standalone channel page, `/podcast-network/:showId`: the link people
 * share. Complete without an account; episodes play inline here.
 */
export default function PodcastNetworkShow() {
  const { showId } = useParams<{ showId: string }>();
  const show = PODCAST_SHOWS.find((s) => s.id === showId);

  if (!show) {
    return <Navigate to="/podcast-network" replace />;
  }

  return (
    <div className="min-h-screen bg-ground">
      <div className="rail space-y-5 pb-16 pt-8 md:pt-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button to="/podcast-network" variant="outline" size="sm">
            <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
            Podcast network
          </Button>
          <Link
            to="/join"
            className="press inline-flex items-center gap-1.5 text-body-s font-medium text-anchor hover:text-cta"
          >
            Join CHM for the full library
            <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
          </Link>
        </div>
        <PodcastChannel show={show} mode="public" />
      </div>
    </div>
  );
}
