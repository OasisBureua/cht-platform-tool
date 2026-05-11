import { useMemo } from 'react';
import { Play, Sparkles, ArrowUpDown, ChevronRight } from 'lucide-react';
import type { PodcastEpisode, PodcastShow } from '../../data/podcastsCatalog';

export function latestEpisode(show: PodcastShow): PodcastEpisode {
  const eps = [...show.episodes];
  eps.sort((a, b) => new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime());
  return eps[0]!;
}

const LISTEN_PLATFORMS = [
  'Apple Podcasts',
  'Spotify',
  'Amazon Music',
  'iHeartRadio',
  'Castbox',
  'Pocket Casts',
];

function EpisodeRow({ ep }: { ep: PodcastEpisode }) {
  return (
    <li>
      <button
        type="button"
        className="group flex w-full gap-3 rounded-2xl px-4 py-4 text-left shadow-[0_4px_22px_-14px_rgba(0,0,0,0.1)] transition-[background-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-zinc-50/95 hover:shadow-[0_8px_28px_-16px_rgba(0,0,0,0.12)] focus-visible:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 active:scale-[0.995] dark:hover:bg-zinc-800/85 dark:focus-visible:bg-zinc-800 dark:shadow-[0_4px_26px_-14px_rgba(0,0,0,0.4)] sm:gap-4 sm:px-6 sm:py-5"
        aria-label={`Episode ${ep.num.replace(/\D/g, '')}: ${ep.title}`}
      >
        <div className="flex min-h-[44px] min-w-[3.25rem] shrink-0 flex-col items-center justify-center rounded-xl bg-zinc-50 px-2.5 py-2 text-center shadow-[0_4px_18px_-12px_rgba(0,0,0,0.08)] dark:bg-zinc-800 sm:min-w-[3.5rem] sm:px-3">
          <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">Ep</span>
          <span className="text-lg font-extrabold leading-none text-zinc-900 tabular-nums dark:text-zinc-100">
            {ep.num.replace(/\D/g, '')}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-balance font-semibold leading-snug text-zinc-900 dark:text-zinc-100 sm:text-base">{ep.title}</p>
          <p className="mt-1 line-clamp-1 text-xs font-normal text-zinc-500 dark:text-zinc-500 sm:text-sm">{ep.guests}</p>
          {ep.description ? (
            <p className="mt-1.5 line-clamp-2 font-sans text-pretty text-sm font-normal leading-relaxed text-zinc-600 dark:text-zinc-400">
              {ep.description}
            </p>
          ) : null}
          <p className="mt-1.5 text-xs text-zinc-600 tabular-nums dark:text-zinc-500 sm:hidden">
            {ep.date} <span className="text-zinc-400 dark:text-zinc-600">|</span> {ep.duration}
          </p>
        </div>
        <div className="hidden shrink-0 flex-col items-end justify-center gap-1 text-right sm:flex">
          <time className="whitespace-nowrap text-xs text-zinc-600 tabular-nums dark:text-zinc-500" dateTime={ep.dateIso}>
            {ep.date}
          </time>
          <span className="text-xs font-semibold text-brand-800 tabular-nums dark:text-brand-300">{ep.duration}</span>
        </div>
        <ChevronRight
          className="h-5 w-5 shrink-0 self-center text-zinc-400 transition-[color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] group-hover:translate-x-0.5 group-hover:text-zinc-600 dark:text-zinc-600 dark:group-hover:text-zinc-300"
          aria-hidden
        />
      </button>
    </li>
  );
}

export function SeriesSection({
  show,
  sortNewestFirst,
  onToggleSort,
}: {
  show: PodcastShow;
  sortNewestFirst: boolean;
  onToggleSort: () => void;
}) {
  const sortedEpisodes = useMemo(() => {
    return [...show.episodes].sort((a, b) => {
      const aTime = new Date(a.dateIso).getTime();
      const bTime = new Date(b.dateIso).getTime();
      return sortNewestFirst ? bTime - aTime : aTime - bTime;
    });
  }, [show.episodes, sortNewestFirst]);

  return (
    <section
      id={show.id}
      className="overflow-hidden rounded-2xl bg-white text-zinc-900 shadow-[0_10px_44px_-28px_rgba(0,0,0,0.12)] dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-[0_12px_48px_-30px_rgba(0,0,0,0.55)]"
      aria-label={`${show.title} series`}
    >
      <div className="min-w-0">
        <div className="relative overflow-hidden bg-gradient-to-r from-violet-100 via-brand-50 to-white px-5 py-5 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 sm:px-7 sm:py-6 md:px-10 md:py-7">
          <div className="pointer-events-none absolute -right-20 -top-16 h-56 w-56 rounded-full bg-violet-200/35 blur-3xl dark:opacity-40" />
          <div className="pointer-events-none absolute left-1/4 top-0 h-40 w-40 rounded-full bg-brand-200/30 blur-3xl dark:opacity-30" />
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <img
              src={show.image}
              alt=""
              className="h-24 w-24 shrink-0 rounded-xl object-cover shadow-md sm:h-28 sm:w-28"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-800 dark:text-brand-300">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden />
                <span>{show.category}</span>
              </div>
              <h2 className="mt-1 text-balance text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl md:text-4xl">
                {show.title}
              </h2>
              <p className="mt-1.5 max-w-2xl font-sans text-pretty text-sm font-normal leading-relaxed text-zinc-600 dark:text-zinc-400">
                {show.tagline}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
                <a
                  href="https://communityhealth.media"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[40px] min-w-[44px] items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-[0_8px_28px_-12px_rgba(43,168,154,0.45)] transition-[background-color,transform] duration-200 hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 active:scale-[0.96]"
                >
                  <Play className="h-4 w-4 fill-current" aria-hidden />
                  Play latest
                </a>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white px-4 py-3 shadow-[inset_0_10px_28px_-22px_rgba(15,23,42,0.12)] dark:bg-zinc-900 dark:shadow-[inset_0_10px_28px_-22px_rgba(0,0,0,0.45)] sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-400">
              Listen on
            </span>
            {LISTEN_PLATFORMS.map((platform) => (
              <button
                key={platform}
                type="button"
                className="inline-flex min-h-[32px] items-center rounded-full bg-zinc-50 px-3 text-xs font-medium text-zinc-700 transition-[background-color,color,transform] duration-200 hover:bg-zinc-100 active:scale-[0.96] dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                {platform}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-zinc-50/95 px-4 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75),inset_0_12px_32px_-24px_rgba(15,23,42,0.08)] dark:bg-zinc-950/85 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04),inset_0_12px_32px_-24px_rgba(0,0,0,0.35)] sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-400">Episodes</h3>
          <button
            type="button"
            onClick={onToggleSort}
            aria-pressed={sortNewestFirst}
            className="inline-flex min-h-[32px] items-center rounded-full bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm transition-[background-color,color,transform] duration-200 hover:bg-zinc-50 active:scale-[0.96] dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <ArrowUpDown className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            {sortNewestFirst ? 'Newest first' : 'Oldest first'}
          </button>
        </div>
      </div>

      <ul className="flex flex-col gap-2 px-2 py-3 sm:gap-2.5 sm:px-3 sm:py-4">
        {sortedEpisodes.map((ep) => (
          <EpisodeRow key={show.id + ep.num + ep.title} ep={ep} />
        ))}
      </ul>
    </section>
  );
}
