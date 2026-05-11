import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PODCAST_SHOWS } from '../data/podcastsCatalog';
import { SeriesSection } from '../components/podcasts/PodcastSeriesSection';

export default function PodcastShow() {
  const { showId } = useParams<{ showId: string }>();
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const show = PODCAST_SHOWS.find((s) => s.id === showId);

  if (!showId || !show) {
    return <Navigate to="/app/podcasts" replace />;
  }

  return (
    <div className="flex flex-col gap-6 pb-24 md:gap-8 md:pb-16">
      <div>
        <Link
          to="/app/podcasts"
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          Back to podcasts
        </Link>
      </div>

      <SeriesSection
        show={show}
        sortNewestFirst={sortNewestFirst}
        onToggleSort={() => setSortNewestFirst((v) => !v)}
      />
    </div>
  );
}
