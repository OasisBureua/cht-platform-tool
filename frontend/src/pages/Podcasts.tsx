import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { ArrowRight, Play } from 'lucide-react';
import { PODCAST_SHOWS, UPCOMING_PLACEHOLDER, type PodcastEpisode, type PodcastShow } from '../data/podcastsCatalog';
import { podcastEpisodesQuery } from '../hooks/usePodcastYouTubeEpisodes';
import { latestEpisode } from '../components/podcasts/PodcastSeriesSection';
import { FeatureCarousel, type FeatureSlide } from '../components/home/FeatureCarousel';
import { waveBars } from '../components/home/waveBars';
import { episodeDisplayTitle, podcastEpisodeWatchPath } from '../utils/podcastRoutes';
import { KOL_NETWORK_APP_BASE } from '../utils/kol-network-paths';
import { Button } from '../components/ui';
import { PodcastHero } from '../components/podcasts/PodcastHero';

/**
 * The podcast network hub: the public site's hero (the four covers
 * fanned), then Featured episodes carrying the newest from each show,
 * the four channels, and the episodes that came before. Channel cards are the homepage's podcast
 * card, permanently deep teal, so their text stays fixed white in both
 * appearances.
 */
const DEEP = 'hsl(196 66% 23%)';
const channelHref = (id: string) => `/app/podcast-network/${encodeURIComponent(id)}`;

type ShowEpisode = { show: PodcastShow; ep: PodcastEpisode };

function ChannelCard({ show }: { show: PodcastShow }) {
  const lang = show.id === 'tetalks' ? 'es' : undefined;
  return (
    <Link
      to={channelHref(show.id)}
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

function EpisodeCard({ show, ep }: ShowEpisode) {
  const to = ep.videoId ? podcastEpisodeWatchPath(show.id, ep.videoId) : channelHref(show.id);
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
        <span className="mt-1 line-clamp-2 text-body-s font-medium text-text">{episodeDisplayTitle(ep.title)}</span>
        <span className="meta mt-auto block pt-2 tabular-nums text-faint">
          {[ep.date, ep.duration].filter(Boolean).join(' · ')}
        </span>
      </Link>
    </li>
  );
}

export default function Podcasts() {
  const results = useQueries({
    queries: PODCAST_SHOWS.map((s) => podcastEpisodesQuery(s.remoteEpisodes ? s.id : undefined, 'latest')),
  });
  const lists = PODCAST_SHOWS.map((show, i) => ({
    show,
    episodes: show.remoteEpisodes ? results[i].data?.episodes ?? [] : show.episodes,
  }));
  // A few dozen episodes at most, so this is worked out on each render.
  const newest: ShowEpisode[] = [];
  const rest: ShowEpisode[] = [];
  for (const { show, episodes } of lists) {
    const top = latestEpisode(show, episodes);
    if (top) newest.push({ show, ep: top });
    for (const ep of episodes) if (ep !== top) rest.push({ show, ep });
  }
  const byDate = (a: ShowEpisode, b: ShowEpisode) => new Date(b.ep.dateIso).getTime() - new Date(a.ep.dateIso).getTime();
  const featured = newest.sort(byDate);
  const recent = rest.sort(byDate).slice(0, 8);

  const latest = featured[0];
  const latestHref = latest?.ep.videoId ? podcastEpisodeWatchPath(latest.show.id, latest.ep.videoId) : channelHref((latest?.show ?? PODCAST_SHOWS[0]).id);

  const slides: FeatureSlide[] = featured.map(({ show, ep }) => ({
    id: `${show.id}-${ep.videoId ?? ep.num}`,
    eyebrow: `New episode · ${show.title}`,
    title: episodeDisplayTitle(ep.title),
    description: ep.guests ? `With ${ep.guests}` : show.tagline,
    imageUrl: ep.thumbnailUrl || show.image,
    imageFit: ep.thumbnailUrl ? 'cover' : 'contain',
    primaryHref: ep.videoId ? podcastEpisodeWatchPath(show.id, ep.videoId) : channelHref(show.id),
    primaryCta: 'Play episode',
    secondaryHref: channelHref(show.id),
    secondaryCta: 'Open channel',
  }));

  return (
    <div className="space-y-10 pb-24 md:pb-16">
      <PodcastHero
        actions={
          <>
            <Button to={latestHref} className="bg-signature text-ground hover:bg-signature hover:brightness-[0.94]">
              Play the latest episode
              <ArrowRight className="size-4" strokeWidth={1.75} />
            </Button>
            <Button to={KOL_NETWORK_APP_BASE} variant="outline">
              Browse the KOL directory
            </Button>
          </>
        }
      />

      <section aria-labelledby="podcasts-featured" className="space-y-4">
        <h2 id="podcasts-featured" className="display text-display-s text-text">
          Featured episodes
        </h2>
        {slides.length ? (
          <FeatureCarousel slides={slides} label="Featured episodes" />
        ) : (
          <div aria-hidden className="card grid gap-5 p-4 md:grid-cols-2">
            <div className="aspect-video animate-pulse rounded-[10px] bg-surface-2" />
            <div className="space-y-3 self-center">
              <div className="h-3 w-40 animate-pulse rounded bg-surface-2" />
              <div className="h-7 w-4/5 animate-pulse rounded bg-surface-2" />
              <div className="h-4 w-3/5 animate-pulse rounded bg-surface-2" />
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="podcasts-channels" className="space-y-4">
        <h2 id="podcasts-channels" className="display text-display-s text-text">
          Channels
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {PODCAST_SHOWS.map((show) => (
            <ChannelCard key={show.id} show={show} />
          ))}
        </div>
      </section>

      {recent.length ? (
        <section aria-labelledby="podcasts-recent" className="space-y-4">
          <h2 id="podcasts-recent" className="display text-display-s text-text">
            More recent episodes
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {recent.map((item) => (
              <EpisodeCard key={`${item.show.id}-${item.ep.videoId ?? item.ep.num}`} {...item} />
            ))}
          </ul>
        </section>
      ) : null}

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
