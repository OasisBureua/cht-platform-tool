import { useMemo, useState } from 'react';
import { Mic2, Play, ChevronRight, Bell, Sparkles, ArrowUpDown } from 'lucide-react';

type Episode = {
  num: string;
  title: string;
  guests: string;
  date: string;
  dateIso: string;
  duration: string;
  description?: string;
};

const BREAST_FRIENDS: {
  id: string;
  title: string;
  tagline: string;
  image: string;
  episodes: Episode[];
} = {
  id: 'breast-friends',
  title: 'Breast Friends',
  tagline:
    'Direct, expert-led conversations about breast cancer, built for patients and clinicians. We pair first-line data with what it feels like in the exam room and at home.',
  image: '/images/iStock-1869998948-a6d5f1f2-fc95-4c9b-a1b6-b579bd7b6758.png',
  episodes: [
    {
      num: 'Ep 1',
      title: 'Welcome to Breast Friends: Why This Podcast Exists',
      guests: 'Community Health Media',
      date: 'Oct 22, 2025',
      dateIso: '2025-10-22',
      duration: '18 min',
      description:
        'The first episode lays out the goal: expert oncology talk that anyone in breast cancer can actually use, without the jargon wall.',
    },
    {
      num: 'Ep 2',
      title: 'Navigating Your First Diagnosis',
      guests: 'Community Health Media',
      date: 'Nov 4, 2025',
      dateIso: '2025-11-04',
      duration: '38 min',
      description:
        'Questions to bring to your team, how to read a pathology report, and what HER2+ means for your case.',
    },
    {
      num: 'Ep 3',
      title: 'Treatment Options Demystified',
      guests: 'Community Health Media',
      date: 'Nov 18, 2025',
      dateIso: '2025-11-18',
      duration: '42 min',
      description: 'Surgery, radiation, and systemic therapy in plain language, with no sales pitch.',
    },
  ],
};

const UPCOMING_SHOW = {
  id: 'coming-soon-1',
  title: 'More series',
  tagline:
    'We are recording new disease-area shows and short-run seasons. When they ship, you will see them here first.',
  image: '/images/iStock-1917170353-5564763c-6ced-49b2-93ff-6a2261700399.png',
};

export default function Podcasts() {
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const sortedEpisodes = useMemo(() => {
    return [...BREAST_FRIENDS.episodes].sort((a, b) => {
      const aTime = new Date(a.dateIso).getTime();
      const bTime = new Date(b.dateIso).getTime();
      return sortNewestFirst ? bTime - aTime : aTime - bTime;
    });
  }, [sortNewestFirst]);

  return (
    <div className="space-y-8 pb-24 font-['DM_Sans',system-ui,sans-serif] md:pb-0">
      <header className="md:flex md:items-end md:justify-between md:gap-6">
        <div>
          <div className="mb-2 flex items-center gap-2.5 text-gray-900">
            <Mic2 className="h-5 w-5 text-brand-700" strokeWidth={2} aria-hidden />
            <h1 className="text-balance text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">Podcasts</h1>
          </div>
          <p className="max-w-2xl font-sans text-pretty text-sm font-normal leading-relaxed text-zinc-600">
            Long-form audio from CHM. Same editorial standards as the main hub, built for headphones and a little more room to breathe.
          </p>
        </div>
        <p className="mt-3 hidden text-xs font-medium uppercase tracking-[0.2em] text-gray-500 md:mt-0 md:block">CHM original</p>
      </header>

      <section
        className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white text-gray-900 shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_40px_-18px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.02)]"
        aria-label="Breast Friends series"
      >
        <div className="min-w-0">
          <div className="relative overflow-hidden bg-gradient-to-r from-violet-100 via-brand-50 to-white px-5 py-5 sm:px-7 sm:py-6 md:px-10 md:py-7">
            <div className="pointer-events-none absolute -right-20 -top-16 h-56 w-56 rounded-full bg-violet-200/35 blur-3xl" />
            <div className="pointer-events-none absolute left-1/4 top-0 h-40 w-40 rounded-full bg-brand-200/30 blur-3xl" />
            <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <img
                src={BREAST_FRIENDS.image}
                alt="Breast Friends podcast cover art"
                className="h-24 w-24 shrink-0 rounded-xl object-cover outline outline-1 -outline-offset-1 outline-black/10 sm:h-28 sm:w-28"
                loading="eager"
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-800">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden />
                  <span>Original series</span>
                </div>
                <h2 className="mt-1 text-balance text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                  {BREAST_FRIENDS.title}
                </h2>
                <p className="mt-1.5 max-w-2xl font-sans text-pretty text-sm font-normal leading-relaxed text-zinc-600">
                  {BREAST_FRIENDS.tagline}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
                  <a
                    href="https://communityhealth.media"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[40px] min-w-[44px] items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-[0_1px_0_0_rgba(255,255,255,0.12)_inset,0_8px_24px_-10px_rgba(43,168,154,0.45)] transition-[background-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 active:scale-[0.96]"
                  >
                    <Play className="h-4 w-4 fill-current" aria-hidden />
                    Play latest
                  </a>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-200/90 bg-white px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600">Listen on</span>
              {['Apple Podcasts', 'Spotify', 'Amazon Music', 'iHeartRadio', 'Castbox', 'Pocket Casts'].map((platform) => (
                <button
                  key={platform}
                  type="button"
                  className="inline-flex min-h-[32px] items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-gray-50 hover:text-gray-900 active:scale-[0.96]"
                >
                  {platform}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200/90 bg-gray-50 px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600">All episodes</h3>
            <button
              type="button"
              onClick={() => setSortNewestFirst((v) => !v)}
              aria-pressed={sortNewestFirst}
              className="inline-flex min-h-[32px] items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-gray-50 hover:text-gray-900 active:scale-[0.96]"
            >
              <ArrowUpDown className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              {sortNewestFirst ? 'Newest first' : 'Oldest first'}
            </button>
          </div>
        </div>

        <ul className="divide-y divide-gray-100">
          {sortedEpisodes.map((ep) => (
            <li key={ep.num + ep.title}>
              <button
                type="button"
                className="group flex w-full gap-3 px-4 py-4 text-left transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-gray-50/90 focus-visible:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500 active:scale-[0.995] sm:gap-4 sm:px-6 sm:py-5"
                aria-label={`Episode ${ep.num.replace(/\D/g, '')}: ${ep.title}`}
              >
                <div className="flex min-h-[44px] min-w-[3.25rem] shrink-0 flex-col items-center justify-center rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-center shadow-[0_1px_0_rgba(0,0,0,0.03)] sm:min-w-[3.5rem] sm:px-3">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Ep</span>
                  <span className="text-lg font-extrabold leading-none text-gray-900 tabular-nums">
                    {ep.num.replace(/\D/g, '')}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-balance font-semibold leading-snug text-gray-900 sm:text-base">{ep.title}</p>
                  <p className="mt-1 line-clamp-1 text-xs font-normal text-gray-500 sm:text-sm">{ep.guests}</p>
                  {ep.description ? (
                    <p className="mt-1.5 line-clamp-2 font-sans text-pretty text-sm font-normal leading-relaxed text-zinc-600">
                      {ep.description}
                    </p>
                  ) : null}
                  <p className="mt-1.5 text-xs text-gray-600 tabular-nums sm:hidden">
                    {ep.date} <span className="text-gray-400">|</span> {ep.duration}
                  </p>
                </div>
                <div className="hidden shrink-0 flex-col items-end justify-center gap-1 text-right sm:flex">
                  <time className="whitespace-nowrap text-xs text-gray-600 tabular-nums" dateTime={ep.dateIso}>
                    {ep.date}
                  </time>
                  <span className="text-xs font-semibold text-brand-800 tabular-nums">{ep.duration}</span>
                </div>
                <ChevronRight
                  className="h-5 w-5 shrink-0 self-center text-gray-400 transition-[color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] group-hover:translate-x-0.5 group-hover:text-gray-600"
                  aria-hidden
                />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="overflow-hidden rounded-2xl border-2 border-dashed border-gray-300/90 bg-zinc-50/90 shadow-[0_1px_0_rgba(0,0,0,0.03),0_6px_24px_-12px_rgba(0,0,0,0.08)]"
        aria-label="Upcoming series"
      >
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-stretch sm:gap-6 sm:p-6 md:p-8">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl sm:max-w-xs sm:shrink-0">
            <img
              src={UPCOMING_SHOW.image}
              alt=""
              className="h-full w-full object-cover !outline-none ring-1 ring-black/10"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 ring-1 ring-black/5">
              <span className="text-sm font-bold tracking-[0.2em] text-gray-700">Soon</span>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <h2 className="text-balance text-xl font-bold text-gray-900">{UPCOMING_SHOW.title}</h2>
            <p className="mt-2 text-pretty text-sm font-normal leading-relaxed text-gray-600">{UPCOMING_SHOW.tagline}</p>
            <button
              type="button"
              className="mt-5 inline-flex min-h-[44px] w-fit items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm transition-[background-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:border-gray-300 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50"
              disabled
              aria-disabled
            >
              <Bell className="h-4 w-4 shrink-0" aria-hidden />
              Notify me when live
            </button>
            <p className="mt-2 text-xs text-gray-500">We will use the email on your account when this goes live.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
