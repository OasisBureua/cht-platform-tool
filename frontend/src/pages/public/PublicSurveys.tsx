import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { ArrowRight, ClipboardCheck, Play, ChevronRight, Sparkles, ArrowUpDown, Bell } from 'lucide-react';

const STOCK_IMAGES = {
  featuredSurvey: '/images/iStock-1869998948-a6d5f1f2-fc95-4c9b-a1b6-b579bd7b6758.png',
  activityCard: '/images/iStock-1473559425-01131144-01b5-4e7d-9b15-f3db8846cad3.png',
  newestSurvey: '/images/iStock-1944379143-2231d19d-d87a-4843-9909-1b44a35f23ed.png',
  nextActivity: '/images/iStock-1861987830-c4d2cd71-5425-45e5-b008-167e41c1a284.png',
  survey: [
    '/images/iStock-1473559425-01131144-01b5-4e7d-9b15-f3db8846cad3.png',
    '/images/iStock-1667819272-cc7e9fde-feb0-4590-bb35-f5a86deba0dd.png',
    '/images/iStock-1917170353-5564763c-6ced-49b2-93ff-6a2261700399.png',
    '/images/iStock-1938555104-3986b580-5ef8-4aae-989f-05a2edd0bc12.png',
    '/images/iStock-2036497889-fae3ed6e-9859-4983-b3ec-7a489bb6fb95.png',
    '/images/iStock-1344792109-f418c5f0-d729-4965-8b2a-bfff4368cea3.png',
  ],
} as const;

const FEATURED = {
  title: 'HER2+ Treatment Sequencing Survey',
  tagline:
    'Share how you sequence therapies, what guides switching, and where education gaps show up in daily practice. Takes about 15 minutes.',
  image: STOCK_IMAGES.featuredSurvey,
};

const SURVEY_FOCUS = ['Breast cancer', 'Caregiver', 'Communication', 'Research', 'Biomarkers', 'Adherence'] as const;

const SURVEYS = [
  {
    id: '1',
    title: 'Breast Cancer 101: Current Landscape Survey',
    imageUrl: STOCK_IMAGES.survey[0],
    description:
      'Share your perspectives on current treatment approaches, emerging therapies, and clinical practice patterns in breast cancer care.',
  },
  {
    id: '2',
    title: 'Patient Care & Communication Survey',
    imageUrl: STOCK_IMAGES.survey[1],
    description:
      'Help us understand how healthcare providers communicate with patients and what strategies improve shared decision-making.',
  },
  {
    id: '3',
    title: 'Caregiver Support & Wellness Survey',
    imageUrl: STOCK_IMAGES.survey[2],
    description:
      'Tell us about the challenges and support needs of caregivers, and how we can better address their wellness and burnout.',
  },
  {
    id: '4',
    title: 'Clinical Research & Diagnostics Survey',
    imageUrl: STOCK_IMAGES.survey[3],
    description:
      'Share your experience with diagnostic workflows, imaging protocols, and participation in clinical trials and research.',
  },
  {
    id: '5',
    title: 'Biomarkers & Precision Medicine Survey',
    imageUrl: STOCK_IMAGES.survey[4],
    description:
      'Provide feedback on biomarker testing, targeted therapies, and how precision medicine is integrated into your practice.',
  },
  {
    id: '6',
    title: 'Treatment Adherence & Outcomes Survey',
    imageUrl: STOCK_IMAGES.survey[5],
    description:
      'Help us learn about factors that influence treatment adherence and how outcomes are measured and reported in real-world settings.',
  },
] as const;

const UPCOMING = {
  title: 'More surveys coming',
  tagline:
    'We are lining up disease-area and post-session surveys. When they open, signed-in members will see them in the app first.',
  image: STOCK_IMAGES.nextActivity,
};

export default function PublicSurveys() {
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const sorted = useMemo(() => {
    return [...SURVEYS].sort((a, b) => (sortNewestFirst ? Number(b.id) - Number(a.id) : Number(a.id) - Number(b.id)));
  }, [sortNewestFirst]);

  return (
    <div className="space-y-8 bg-white pb-16 font-['DM_Sans',system-ui,sans-serif] text-gray-900 dark:bg-zinc-950 dark:text-zinc-100 md:pb-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="md:flex md:items-end md:justify-between md:gap-6">
          <div>
            <div className="mb-2 flex items-center gap-2.5">
              <ClipboardCheck className="h-5 w-5 text-brand-700" strokeWidth={2} aria-hidden />
              <h1 className="text-balance text-2xl font-bold tracking-tight md:text-3xl">Surveys</h1>
            </div>
            <p className="max-w-2xl text-pretty text-sm font-normal leading-relaxed text-zinc-600 dark:text-zinc-400">
              Short surveys from CHM on care patterns, communication, and research. Sign in to take eligible surveys and
              track post-session rewards in the app.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 md:mt-0">
            <Link
              to="/catalog"
              className="text-sm font-semibold text-brand-700 transition-[color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:text-brand-800 active:scale-[0.98] dark:text-brand-300 dark:hover:text-brand-200"
            >
              Browse catalogue
            </Link>
            <span className="hidden text-xs text-zinc-400 sm:inline" aria-hidden>
              ·
            </span>
            <p className="hidden text-xs font-medium uppercase tracking-[0.2em] text-gray-500 dark:text-zinc-500 sm:block">
              CHM research
            </p>
          </div>
        </header>

        <section
          className="mt-8 overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_40px_-18px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.02)] dark:border-zinc-800/90 dark:bg-zinc-900 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_12px_40px_-18px_rgba(0,0,0,0.5)]"
          aria-label="Featured survey"
        >
          <div className="min-w-0">
            <div className="relative overflow-hidden bg-gradient-to-r from-violet-100 via-brand-50 to-white px-5 py-5 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 sm:px-7 sm:py-6 md:px-10 md:py-7">
              <div className="pointer-events-none absolute -right-20 -top-16 h-56 w-56 rounded-full bg-violet-200/35 blur-3xl dark:bg-violet-900/20" />
              <div className="pointer-events-none absolute left-1/4 top-0 h-40 w-40 rounded-full bg-brand-200/30 blur-3xl dark:bg-brand-900/25" />
              <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center">
                <img
                  src={FEATURED.image}
                  alt=""
                  className="h-24 w-24 shrink-0 rounded-xl object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10 sm:h-28 sm:w-28"
                  loading="eager"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-800 dark:text-brand-300">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden />
                    <span>Featured survey</span>
                  </div>
                  <h2 className="mt-1 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">{FEATURED.title}</h2>
                  <p className="mt-1.5 max-w-2xl text-pretty text-sm font-normal leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {FEATURED.tagline}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
                    <Link
                      to="/app/surveys"
                      className="inline-flex min-h-[40px] min-w-[44px] items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-[0_1px_0_0_rgba(255,255,255,0.12)_inset,0_8px_24px_-10px_rgba(43,168,154,0.45)] transition-[background-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 active:scale-[0.96]"
                    >
                      <Play className="h-4 w-4 fill-current" aria-hidden />
                      Open in app
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200/90 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600 dark:text-zinc-400">
                  Topics
                </span>
                {SURVEY_FOCUS.map((label) => (
                  <span
                    key={label}
                    className="inline-flex min-h-[32px] items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-200/90 bg-gray-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/80 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600 dark:text-zinc-400">
                  All surveys
                </h3>
                <button
                  type="button"
                  onClick={() => setSortNewestFirst((v) => !v)}
                  aria-pressed={sortNewestFirst}
                  className="inline-flex min-h-[32px] items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-gray-50 hover:text-gray-900 active:scale-[0.96] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  <ArrowUpDown className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  {sortNewestFirst ? 'Newest first' : 'Oldest first'}
                </button>
              </div>
            </div>

            <ul className="divide-y divide-gray-100 dark:divide-zinc-800">
              {sorted.map((survey, idx) => (
                <li key={survey.id}>
                  <Link
                    to="/app/surveys"
                    className="group flex w-full gap-3 px-4 py-4 text-left transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-gray-50/90 focus-visible:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500 active:scale-[0.995] dark:hover:bg-zinc-800/70 dark:focus-visible:bg-zinc-800 sm:gap-4 sm:px-6 sm:py-5"
                  >
                    <div className="flex min-h-[44px] min-w-[3.25rem] shrink-0 flex-col items-center justify-center rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-center shadow-[0_1px_0_rgba(0,0,0,0.03)] dark:border-zinc-700 dark:bg-zinc-900 sm:min-w-[3.5rem] sm:px-3">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-500">
                        #
                      </span>
                      <span className="text-lg font-extrabold leading-none text-gray-900 tabular-nums dark:text-zinc-100">
                        {idx + 1}
                      </span>
                    </div>
                    <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg sm:h-20 sm:w-28">
                      <img
                        src={survey.imageUrl}
                        alt=""
                        className="h-full w-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-balance font-semibold leading-snug text-gray-900 dark:text-zinc-100 sm:text-base">
                        {survey.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-pretty text-sm font-normal leading-relaxed text-zinc-600 dark:text-zinc-400">
                        {survey.description}
                      </p>
                    </div>
                    <ChevronRight
                      className="h-5 w-5 shrink-0 self-center text-gray-400 transition-[color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] group-hover:translate-x-0.5 group-hover:text-gray-600 dark:text-zinc-600 dark:group-hover:text-zinc-300"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          className="mt-8 overflow-hidden rounded-2xl border-2 border-dashed border-gray-300/90 bg-zinc-50/90 shadow-[0_1px_0_rgba(0,0,0,0.03),0_6px_24px_-12px_rgba(0,0,0,0.08)] dark:border-zinc-700/80 dark:bg-zinc-900/90 dark:shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_6px_24px_-12px_rgba(0,0,0,0.45)]"
          aria-label="More surveys"
        >
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-stretch sm:gap-6 sm:p-6 md:p-8">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl sm:max-w-xs sm:shrink-0">
              <img
                src={UPCOMING.image}
                alt=""
                className="h-full w-full object-cover !outline-none ring-1 ring-black/10 dark:ring-white/10"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 ring-1 ring-black/5 dark:bg-zinc-950/40 dark:ring-white/10">
                <span className="text-sm font-bold tracking-[0.2em] text-gray-700 dark:text-zinc-200">Soon</span>
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <h2 className="text-balance text-xl font-bold text-gray-900 dark:text-zinc-100">{UPCOMING.title}</h2>
              <p className="mt-2 text-pretty text-sm font-normal leading-relaxed text-gray-600 dark:text-zinc-400">
                {UPCOMING.tagline}
              </p>
              <Link
                to="/app/surveys"
                className="mt-5 inline-flex min-h-[44px] w-fit items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm transition-[background-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:border-gray-300 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 active:scale-[0.96] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
              >
                <Bell className="h-4 w-4 shrink-0" aria-hidden />
                View app surveys
              </Link>
              <p className="mt-2 text-xs text-gray-500 dark:text-zinc-500">Create an account or sign in to participate.</p>
            </div>
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Link
            to="/app/surveys"
            className="group flex items-center gap-5 rounded-2xl border border-gray-200/90 bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.12)] active:scale-[0.995] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.4)]"
          >
            <div className="h-24 w-32 shrink-0 overflow-hidden rounded-xl">
              <img
                src={STOCK_IMAGES.newestSurvey}
                alt=""
                className="h-full w-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 dark:text-zinc-100">Newest activity</p>
              <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">See what opened most recently in the app.</p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition-[background-color,transform] duration-200 group-hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:group-hover:bg-white">
              <ArrowRight className="h-5 w-5" aria-hidden />
            </span>
          </Link>
          <Link
            to="/catalog"
            className="group flex items-center gap-5 rounded-2xl border border-gray-200/90 bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.12)] active:scale-[0.995] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.4)]"
          >
            <div className="h-24 w-32 shrink-0 overflow-hidden rounded-xl">
              <img
                src={STOCK_IMAGES.activityCard}
                alt=""
                className="h-full w-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 dark:text-zinc-100">Explore conversations</p>
              <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">Jump to the video library while you are here.</p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition-[background-color,transform] duration-200 group-hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:group-hover:bg-white">
              <ArrowRight className="h-5 w-5" aria-hidden />
            </span>
          </Link>
        </section>
      </div>
    </div>
  );
}
