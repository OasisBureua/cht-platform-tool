import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ExternalLink } from 'lucide-react';
import {
  CHM_PODCAST_PLATFORM_LINKS,
  PODCAST_SHOWS,
} from '../../data/podcastsCatalog';
import { Button } from '../../components/ui';

/**
 * Public series page — `/podcast-network/:showId` (e.g. breast-friends).
 * Listen destinations stay on platform hubs; episode playback stays in `/app`.
 */
export default function PodcastNetworkShow() {
  const { showId } = useParams<{ showId: string }>();
  const show = PODCAST_SHOWS.find((s) => s.id === showId);

  if (!show) {
    return <Navigate to="/podcast-network" replace />;
  }

  const links = show.platformLinks ?? CHM_PODCAST_PLATFORM_LINKS;

  return (
    <div className="min-h-screen bg-ground">
      <div className="rail pb-16 pt-10 md:pt-14">
        <Link
          to="/podcast-network"
          className="press inline-flex items-center gap-1 text-body-s text-muted2 hover:text-text"
        >
          <ChevronLeft className="size-4" strokeWidth={1.75} />
          Podcast network
        </Link>

        <div className="mt-8 grid gap-10 lg:grid-cols-[16rem_1fr] lg:gap-14">
          <img
            src={show.logo ?? show.image}
            alt=""
            className={[
              'mx-auto size-48 rounded-[6px] shadow-card sm:size-56 lg:mx-0 lg:size-full lg:max-w-[16rem]',
              show.logo ? 'object-contain bg-surface p-4' : 'object-cover aspect-square',
            ].join(' ')}
            loading="lazy"
            referrerPolicy="no-referrer"
          />

          <div className="min-w-0">
            <p className="eyebrow text-muted2">{show.category}</p>
            <h1 className="display mt-4 max-w-[20ch] text-[2.25rem] leading-[1.06] tracking-[-0.03em] text-text md:text-display-l">
              {show.title}
            </h1>
            <p className="prose-lede mt-5 max-w-[52ch] text-body-l text-muted2">{show.tagline}</p>
            <p className="meta mt-4 text-faint">{show.updateNote}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              {links[0] ? (
                <a
                  href={links[0].href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press inline-flex h-11 items-center gap-2 rounded-[6px] bg-signature px-5 text-body-s text-ground hover:brightness-[0.94] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Listen on {links[0].label}
                  <ExternalLink className="size-4" strokeWidth={1.75} aria-hidden />
                </a>
              ) : null}
              <Button to="/join" variant="outline">
                Join CHM
                <ArrowRight className="size-4" strokeWidth={1.75} />
              </Button>
            </div>

            {links.length > 1 ? (
              <div className="mt-10">
                <p className="eyebrow text-faint">Also available on</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {links.slice(1).map((p) => (
                    <li key={p.href}>
                      <a
                        href={p.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="press inline-flex h-10 items-center gap-1.5 rounded-[6px] px-4 text-body-s text-dim shadow-[var(--shadow-card)] hover:text-text hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        {p.label}
                        <ExternalLink className="size-3.5" strokeWidth={1.75} aria-hidden />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
