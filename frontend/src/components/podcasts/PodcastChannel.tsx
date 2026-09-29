import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ExternalLink, Link2, Loader2, Play } from 'lucide-react';
import {
  CHM_PODCAST_PLATFORM_LINKS,
  PODCAST_SHOWS,
  type PodcastEpisode,
  type PodcastShow,
} from '../../data/podcastsCatalog';
import { usePodcastEpisodes } from '../../hooks/usePodcastYouTubeEpisodes';
import type { PodcastEpisodeSort } from '../../utils/podcastYouTube';
import { podcastEpisodeWatchPath } from '../../utils/podcastRoutes';
import { waveBars } from '../home/waveBars';
import { SegmentedControl } from '../ui';
import { YouTubePlayer } from '../YouTubePlayer';
import { latestEpisode } from './PodcastSeriesSection';

/**
 * One podcast channel, used twice: inside the app at
 * /app/podcast-network/:showId, and as the standalone public page at
 * /podcast-network/:showId, which is the link people share. Episodes come
 * from the public episodes API, so the standalone page is complete
 * without an account: episodes play inline there, and in the app they
 * open the member watch page.
 *
 * The hero is the homepage's podcast card at full width: the permanently
 * deep teal with the show's seeded waveform, so its text stays fixed white
 * in both appearances.
 */
const DEEP = 'hsl(196 66% 23%)';

const SORT_OPTIONS: { value: PodcastEpisodeSort; label: string }[] = [
  { value: 'latest', label: 'Latest' },
  { value: 'popular', label: 'Popular' },
  { value: 'oldest', label: 'Oldest' },
];

export type PodcastChannelMode = 'app' | 'public';

function podcastChannelPublicUrl(showId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/podcast-network/${encodeURIComponent(showId)}`;
}

/** Episode titles from YouTube repeat the show name; the channel already says it. */
function episodeTitle(ep: PodcastEpisode): string {
  const parts = ep.title.split('|');
  if (parts.length > 1 && /ep\.?\s*\d+/i.test(parts[0])) return parts.slice(1).join('|').trim();
  return ep.title;
}

function episodeNumber(ep: PodcastEpisode): string {
  return ep.num.replace(/\D/g, '');
}

function CopyLinkButton({ showId }: { showId: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const url = podcastChannelPublicUrl(showId);
  const inputRef = useRef<HTMLInputElement>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
      window.setTimeout(() => setState('idle'), 2200);
    } catch {
      setState('manual');
      window.setTimeout(() => inputRef.current?.select(), 0);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={copy}
        className="press inline-flex h-11 items-center gap-2 rounded-[8px] px-4 text-body-s font-medium text-white ring-1 ring-white/35 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {state === 'copied' ? <Check className="size-4" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
        {state === 'copied' ? 'Link copied' : 'Copy link'}
      </button>
      {state === 'manual' ? (
        <input
          ref={inputRef}
          readOnly
          value={url}
          aria-label="Channel link"
          className="h-11 min-w-[16rem] rounded-[8px] bg-white/10 px-3 text-body-s text-white ring-1 ring-white/25"
          onFocus={(e) => e.currentTarget.select()}
        />
      ) : null}
      <span className="sr-only" role="status">
        {state === 'copied' ? 'Link copied to clipboard' : ''}
      </span>
    </div>
  );
}

export function PodcastChannel({ show, mode }: { show: PodcastShow; mode: PodcastChannelMode }) {
  const [sort, setSort] = useState<PodcastEpisodeSort>('latest');
  const [playing, setPlaying] = useState<PodcastEpisode | null>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  const query = usePodcastEpisodes(show.remoteEpisodes ? show.id : undefined, sort);
  const remote = query.data?.episodes;
  const episodes = useMemo(
    () => (show.remoteEpisodes ? remote ?? [] : show.episodes),
    [show.remoteEpisodes, show.episodes, remote],
  );
  const latest = useMemo(() => latestEpisode(show, episodes), [show, episodes]);
  const platforms = show.platformLinks ?? CHM_PODCAST_PLATFORM_LINKS;
  const lang = show.id === 'tetalks' ? 'es' : undefined;
  const channelBase = mode === 'app' ? '/app/podcast-network' : '/podcast-network';
  const others = PODCAST_SHOWS.filter((s) => s.id !== show.id);
  const current = playing ?? (mode === 'public' ? latest : null);

  const playInline = (ep: PodcastEpisode) => {
    setPlaying(ep);
    window.setTimeout(() => playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
  };

  const playLatest =
    latest?.videoId && mode === 'app' ? (
      <Link
        to={podcastEpisodeWatchPath(show.id, latest.videoId)}
        className="press inline-flex h-11 items-center gap-2 rounded-[8px] bg-white px-5 text-body-s font-medium text-[hsl(196_66%_23%)] transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <Play className="size-4 fill-current" aria-hidden />
        Play latest
      </Link>
    ) : latest?.youtubeUrl ? (
      <button
        type="button"
        onClick={() => playInline(latest)}
        className="press inline-flex h-11 items-center gap-2 rounded-[8px] bg-white px-5 text-body-s font-medium text-[hsl(196_66%_23%)] transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <Play className="size-4 fill-current" aria-hidden />
        Play latest
      </button>
    ) : null;

  return (
    <div className="space-y-8">
      <section
        aria-labelledby={`channel-${show.id}`}
        className="relative overflow-hidden rounded-card text-white shadow-card"
        style={{ background: DEEP }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 flex h-24 items-end gap-[3px] px-6 opacity-40 md:h-32"
        >
          {[...waveBars(show.id), ...waveBars(`${show.id}-2`)].map((b, i) => (
            <span key={i} className="flex-1 rounded-t-[2px] bg-white/35" style={{ height: `${b.height}%` }} />
          ))}
        </div>

        <div className="relative grid gap-6 p-5 sm:p-8 md:grid-cols-[13rem_1fr] md:items-center md:gap-10 md:p-10">
          <img
            src={show.image}
            alt=""
            className="aspect-square w-40 rounded-[12px] object-cover shadow-[0_18px_40px_-18px_rgba(0,0,0,0.6)] ring-1 ring-white/15 sm:w-48 md:w-full"
            loading="eager"
            referrerPolicy="no-referrer"
          />
          <div className="min-w-0">
            <p className="eyebrow text-white/70" lang={lang}>
              {show.category}
            </p>
            <h1
              id={`channel-${show.id}`}
              className="display mt-3 max-w-[18ch] text-[2.25rem] leading-[1.04] tracking-[-0.03em] text-white md:text-[3.25rem]"
            >
              {show.title}
            </h1>
            <p className="prose-lede mt-4 max-w-[58ch] text-body-m text-white/85" lang={lang}>
              {show.tagline}
            </p>
            <p className="meta mt-3 tabular-nums text-white/65">
              {episodes.length > 0 ? `${episodes.length} episodes · ` : ''}
              <span lang={lang}>{show.updateNote}</span>
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              {playLatest}
              <CopyLinkButton showId={show.id} />
            </div>
            {platforms.length > 0 ? (
              <ul className="mt-5 flex flex-wrap items-center gap-2" aria-label="Listen on">
                {platforms.map((p) => (
                  <li key={p.href}>
                    <a
                      href={p.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs text-white/90 transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                      {p.label}
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </section>

      {mode === 'public' && current?.youtubeUrl ? (
        <div ref={playerRef} className="space-y-3">
          <div className="overflow-hidden rounded-card bg-black shadow-card">
            <YouTubePlayer
              key={current.videoId ?? current.youtubeUrl}
              youtubeUrl={current.youtubeUrl}
              muted={false}
              autoplay={Boolean(playing)}
              title={episodeTitle(current)}
              className="aspect-video w-full"
            />
          </div>
          <p className="text-body-s text-muted2">
            <span className="meta text-faint">Now playing · Ep {episodeNumber(current)}</span>{' '}
            <span className="text-text">{episodeTitle(current)}</span>
          </p>
        </div>
      ) : null}

      <section aria-labelledby={`episodes-${show.id}`} className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id={`episodes-${show.id}`} className="display text-display-s text-text">
            Episodes
          </h2>
          {show.remoteEpisodes ? (
            <SegmentedControl
              label="Sort episodes"
              segments={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              value={sort}
              onChange={setSort}
            />
          ) : null}
        </div>

        {query.isLoading ? (
          <div className="flex items-center gap-2 py-10 text-body-s text-muted2">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            Loading episodes
          </div>
        ) : query.isError ? (
          <p className="py-8 text-body-s text-muted2">Episodes didn't load. Refresh the page to try again.</p>
        ) : episodes.length === 0 ? (
          <p className="py-8 text-body-s text-muted2">The first episode is on its way.</p>
        ) : (
          <ul className="card divide-y divide-hairline overflow-hidden p-0">
            {episodes.map((ep) => {
              const active = current && (current.videoId ?? current.title) === (ep.videoId ?? ep.title);
              const inner = (
                <>
                  <span className="relative hidden aspect-video w-36 shrink-0 overflow-hidden rounded-[8px] bg-surface-2 sm:block">
                    {ep.thumbnailUrl ? (
                      <img src={ep.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
                    ) : null}
                    <span className="absolute inset-0 m-auto grid size-8 place-items-center rounded-full bg-black/55 text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      <Play className="ms-0.5 size-3.5 fill-current" aria-hidden />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="meta block tabular-nums text-anchor">Ep {episodeNumber(ep)}</span>
                    <span className="mt-1 block text-body-m font-medium leading-snug text-text">
                      {episodeTitle(ep)}
                    </span>
                    {ep.guests ? <span className="mt-1 block line-clamp-1 text-body-s text-muted2">{ep.guests}</span> : null}
                  </span>
                  <span className="hidden shrink-0 flex-col items-end gap-1 text-right sm:flex">
                    <time className="meta whitespace-nowrap tabular-nums text-faint" dateTime={ep.dateIso}>
                      {ep.date}
                    </time>
                    {ep.duration ? <span className="meta tabular-nums text-dim">{ep.duration}</span> : null}
                  </span>
                </>
              );
              const rowClass = [
                'group flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-5',
                active ? 'bg-anchor/[0.06]' : '',
              ].join(' ');
              return (
                <li key={show.id + (ep.videoId ?? ep.num) + ep.title}>
                  {mode === 'app' && ep.videoId ? (
                    <Link to={podcastEpisodeWatchPath(show.id, ep.videoId)} className={rowClass}>
                      {inner}
                    </Link>
                  ) : ep.youtubeUrl ? (
                    <button type="button" onClick={() => playInline(ep)} className={rowClass} aria-current={active ? 'true' : undefined}>
                      {inner}
                    </button>
                  ) : (
                    <div className={rowClass}>{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby={`more-${show.id}`} className="space-y-4">
        <h2 id={`more-${show.id}`} className="display text-display-s text-text">
          More from the network
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {others.map((s) => (
            <li key={s.id}>
              <Link
                to={`${channelBase}/${encodeURIComponent(s.id)}`}
                className="group flex items-center gap-3 rounded-card bg-surface p-3 shadow-card transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <img src={s.image} alt="" loading="lazy" className="size-14 shrink-0 rounded-[8px] object-cover" />
                <span className="min-w-0">
                  <span className="display block truncate text-body-m text-text">{s.title}</span>
                  <span className="meta block truncate text-faint" lang={s.id === 'tetalks' ? 'es' : undefined}>
                    {s.category}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
