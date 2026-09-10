import type { ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import {
  CHM_PODCAST_PLATFORM_LINKS,
  PODCAST_SHOWS,
  type PodcastEpisode,
} from '../data/podcastsCatalog';
import { usePodcastEpisodes } from '../hooks/usePodcastYouTubeEpisodes';
import { YouTubePlayer } from '../components/YouTubePlayer';
import { podcastEpisodeWatchPath, podcastShowPath } from '../utils/podcastRoutes';
import { ChmMark } from '../components/brand/ChmMark';
import { Button, Chip, chipKind, Thumb } from '../components/ui';
import { useQuery } from '@tanstack/react-query';
import { catalogApi, type MediaHubClip } from '../api/catalog';
import { getMediaHubThumbnail, getShortClipId, shouldSurfaceCatalogClip } from '../utils/clipUrl';

function Eyebrow({
  children,
  tone = 'faint',
  className = '',
}: {
  children: ReactNode;
  tone?: 'faint' | 'cyan' | 'amber';
  className?: string;
}) {
  const tones = { faint: 'text-muted2', cyan: 'text-anchor', amber: 'text-amber' };
  return <p className={`eyebrow ${tones[tone]} ${className}`}>{children}</p>;
}

/**
 * Section chrome: the heading and the one "see all" affordance a section
 * is allowed. Sits above what it controls, never below it.
 */
function SectionHead({
  id,
  title,
  seeAll,
}: {
  id?: string;
  title: string;
  seeAll?: { noun: string; to: string };
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <h2 id={id} className="display min-w-0 text-display-m text-text">
        {title}
      </h2>
      {seeAll ? (
        <Link
          to={seeAll.to}
          className="press inline-flex h-10 shrink-0 items-center gap-2 rounded-[6px] bg-surface px-5 text-body-s text-dim shadow-card hover:bg-ground hover:text-text hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          See all {seeAll.noun}
          <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

/** Guest credits arrive as one string. Only split it when it carries names. */
function splitGuests(guests: string | undefined, showTitle: string): string[] {
  const raw = (guests ?? '').trim();
  // The channel mapper stamps the show title into `guests` when YouTube
  // gives it nothing better. Repeating the show name as a credit is worse
  // than showing no credits, so that case reads as empty.
  if (!raw || raw.toLowerCase() === showTitle.toLowerCase()) return [];
  return raw
    .split(/,|&|\bwith\b/i)
    .map((n) => n.trim())
    .filter(Boolean);
}

/** 2,181 s → "36 min 21 sec", the show page's own style. */
function clipDuration(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60), r = Math.round(seconds % 60);
  return m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m} min ${r} sec`;
}

function monogram(name: string): string {
  const parts = name.replace(/^(Dr\.?|Prof\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i, '').split(/\s+/);
  return `${parts[0]?.[0] ?? ''}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`.toUpperCase();
}

export default function PodcastEpisodeWatch() {
  const { showId, episodeId } = useParams<{ showId: string; episodeId: string }>();
  const show = PODCAST_SHOWS.find((s) => s.id === showId);

  const { data, isLoading, isError } = usePodcastEpisodes(
    show?.remoteEpisodes ? show.id : undefined,
    'latest',
  );

  // What CHM puts beside this episode: conversations with the same faculty
  // first, then the newest recordings the catalog itself surfaces. Not the
  // rest of the show, which lives in "More from" below.
  const episodeForRec = (show ? (show.remoteEpisodes ? data?.episodes ?? [] : show.episodes) : []).find(
    (e) => e.videoId === episodeId,
  );
  const guestNames = episodeForRec && show ? splitGuests(episodeForRec.guests, show.title) : [];
  const { data: recommended = [] } = useQuery({
    queryKey: ['podcast', 'recommended', showId, episodeId, guestNames.join('|')],
    enabled: !!episodeForRec,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const out: MediaHubClip[] = [];
      const seen = new Set<string>();
      const take = (items: MediaHubClip[]) => {
        for (const c of items) {
          if (out.length >= 5) return;
          if (seen.has(c.id) || !shouldSurfaceCatalogClip(c)) continue;
          seen.add(c.id);
          out.push(c);
        }
      };
      const safe = (p: Promise<{ items: MediaHubClip[] }>) =>
        p.catch(() => ({ items: [] as MediaHubClip[] }));
      const byGuest = await Promise.all(
        guestNames.slice(0, 2).map((g) => safe(catalogApi.getClips({ q: g, limit: 4, sort_by: 'recent' }))),
      );
      byGuest.forEach((r) => take(r.items));
      if (out.length < 5) {
        take((await safe(catalogApi.getClips({ sort_by: 'recorded_at', limit: 8, dedup_by: 'shoot' }))).items);
      }
      return out;
    },
  });

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

  const showPath = podcastShowPath(showId);
  const showArt = show.image;


  const crumbs = (
    <nav aria-label="Breadcrumb" className="meta flex flex-wrap items-center gap-2 text-faint">
      <Link
        to="/app/podcasts"
        className="press -my-1.5 inline-block rounded-[6px] py-1.5 hover:text-anchor"
      >
        Podcasts
      </Link>
      <span aria-hidden>/</span>
      <Link to={showPath} className="press -my-1.5 inline-block rounded-[6px] py-1.5 hover:text-anchor">
        {show.title}
      </Link>
    </nav>
  );

  if (isLoading && show.remoteEpisodes) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <Loader2 className="size-6 animate-spin text-muted2" aria-hidden />
        <p className="meta text-faint">Loading episode…</p>
      </div>
    );
  }

  if (isError || !episode?.youtubeUrl) {
    return (
      <div className="flex flex-col gap-8 pb-24 md:pb-16">
        {crumbs}
        <div className="card px-8 py-16 text-center">
          <p className="display text-display-s text-text">Episode not found</p>
          <p className="prose-lede mx-auto mt-3 max-w-[34rem] text-body-m text-muted2">
            We could not load this one. The rest of {show.title} is still here.
          </p>
          <div className="mt-7 flex justify-center">
            <Button to={showPath} variant="outline">
              <ArrowLeft className="size-4" aria-hidden />
              All {show.title} episodes
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // A queue is only useful if it is actually a queue. Start with what
  // follows this episode in the run, then wrap to the rest of the show,
  // and stop at eight. One lonely card was the old behaviour.
  const isPlayable = (ep: PodcastEpisode) => !!ep.videoId && !!ep.youtubeUrl && ep.videoId !== episodeId;
  // Slice the run first, then filter: filtering first would shift the
  // index and hand back the episodes before this one as "up next".
  const after = episodeIndex >= 0 ? episodes.slice(episodeIndex + 1).filter(isPlayable) : [];
  const rest = episodes.filter(isPlayable);
  const track = [...after, ...rest]
    .filter((ep, at, all) => all.findIndex((o) => o.videoId === ep.videoId) === at)
    .slice(0, 8);

  const more = track.slice(0, 3);

  const guests = splitGuests(episode.guests, show.title);
  const categories = show.category.split('·').map((c) => c.trim()).filter(Boolean);
  const listenOn = show.platformLinks ?? CHM_PODCAST_PLATFORM_LINKS;

  return (
    <div className="pb-24 md:pb-16">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        {crumbs}
        {/* The run is linear, so the two steps along it sit together on
            the crumb line rather than being buried under the player. */}
        {prevEp?.videoId || nextEp?.videoId ? (
          <div className="flex shrink-0 gap-2">
            {prevEp?.videoId ? (
              <Link
                to={podcastEpisodeWatchPath(showId, prevEp.videoId)}
                className="press inline-flex h-9 items-center gap-2 rounded-[6px] bg-surface px-4 text-body-s text-dim shadow-card hover:bg-ground hover:text-text hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <ArrowLeft className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                Newer
              </Link>
            ) : null}
            {nextEp?.videoId ? (
              <Link
                to={podcastEpisodeWatchPath(showId, nextEp.videoId)}
                className="press inline-flex h-9 items-center gap-2 rounded-[6px] bg-surface px-4 text-body-s text-dim shadow-card hover:bg-ground hover:text-text hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Older
                <ArrowRight className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <section className="grid gap-10 pt-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div>
          <div className="overflow-hidden rounded-[8px] bg-surface shadow-card">
            <div className="relative aspect-video w-full bg-inverse">
              <YouTubePlayer
                key={episode.videoId}
                youtubeUrl={episode.youtubeUrl}
                title={episode.title}
                autoplay
                muted={false}
                className="absolute inset-0 size-full"
              />
            </div>

            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              {/* What is playing is carried by the label, not only by the
                  frame: audio first, because that is what this is. */}
              <p className="text-[0.8125rem] text-muted2">
                Audio · {episode.num}
              </p>
              <p className="text-[0.8125rem] tabular-nums text-muted2">{episode.duration}</p>
            </div>

            {recommended.length > 0 ? (
              <>
                <div className="flex items-baseline justify-between px-4 pt-1 pb-2">
                  <h2 id="recommended-heading" className="eyebrow text-faint">
                    Recommended videos
                  </h2>
                  <Link to="/app/catalog" className="press text-[0.75rem] text-dim hover:text-text">
                    All conversations
                  </Link>
                </div>
                <ol aria-labelledby="recommended-heading" className="px-2 pb-2">
                  {recommended.map((c, i) => (
                    <li key={c.id}>
                      <Link
                        to={`/app/clip/${getShortClipId(c.id)}`}
                        className="press group flex items-center gap-3 rounded-[6px] p-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <span className="w-5 shrink-0 text-[0.75rem] tabular-nums text-faint">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="img-ring relative block h-12 w-[5.25rem] shrink-0 overflow-hidden rounded-[6px] bg-surface-2">
                          <img
                            src={getMediaHubThumbnail(c)}
                            alt=""
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="size-full object-cover"
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body-s font-medium text-text">{c.title}</span>
                          <span className="mt-0.5 block truncate text-[0.75rem] tabular-nums text-faint">
                            {[c.doctors?.length ? c.doctors.slice(0, 2).join(', ') : null, clipDuration(c.duration_seconds)]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </>
            ) : null}
          </div>
        </div>

        <aside className="space-y-4">
          {/* The show comes first on an audio page: you subscribe to a
              show, you only ever land on an episode. */}
          <div className="flex items-center gap-4">
            <Link to={showPath} className="press group block w-[4.5rem] shrink-0">
              <span className="img-ring relative block aspect-square overflow-hidden rounded-[6px] bg-surface-2">
                <img
                  src={episode.thumbnailUrl ?? showArt}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 size-full object-cover transition-[scale] duration-300 ease-[var(--ease-out-strong)] group-hover:scale-[1.04]"
                />
              </span>
            </Link>
            <div className="min-w-0">
              <Eyebrow>Podcast</Eyebrow>
              <Link
                to={showPath}
                className="press display mt-1 block truncate text-body-m text-text hover:text-anchor"
              >
                {show.title}
              </Link>
              <p className="mt-0.5 truncate text-[0.75rem] text-faint">{show.updateNote}</p>
            </div>
          </div>

          <div>
            <h1 className="display display-tight text-[1.75rem] leading-[1.12] text-text">
              {episode.title}
            </h1>
            {episode.description ? (
              <p className="prose-lede mt-3 text-body-s text-muted2">{episode.description}</p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="text-[0.8125rem] text-faint">{episode.date}</span>
              {episode.duration ? (
                <span className="text-[0.8125rem] tabular-nums text-faint">{episode.duration}</span>
              ) : null}
            </div>

            {categories.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {categories.map((c) => (
                  <li key={c}>
                    <Chip kind={chipKind(c)}>{c}</Chip>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {guests.length > 0 ? (
            <div className="card p-5">
              <Eyebrow>In conversation</Eyebrow>
              <ul className="mt-4 space-y-4">
                {guests.map((g) => (
                  <li key={g} className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="img-ring meta grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-muted2"
                    >
                      {monogram(g)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-body-s font-medium text-text">{g}</span>
                      <span className="block truncate text-[0.75rem] text-muted2">{show.title}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Link to={showPath} className="card press lift block overflow-hidden">
            <span className="relative block aspect-[16/9] overflow-hidden">
              <img
                src={showArt}
                alt=""
                loading="lazy"
                className="absolute inset-0 size-full object-cover transition-[scale] duration-300 ease-[var(--ease-out-strong)] hover:scale-[1.04]"
              />
              {/* Permanently dark strip under the scrim: the mark takes
                  fixed white rather than the page-following tokens. */}
              <span
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"
              />
              <ChmMark className="absolute bottom-3 start-3 size-6 text-white/90" />
            </span>
            <span className="block p-5">
              <Eyebrow>From the show</Eyebrow>
              <span className="display mt-2 block text-body-l text-text">{show.title}</span>
              <span className="prose-lede mt-1.5 block line-clamp-3 text-body-s text-muted2">
                {show.tagline}
              </span>
              <span className="eyebrow mt-3 block text-anchor">
                {episodes.length > 0 ? `${episodes.length} episodes ` : 'All episodes '}→
              </span>
            </span>
          </Link>

          <div className="card p-5">
            <Eyebrow>Listen on</Eyebrow>
            <ul className="mt-4 flex flex-wrap gap-2">
              {listenOn.map((p) => (
                <li key={p.href}>
                  <a
                    href={p.href}
                    target="_blank"
                    rel="noreferrer"
                    className="press inline-flex h-8 items-center rounded-[6px] bg-surface-2 px-3 text-body-s text-dim hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {p.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </section>

      {more.length > 0 ? (
        <section aria-labelledby="more-heading" className="pt-16">
          <SectionHead
            id="more-heading"
            title={`More from ${show.title}`}
            seeAll={{ noun: 'episodes', to: showPath }}
          />
          <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((ep) => (
              <li key={ep.videoId}>
                <EpisodeCard episode={ep} showId={showId} fallbackArt={showArt} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function EpisodeCard({
  episode,
  showId,
  fallbackArt,
}: {
  episode: PodcastEpisode;
  showId: string;
  fallbackArt: string;
}) {
  return (
    <Link
      to={podcastEpisodeWatchPath(showId, episode.videoId!)}
      className="press lift group flex h-full flex-col gap-4 rounded-[6px] p-4 shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="relative">
        <Thumb
          src={episode.thumbnailUrl ?? fallbackArt}
          duration={episode.duration}
          className="aspect-video w-full"
        />
        <span className="eyebrow absolute top-3 start-3 inline-flex h-6 items-center rounded-[6px] bg-ground/70 px-3 text-text backdrop-blur-sm">
          {episode.num}
        </span>
      </div>
      <div className="flex flex-1 flex-col px-1 pb-1">
        <h3 className="display line-clamp-2 text-body-m text-text">{episode.title}</h3>
        <p className="meta mt-auto pt-4 tabular-nums text-faint">{episode.date}</p>
      </div>
    </Link>
  );
}
