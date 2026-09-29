import { Link } from 'react-router-dom';
import { ArrowRight, Play } from 'lucide-react';
import { PODCAST_SHOWS, UPCOMING_PLACEHOLDER, type PodcastShow } from '../data/podcastsCatalog';
import { useShowLatestEpisode } from '../components/podcasts/PodcastSeriesSection';
import { waveBars } from '../components/home/waveBars';
import { podcastEpisodeWatchPath } from '../utils/podcastRoutes';

/**
 * The podcast network hub: four channels, then the newest episode from
 * each. Channel cards are the homepage's podcast card, permanently deep
 * teal with the show's seeded waveform, so their text stays fixed white
 * in both appearances.
 */
const DEEP = 'hsl(196 66% 23%)';

function ChannelCard({ show }: { show: PodcastShow }) {
  const lang = show.id === 'tetalks' ? 'es' : undefined;
  return (
    <Link
      to={`/app/podcast-network/${encodeURIComponent(show.id)}`}
      className="group relative flex min-h-[15rem] flex-col overflow-hidden rounded-card p-5 text-white shadow-card transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:active:scale-[0.99] sm:p-6"
      style={{ background: DEEP }}
    >
      <div className="flex items-start gap-4">
        <img
          src={show.image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="size-20 shrink-0 rounded-[10px] object-cover ring-1 ring-white/15 sm:size-24"
        />
        <div className="min-w-0">
          <p className="eyebrow text-white/65" lang={lang}>
            {show.category}
          </p>
          <h2 className="display mt-2 text-display-s leading-tight text-white">{show.title}</h2>
          <p className="prose-lede mt-2 line-clamp-2 text-body-s text-white/80" lang={lang}>
            {show.tagline}
          </p>
        </div>
      </div>
      <span aria-hidden className="mt-auto flex h-12 items-end gap-[3px] pt-5">
        {waveBars(show.id).map((b, i) => (
          <span key={i} className="flex-1 rounded-[2px] bg-white/35" style={{ height: `${b.height}%` }} />
        ))}
      </span>
      <span className="mt-4 flex items-center gap-2 text-body-s">
        <span className="grid size-8 place-items-center rounded-full bg-white text-[hsl(196_66%_23%)]">
          <Play className="ms-px size-3.5 fill-current" aria-hidden />
        </span>
        Open channel
        <span className="meta ms-auto text-white/65" lang={lang}>
          {show.updateNote}
        </span>
      </span>
    </Link>
  );
}

function LatestEpisodeCard({ show }: { show: PodcastShow }) {
  const ep = useShowLatestEpisode(show);
  if (!ep) return null;
  const to = ep.videoId
    ? podcastEpisodeWatchPath(show.id, ep.videoId)
    : `/app/podcast-network/${encodeURIComponent(show.id)}`;
  const title = ep.title.includes('|') ? ep.title.split('|').slice(1).join('|').trim() : ep.title;
  return (
    <li>
      <Link
        to={to}
        className="card group flex h-full flex-col p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="relative block aspect-video overflow-hidden rounded-[8px] bg-surface-2">
          {ep.thumbnailUrl ? (
            <img
              src={ep.thumbnailUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="size-full object-cover transition-[scale] duration-300 group-hover:scale-[1.03]"
            />
          ) : null}
          <span className="absolute inset-0 m-auto grid size-10 place-items-center rounded-full bg-anchor text-ground shadow-card">
            <Play className="ms-0.5 size-4 fill-current" aria-hidden />
          </span>
        </span>
        <span className="meta mt-3 block text-anchor">{show.title}</span>
        <span className="mt-1 line-clamp-2 text-body-s font-medium text-text">{title}</span>
        <span className="meta mt-auto block pt-2 tabular-nums text-faint">
          {[ep.date, ep.duration].filter(Boolean).join(' · ')}
        </span>
      </Link>
    </li>
  );
}

export default function Podcasts() {
  return (
    <div className="space-y-10 pb-24 md:pb-16">
      <header className="space-y-2">
        <p className="eyebrow text-anchor">CHM podcast network</p>
        <h1 className="display text-display-s text-text md:text-display-m">Podcasts</h1>
        <p className="prose-lede max-w-2xl text-body-s text-muted2">
          Four shows, each with its own voice. Open a channel for every episode, or copy its link to
          share it with anyone.
        </p>
      </header>

      <section aria-label="Channels" className="grid gap-4 md:grid-cols-2">
        {PODCAST_SHOWS.map((show) => (
          <ChannelCard key={show.id} show={show} />
        ))}
      </section>

      <section aria-labelledby="podcasts-latest" className="space-y-4">
        <h2 id="podcasts-latest" className="display text-display-s text-text">
          Latest episodes
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PODCAST_SHOWS.map((show) => (
            <LatestEpisodeCard key={show.id} show={show} />
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="podcasts-upcoming"
        className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6"
      >
        <img
          src={UPCOMING_PLACEHOLDER.image}
          alt=""
          loading="lazy"
          className="aspect-video w-full rounded-[10px] object-cover sm:w-48"
        />
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-faint">Coming soon</p>
          <h2 id="podcasts-upcoming" className="display mt-1 text-body-l text-text">
            {UPCOMING_PLACEHOLDER.title}
          </h2>
          <p className="prose-lede mt-1 max-w-xl text-body-s text-muted2">{UPCOMING_PLACEHOLDER.tagline}</p>
        </div>
        <Link
          to="/app/catalog"
          className="press inline-flex h-10 shrink-0 items-center gap-1.5 self-start rounded-[8px] bg-surface px-4 text-body-s font-medium text-text ring-1 ring-hairline-strong hover:bg-surface-2 sm:self-center"
        >
          Browse conversations
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </section>
    </div>
  );
}
