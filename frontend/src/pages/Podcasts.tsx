import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Mic2, Play, PlayCircle, Bell, Headphones } from 'lucide-react';
import {
  PODCAST_SHOWS,
  UPCOMING_PLACEHOLDER,
  type PodcastEpisode,
  type PodcastShow,
} from '../data/podcastsCatalog';
import { SeriesSection, latestEpisode } from '../components/podcasts/PodcastSeriesSection';

function NewNoteworthyCarousel({ shows }: { shows: PodcastShow[] }) {
  const n = shows.length;
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const idKey = shows.map((s) => s.id).join('|');

  useEffect(() => {
    setIndex(0);
  }, [idKey]);

  const goPrev = useCallback(() => {
    if (n <= 1) return;
    setIndex((i) => (i - 1 + n) % n);
  }, [n]);

  const goNext = useCallback(() => {
    if (n <= 1) return;
    setIndex((i) => (i + 1) % n);
  }, [n]);

  if (n === 0) return null;

  return (
    <div className="relative isolate">
      <div
        className="overflow-hidden rounded-2xl bg-orange-600 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.35)]"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current == null || n <= 1) {
            touchStartX.current = null;
            return;
          }
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          touchStartX.current = null;
          if (dx > 60) goPrev();
          else if (dx < -60) goNext();
        }}
      >
        <div
          className="flex transition-transform duration-500 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none"
          style={{
            width: `${n * 100}%`,
            transform: n <= 1 ? 'translateX(0)' : `translateX(-${(index / n) * 100}%)`,
          }}
        >
          {shows.map((show) => (
            <div key={show.id} className="relative shrink-0" style={{ width: `${100 / n}%` }}>
              <div className="relative h-[min(59.8vh,460px)] min-h-[322px] w-full sm:min-h-[368px]">
                <img
                  src={show.image}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover object-center"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  draggable={false}
                />
                <div className="pointer-events-none absolute inset-y-0 left-0 w-[55%] bg-gradient-to-r from-black/55 via-black/18 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[82%] bg-gradient-to-t from-black/78 via-black/30 to-transparent" />
                <div className="relative z-10 flex h-full -translate-y-2.5 flex-col justify-end p-5 text-white sm:p-7 md:p-8">
                  <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-orange-200">{show.category}</p>
                  <h3 className="mb-2 max-w-[20ch] text-balance font-sans text-[22px] font-extrabold leading-[1.08] tracking-[-0.02em] text-white sm:text-[28px]">
                    {show.title}
                  </h3>
                  <p className="mb-4 line-clamp-2 max-w-lg text-pretty text-sm leading-relaxed text-white/90 md:text-[15px]">
                    {show.updateNote}
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      to={`/app/podcasts/${show.id}`}
                      className="inline-flex h-11 min-w-[44px] items-center justify-center gap-2 rounded-md bg-white px-5 text-sm font-semibold text-zinc-900 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset] transition-[background-color,transform] duration-200 hover:bg-white/95 active:scale-[0.96]"
                    >
                      <PlayCircle className="h-4 w-4" aria-hidden />
                      Open series
                    </Link>
                    <a
                      href="#podcast-catalog"
                      className="inline-flex h-11 min-w-[44px] items-center justify-center gap-2 rounded-md bg-orange-600 px-5 text-sm font-semibold text-white shadow-[0_1px_0_0_rgba(255,255,255,0.12)_inset,0_8px_24px_-10px_rgba(234,88,12,0.45)] transition-[background-color,transform] duration-200 hover:bg-orange-700 active:scale-[0.96]"
                    >
                      Full catalog
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {n > 1 ? (
        <div
          className="mt-4 flex flex-wrap items-center justify-center gap-2"
          role="tablist"
          aria-label="New and noteworthy slides"
        >
          {shows.map((show, i) => (
            <button
              key={show.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show ${show.title}`}
              onClick={() => setIndex(i)}
              className={[
                'h-2 rounded-full transition-[width,background-color] duration-300',
                i === index ? 'w-8 bg-orange-500' : 'w-2 bg-zinc-300 dark:bg-zinc-600',
              ].join(' ')}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TopShowsRow({ shows }: { shows: PodcastShow[] }) {
  return (
    <div className="flex items-start gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {shows.map((show) => (
        <a
          key={`top-${show.id}`}
          href={`#${show.id}`}
          className="group shrink-0 w-[5.5rem] text-center"
        >
          <div className="mx-auto aspect-square w-full overflow-hidden rounded-xl bg-zinc-100 shadow-[0_8px_28px_-18px_rgba(0,0,0,0.18),0_2px_10px_-4px_rgba(0,0,0,0.08)] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_12px_32px_-18px_rgba(0,0,0,0.2),0_4px_14px_-4px_rgba(0,0,0,0.1)] dark:bg-zinc-800 dark:shadow-[0_8px_28px_-18px_rgba(0,0,0,0.45),0_2px_10px_-4px_rgba(0,0,0,0.25)]">
            <img
              src={show.image}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          </div>
          <p className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-tight text-zinc-800 dark:text-zinc-200">
            {show.title}
          </p>
        </a>
      ))}
    </div>
  );
}

function WorthListenCard({ show, episode }: { show: PodcastShow; episode: PodcastEpisode }) {
  return (
    <article className="relative flex min-w-0 aspect-[3/4] max-h-[280px] min-h-0 w-full flex-col overflow-hidden rounded-2xl bg-orange-600 shadow-[0_12px_36px_-20px_rgba(0,0,0,0.35)] sm:max-h-[300px] dark:shadow-[0_14px_40px_-22px_rgba(0,0,0,0.55)]">
      <img
        src={show.image}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <div className="pointer-events-none absolute inset-0 bg-black/30" aria-hidden />
      <div className="relative z-10 mt-auto flex min-w-0 flex-col p-4 sm:p-4">
        <div className="mb-1.5 flex min-w-0 flex-nowrap items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/85">
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-1.5 py-0.5 backdrop-blur-sm">
            <Headphones className="h-2.5 w-2.5" aria-hidden />
            Audio
          </span>
          <span className="min-w-0 flex-1 truncate">{show.title}</span>
        </div>
        <h3
          className="line-clamp-1 min-w-0 text-base font-bold leading-snug text-white sm:text-lg"
          title={episode.title}
        >
          {episode.title}
        </h3>
        {episode.description ? (
          <p className="mt-1.5 line-clamp-2 text-pretty text-xs leading-relaxed text-white/90">{episode.description}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            to={`/app/podcasts/${show.id}`}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-white px-4 text-xs font-semibold text-zinc-900 shadow-md transition-[background-color,transform] duration-200 hover:bg-white/95 active:scale-[0.98] sm:text-sm"
          >
            <Play className="h-3.5 w-3.5 fill-current sm:h-4 sm:w-4" aria-hidden />
            {episode.duration}
          </Link>
          <span className="text-[10px] text-white/70 tabular-nums sm:text-xs">{episode.date}</span>
        </div>
      </div>
    </article>
  );
}

export default function Podcasts() {
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const shows = PODCAST_SHOWS;

  const worthListen = useMemo(() => {
    return shows.slice(0, 3).map((show) => ({
      show,
      episode: latestEpisode(show),
    }));
  }, [shows]);

  return (
    <div className="flex flex-col gap-6 pb-24 md:gap-8 md:pb-16">
      <header>
        <div>
          <div className="mb-2 flex items-center gap-2.5 text-zinc-900 dark:text-zinc-100">
            <Mic2 className="h-5 w-5 text-[#ea580c] dark:text-[#fb923c]" strokeWidth={2} aria-hidden />
            <h1 className="text-balance text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-3xl">
              Podcasts
            </h1>
          </div>
          <p className="max-w-2xl text-pretty text-sm font-normal leading-relaxed text-zinc-600 dark:text-zinc-400">
            Browse CHM audio like a catalog: new drops, featured episodes, and every series in one place.
          </p>
        </div>
      </header>

      {/* New & noteworthy - same carousel mechanics as Dashboard Featured */}
      <section aria-labelledby="podcasts-new" className="-mt-2 md:-mt-4">
        <h2 id="podcasts-new" className="sr-only">
          New & noteworthy
        </h2>
        <NewNoteworthyCarousel shows={shows} />
      </section>

      {/* Worth the Watch analogue: tall hero cards */}
      <section aria-labelledby="podcasts-worth" className="space-y-3">
        <h2 id="podcasts-worth" className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Worth the listen
        </h2>
        <p className="-mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Latest standout episodes: full art, quick play, then open the show page for the full run.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {worthListen.map(({ show, episode }) => (
            <WorthListenCard key={show.id} show={show} episode={episode} />
          ))}
        </div>
      </section>

      {/* Compact thumb row + view all */}
      <section aria-labelledby="podcasts-top" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="podcasts-top" className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Top shows
          </h2>
          <a
            href="#podcast-catalog"
            className="text-sm font-semibold text-[#c2410c] underline-offset-4 transition-colors hover:text-[#ea580c] hover:underline dark:text-[#fb923c] dark:hover:text-[#fdba74]"
          >
            View all shows
          </a>
        </div>
        <TopShowsRow shows={shows} />
      </section>

      {/* Full catalog */}
      <div id="podcast-catalog" className="scroll-mt-24 space-y-8 md:space-y-10">
        <div className="pt-10 shadow-[0_-24px_48px_-36px_rgba(15,23,42,0.07)] dark:shadow-[0_-24px_48px_-36px_rgba(0,0,0,0.35)]">
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">All series</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Every CHM podcast with full episode lists and listen links.
          </p>
        </div>
        {shows.map((show) => (
          <SeriesSection
            key={show.id}
            show={show}
            sortNewestFirst={sortNewestFirst}
            onToggleSort={() => setSortNewestFirst((v) => !v)}
          />
        ))}
      </div>

      <section
        className="overflow-hidden rounded-2xl bg-gradient-to-b from-zinc-50/95 to-zinc-100/80 shadow-[0_12px_40px_-24px_rgba(15,23,42,0.1),0_4px_20px_-16px_rgba(15,23,42,0.06)] dark:from-zinc-900/90 dark:to-zinc-950/95 dark:shadow-[0_16px_48px_-28px_rgba(0,0,0,0.55),0_8px_28px_-20px_rgba(0,0,0,0.35)]"
        aria-label="Upcoming series"
      >
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-stretch sm:gap-6 sm:p-6 md:p-8">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl sm:max-w-xs sm:shrink-0">
            <img
              src={UPCOMING_PLACEHOLDER.image}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-zinc-950/40">
              <span className="text-sm font-bold tracking-[0.2em] text-zinc-700 dark:text-zinc-200">Soon</span>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <h2 className="text-balance text-xl font-bold text-zinc-900 dark:text-zinc-100">{UPCOMING_PLACEHOLDER.title}</h2>
            <p className="mt-2 text-pretty text-sm font-normal leading-relaxed text-zinc-600 dark:text-zinc-400">
              {UPCOMING_PLACEHOLDER.tagline}
            </p>
            <button
              type="button"
              className="mt-5 inline-flex min-h-[44px] w-fit items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 shadow-[0_2px_8px_rgba(15,23,42,0.06),0_8px_24px_-12px_rgba(15,23,42,0.12)] transition-[background-color,transform,box-shadow] duration-200 hover:bg-zinc-50 hover:shadow-[0_4px_12px_rgba(15,23,42,0.08),0_12px_28px_-12px_rgba(15,23,42,0.14)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-900 dark:text-zinc-200 dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)] dark:hover:bg-zinc-800"
              disabled
              aria-disabled
            >
              <Bell className="h-4 w-4 shrink-0" aria-hidden />
              Notify me when live
            </button>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
              We will use the email on your account when this goes live.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
