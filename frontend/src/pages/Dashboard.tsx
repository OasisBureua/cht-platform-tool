import { Link } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState, type ImgHTMLAttributes } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Presentation,
  ClipboardList,
  CalendarClock,
  PlayCircle,
  X,
  Banknote,
  Radio,
  ChevronRight,
  Activity,
  ClipboardCheck,
} from 'lucide-react';
import { format, isPast } from 'date-fns';
import { webinarsApi, type WebinarItem } from '../api/webinars';
import { surveysApi } from '../api/surveys';
import { dashboardApi } from '../api/dashboard';
import { useAuth } from '../contexts/AuthContext';
import { catalogApi, type MediaHubClip, type MediaHubTags, type CatalogItem } from '../api/catalog';
import { getShortClipId, getMediaHubThumbnail, shouldSurfaceCatalogClip } from '../utils/clipUrl';
import { clipStripeSubtitle } from '../utils/mediaHubClipText';
import { ConversationRow, StripCard, StripRowLoading } from '../components/home/ConversationRow';
import { APP_CATALOG_CLIPS_GRID, APP_CATALOG_CONVERSATIONS_HUB, APP_CATALOG_PLAYLISTS_BROWSE } from '../components/navigation/appNavItems';
import { BiomarkerConversationRow, BIOMARKER_ROWS } from '../components/content/BiomarkerConversationRow';

const WEBINAR_PLACEHOLDER_IMAGES = [
  '/images/iStock-1473559425-01131144-01b5-4e7d-9b15-f3db8846cad3.png',
  '/images/iStock-1667819272-cc7e9fde-feb0-4590-bb35-f5a86deba0dd.png',
  '/images/iStock-1917170353-5564763c-6ced-49b2-93ff-6a2261700399.png',
  '/images/iStock-1938555104-3986b580-5ef8-4aae-989f-05a2edd0bc12.png',
  '/images/iStock-2036497889-fae3ed6e-9859-4983-b3ec-7a489bb6fb95.png',
  '/images/iStock-1344792109-f418c5f0-d729-4965-8b2a-bfff4368cea3.png',
];

const ONBOARDING_STORAGE_KEY = 'chm-home-onboarding-seen-v1';
const QUICK_START_ACTIONS = [
  {
    title: 'Live sessions',
    desc: 'Attend live education sessions and earn for participation.',
    icon: Presentation,
    to: '/app/live',
  },
  {
    title: 'CHM Office Hours',
    desc: 'Drop in for interactive Q&A with experts—book a slot and join.',
    icon: CalendarClock,
    to: '/app/chm-office-hours',
  },
  {
    title: 'Surveys',
    desc: 'Complete short voice surveys after eligible sessions.',
    icon: ClipboardList,
    to: '/app/surveys',
  },
  {
    title: 'Conversations',
    desc: 'Watch short clips and playlists from the catalog.',
    icon: PlayCircle,
    to: APP_CATALOG_CONVERSATIONS_HUB,
  },
];

function flattenTags(tags: MediaHubTags): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const [, values] of Object.entries(tags)) {
    if (!Array.isArray(values)) continue;
    for (const v of values) {
      if (v && !seen.has(v)) {
        seen.add(v);
        out.push({ value: v, label: v });
      }
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

function findTagValue(options: { value: string; label: string }[], needles: string[]): string | undefined {
  for (const n of needles) {
    const nl = n.toLowerCase();
    const hit = options.find(
      (o) => o.value.toLowerCase().includes(nl) || o.label.toLowerCase().includes(nl)
    );
    if (hit) return hit.value;
  }
  return undefined;
}

function getNextUpcomingWebinar(webinars: WebinarItem[]): WebinarItem | null {
  const now = Date.now();
  const upcoming = webinars.filter((w) => w.startTime && new Date(w.startTime).getTime() > now);
  if (!upcoming.length) return null;
  return upcoming.sort(
    (a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime(),
  )[0];
}

function clipMetaString(c: MediaHubClip, kind: 'recent' | 'views'): string {
  const stripe = clipStripeSubtitle(c);
  if (stripe) return stripe;
  if (kind === 'views' && c.view_count != null) {
    return `${c.view_count.toLocaleString()} views`;
  }
  return '';
}

const CLIP_LIMIT = 14;

/** Shared bento tile surface */
const bentoMetric =
  'group relative flex min-h-[132px] flex-col justify-between overflow-hidden rounded-2xl bg-white p-5 text-left shadow-[0_8px_36px_-24px_rgba(0,0,0,0.12)] transition-[box-shadow,transform] duration-200 hover:shadow-[0_14px_44px_-26px_rgba(234,88,12,0.2)] active:scale-[0.995] dark:bg-zinc-900 dark:shadow-[0_10px_40px_-28px_rgba(0,0,0,0.55)] dark:hover:shadow-[0_16px_48px_-28px_rgba(234,88,12,0.12)]';

const bentoPending =
  'group relative flex min-h-[148px] flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50/90 via-white to-zinc-50 p-5 text-left shadow-[0_8px_36px_-24px_rgba(0,0,0,0.1)] transition-[box-shadow,transform] duration-200 hover:shadow-[0_14px_44px_-26px_rgba(245,158,11,0.18)] active:scale-[0.995] dark:from-amber-950/20 dark:via-zinc-900 dark:to-zinc-950 dark:shadow-[0_10px_40px_-28px_rgba(0,0,0,0.5)] dark:hover:shadow-[0_16px_48px_-28px_rgba(245,158,11,0.08)]';

type SpotlightSlide = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  imageUrl: string;
  primaryHref: string;
  secondaryHref: string;
  primaryCta: string;
  secondaryCta: string;
  /** When set, thumbnail load failure hides this promotional frame (see `thumbTrackKey`). */
  thumbTrackKey?: string;
};

export default function Dashboard() {
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [brokenCarouselThumbIds, setBrokenCarouselThumbIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const { user } = useAuth();
  const userId = user?.userId ?? '';

  const markCarouselThumbBroken = useCallback((key: string) => {
    setBrokenCarouselThumbIds((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!seen) setIsOnboardingOpen(true);
  }, []);

  const closeOnboarding = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
    }
    setIsOnboardingOpen(false);
  };

  const { data: webinars = [], isLoading: webinarsLoading } = useQuery({
    queryKey: ['webinars'],
    queryFn: webinarsApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const { data: earningsSummary, isLoading: earningsSummaryLoading } = useQuery({
    queryKey: ['earnings', userId],
    queryFn: () => dashboardApi.getEarnings(userId),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  const { data: activityStats, isLoading: activityStatsLoading } = useQuery({
    queryKey: ['dashboard', 'stats', userId],
    queryFn: () => dashboardApi.getStats(userId),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  const { data: surveys = [], isLoading: surveysLoading } = useQuery({
    queryKey: ['surveys'],
    queryFn: surveysApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const { data: officeHours = [], isLoading: officeHoursLoading } = useQuery({
    queryKey: ['office-hours'],
    queryFn: webinarsApi.listOfficeHours,
    staleTime: 5 * 60 * 1000,
  });

  const { data: tags = {} } = useQuery({
    queryKey: ['catalog', 'tags'],
    queryFn: catalogApi.getTags,
    staleTime: 10 * 60 * 1000,
  });

  const tagOptions = useMemo(() => flattenTags(tags), [tags]);
  const useMediaHub = tagOptions.length > 0;
  const topicTag = useMemo(
    () => findTagValue(tagOptions, ['her2', 'tnbc', 'cdk4', 'breast', 'egfr']),
    [tagOptions]
  );
  const topicLabel = useMemo(() => {
    if (!topicTag) return '';
    const o = tagOptions.find((t) => t.value === topicTag);
    return o?.label ?? topicTag;
  }, [topicTag, tagOptions]);

  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: ['catalog', 'clips', 'dashboard', 'recent'],
    queryFn: () => catalogApi.getClips({ limit: CLIP_LIMIT, sort_by: 'recent' }),
    enabled: useMediaHub,
    staleTime: 2 * 60 * 1000,
  });

  const { data: topicData, isLoading: topicLoading } = useQuery({
    queryKey: ['catalog', 'clips', 'dashboard', 'topic', topicTag],
    queryFn: () =>
      catalogApi.getClips({ tag: topicTag!, limit: CLIP_LIMIT, sort_by: 'recent' }),
    enabled: useMediaHub && !!topicTag,
    staleTime: 2 * 60 * 1000,
  });

  const { data: playlists = [], isLoading: playlistsLoading } = useQuery({
    queryKey: ['catalog', 'playlists'],
    queryFn: catalogApi.getPlaylists,
    enabled: useMediaHub,
    staleTime: 10 * 60 * 1000,
  });

  const nextUpcomingWebinar = useMemo(() => getNextUpcomingWebinar(webinars), [webinars]);
  const nextOfficeHoursSession = useMemo(() => getNextUpcomingWebinar(officeHours), [officeHours]);
  const requiredSurveysPending = useMemo(() => surveys.filter((s) => s.required), [surveys]);
  const recentItems = recentData?.items ?? [];
  const topicItems = topicData?.items ?? [];
  /** Catalog clips that have a usable thumb URL — omit placeholder-only rows on the dashboard. */
  const recentCatalogClips = useMemo(() => recentItems.filter(shouldSurfaceCatalogClip), [recentItems]);
  const topicCatalogClips = useMemo(() => topicItems.filter(shouldSurfaceCatalogClip), [topicItems]);

  /** After runtime image failures, omit cards so blanks do not stay in strip / spotlight. */
  const recentCatalogForHome = useMemo(
    () => recentCatalogClips.filter((c) => !brokenCarouselThumbIds.has(`clip:${c.id}`)),
    [recentCatalogClips, brokenCarouselThumbIds],
  );
  const topicCatalogForHome = useMemo(
    () => topicCatalogClips.filter((c) => !brokenCarouselThumbIds.has(`clip:${c.id}`)),
    [topicCatalogClips, brokenCarouselThumbIds],
  );

  const playlistStrip = (playlists as CatalogItem[]).slice(0, 10);

  const isLoading =
    webinarsLoading || (useMediaHub && (recentLoading || playlistsLoading || (!!topicTag && topicLoading)));

  const spotlightSlides = useMemo((): SpotlightSlide[] => {
    const slides: SpotlightSlide[] = [];
    const podcastThumb = '/images/iStock-1869998948-a6d5f1f2-fc95-4c9b-a1b6-b579bd7b6758.png';

    /** Prefer a catalog clip whose thumbnail resolves; omit broken / placeholder clips. */
    const featuredConversation = recentCatalogForHome[0];

    /** Always include a conversation slide so the carousel can advance past podcasts. */
    if (featuredConversation) {
      const c = featuredConversation;
      slides.push({
        id: 'featured-conversation',
        eyebrow: 'Featured conversation',
        title: c.title,
        description: clipMetaString(c, 'recent') || 'Watch this newly released clinical conversation.',
        imageUrl: getMediaHubThumbnail(c),
        thumbTrackKey: `clip:${c.id}`,
        primaryHref: `/app/clip/${getShortClipId(c.id)}`,
        secondaryHref: APP_CATALOG_CLIPS_GRID,
        primaryCta: 'Play',
        secondaryCta: 'Browse catalog',
      });
    } else {
      slides.push({
        id: 'featured-conversation-catalog',
        eyebrow: 'Featured conversation',
        title: 'Clinical clips and playlists',
        description:
          'Browse short expert-led videos, disease-area playlists, and new catalog releases in one place.',
        imageUrl: WEBINAR_PLACEHOLDER_IMAGES[4],
        primaryHref: APP_CATALOG_CLIPS_GRID,
        secondaryHref: APP_CATALOG_PLAYLISTS_BROWSE,
        primaryCta: 'Browse catalog',
        secondaryCta: 'Playlists',
      });
    }

    slides.push({
      id: 'podcast-episodes',
      eyebrow: 'New podcast episodes',
      title: 'Breast Friends & CHM audio',
      description:
        'Browse short expert-led videos, disease-area playlists, and new catalog releases in one place.',
      imageUrl: podcastThumb,
      primaryHref: '/app/podcasts',
      secondaryHref: '/app/podcasts',
      primaryCta: 'Listen',
      secondaryCta: 'All podcasts',
    });

    if (nextOfficeHoursSession) {
      slides.push({
        id: 'office-hours',
        eyebrow: 'Upcoming Office Hours',
        title: nextOfficeHoursSession.title,
        description:
          (nextOfficeHoursSession.description && nextOfficeHoursSession.description.slice(0, 180)) ||
          'Reserve a time and join live Q&A with our clinical team.',
        imageUrl: nextOfficeHoursSession.imageUrl || WEBINAR_PLACEHOLDER_IMAGES[2],
        primaryHref: nextOfficeHoursSession.id
          ? `/app/chm-office-hours/${nextOfficeHoursSession.id}`
          : '/app/chm-office-hours',
        secondaryHref: '/app/chm-office-hours',
        primaryCta: 'View session',
        secondaryCta: 'Full schedule',
      });
    }

    return slides;
  }, [recentCatalogForHome, nextOfficeHoursSession]);

  /** Slides omitted when featured catalog image fails to load (fallback catalog slide). */
  const spotlightSlidesRendered = useMemo(() => {
    return spotlightSlides.filter((s) =>
      !s.thumbTrackKey || !brokenCarouselThumbIds.has(s.thumbTrackKey),
    );
  }, [spotlightSlides, brokenCarouselThumbIds]);

  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const goSpotlightPrev = useCallback(() => {
    setSpotlightIndex((i) => {
      const n = spotlightSlidesRendered.length;
      if (n <= 0) return 0;
      return (i - 1 + n) % n;
    });
  }, [spotlightSlidesRendered.length]);

  const goSpotlightNext = useCallback(() => {
    setSpotlightIndex((i) => {
      const n = spotlightSlidesRendered.length;
      if (n <= 0) return 0;
      return (i + 1) % n;
    });
  }, [spotlightSlidesRendered.length]);

  const spotlightIdKey = useMemo(
    () => spotlightSlidesRendered.map((s) => s.id).join('|'),
    [spotlightSlidesRendered],
  );

  const featuredSlideCount = spotlightSlidesRendered.length;

  useEffect(() => {
    setSpotlightIndex(0);
  }, [spotlightIdKey]);

  useEffect(() => {
    setSpotlightIndex((i) =>
      featuredSlideCount === 0 ? 0 : Math.min(i, Math.max(0, featuredSlideCount - 1)),
    );
  }, [featuredSlideCount]);

  useEffect(() => {
    if (spotlightSlidesRendered.length <= 1) return undefined;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }
    const t = window.setInterval(goSpotlightNext, 8000);
    return () => window.clearInterval(t);
  }, [spotlightSlidesRendered.length, goSpotlightNext]);

  const onSpotlightThumbError = useCallback<NonNullable<ImgHTMLAttributes<HTMLImageElement>['onError']>>(
    (e) => {
      const key = e.currentTarget.getAttribute('data-thumb-track');
      if (key) markCarouselThumbBroken(key);
    },
    [markCarouselThumbBroken],
  );

  return (
    <div className="-mt-4 space-y-8 sm:-mt-5 md:-mt-6 md:space-y-10 lg:-mt-8">
      {isOnboardingOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.45)] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.2,0,0,1)] sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#c2410c] dark:text-[#fdba74]">New here?</p>
                <h2 className="mt-1 text-xl font-black tracking-[-0.02em] text-zinc-900">Pick a place to start</h2>
                <p className="mt-1 text-sm text-zinc-600">Choose one path and you can switch anytime.</p>
              </div>
              <button
                type="button"
                onClick={closeOnboarding}
                className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-zinc-500 transition-[color,background-color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.96]"
                aria-label="Close onboarding"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {QUICK_START_ACTIONS.map((item) => (
                <Link
                  key={item.title}
                  to={item.to}
                  onClick={closeOnboarding}
                  className="group rounded-xl bg-white p-4 shadow-[0_10px_40px_-22px_rgba(0,0,0,0.2)] transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:shadow-[0_16px_48px_-24px_rgba(0,0,0,0.28)] active:scale-[0.96]"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <item.icon className="h-4 w-4 text-[#ea580c] dark:text-[#fb923c]" aria-hidden />
                    <p className="text-sm font-bold text-zinc-900">{item.title}</p>
                  </div>
                  <p className="text-sm leading-relaxed text-zinc-600">{item.desc}</p>
                </Link>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={closeOnboarding}
                className="inline-flex min-h-[40px] min-w-[44px] items-center justify-center rounded-md bg-orange-600 px-4 text-sm font-semibold text-white transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-orange-700 active:scale-[0.96]"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section
        className="-mx-4 border-y border-zinc-200/35 bg-gradient-to-b from-white via-zinc-50/95 to-zinc-100/35 dark:border-zinc-800/60 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-950 sm:-mx-6 lg:-mx-8"
        aria-labelledby="app-dashboard-overview-heading"
      >
        <div className="px-4 pb-6 pt-5 sm:px-6 sm:pb-8 sm:pt-6 lg:px-8">
          <div className="mb-5 px-0.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#c2410c] dark:text-[#fdba74]">Overview</p>
            <h2
              id="app-dashboard-overview-heading"
              className="mt-1 text-xl font-bold tracking-tight text-gray-900 dark:text-zinc-100 md:text-2xl"
            >
              Your dashboard
            </h2>
            <p className="mt-1.5 max-w-xl text-pretty text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Next live session, earnings, activity, and surveys you still need to complete.
            </p>
          </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:grid-rows-2 md:gap-4">
          <Link
            to={nextUpcomingWebinar?.id ? `/app/live/${nextUpcomingWebinar.id}` : '/app/live'}
            className="group relative col-span-1 row-span-2 row-start-1 flex min-h-[200px] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-orange-100/95 via-white to-amber-50/90 p-4 text-left shadow-[0_20px_56px_-30px_rgba(234,88,12,0.2)] transition-[transform,box-shadow] duration-200 hover:shadow-[0_28px_64px_-30px_rgba(234,88,12,0.28)] active:scale-[0.995] sm:p-6 md:col-span-1 md:min-h-[300px] dark:from-zinc-900 dark:via-orange-950/30 dark:to-zinc-950 dark:shadow-[0_22px_52px_-32px_rgba(0,0,0,0.65)]"
          >
            <div className="pointer-events-none absolute -right-12 -top-10 h-40 w-40 rounded-full bg-orange-400/30 blur-3xl dark:bg-orange-500/12" />
            <div className="pointer-events-none absolute -bottom-10 left-4 h-32 w-32 rounded-full bg-amber-300/35 blur-3xl dark:bg-orange-600/10" />
            <div className="relative z-10 flex items-start justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-orange-100/95 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.15em] text-orange-950 shadow-[0_2px_12px_-4px_rgba(234,88,12,0.28)] dark:bg-orange-950/75 dark:text-orange-50">
                <Radio className="h-3.5 w-3.5" aria-hidden />
                Next LIVE
              </span>
              <ChevronRight
                className="h-5 w-5 shrink-0 text-[#ea580c] transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:text-[#c2410c] dark:text-[#fb923c] dark:group-hover:text-[#fdba74]"
                aria-hidden
              />
            </div>
            <div className="relative z-10 mt-4 flex flex-1 flex-col justify-end">
              {webinarsLoading ? (
                <>
                  <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-200">Loading sessions…</p>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Checking the schedule</p>
                </>
              ) : nextUpcomingWebinar ? (
                <>
                  <p className="line-clamp-3 text-xl font-bold leading-snug tracking-tight text-zinc-900 dark:text-white">
                    {nextUpcomingWebinar.title}
                  </p>
                  <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {nextUpcomingWebinar.startTime
                      ? format(new Date(nextUpcomingWebinar.startTime), 'EEE, MMM d · h:mm a')
                      : 'Scheduled session'}
                  </p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#c2410c] dark:text-[#fdba74]">
                    Tap to open session
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xl font-bold text-zinc-900 dark:text-white">Nothing on the calendar</p>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    Browse the full schedule for new drops.
                  </p>
                </>
              )}
            </div>
          </Link>

          <Link to="/app/earnings" className={`${bentoMetric} col-start-2 row-start-1 md:col-start-2 md:row-start-1`}>
            <div className="flex items-start justify-between gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl text-[#c2410c] dark:text-[#fdba74]">
                <Banknote className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" aria-hidden />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Earnings</p>
              <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-100">
                {!userId ? '--' : earningsSummaryLoading ? '…' : `$${(earningsSummary?.totalEarnings ?? 0).toFixed(2)}`}
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Total balance</p>
            </div>
          </Link>

          <Link to="/app/surveys" className={`${bentoMetric} col-start-2 row-start-2 md:col-start-3 md:row-start-1`}>
            <div className="flex items-start justify-between gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl text-[#c2410c] dark:text-[#fdba74]">
                <Activity className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" aria-hidden />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Activity</p>
              <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-100">
                {!userId ? '--' : activityStatsLoading ? '…' : (activityStats?.activitiesCompleted ?? 0).toLocaleString()}
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {!userId
                  ? 'Sign in to track progress'
                  : activityStatsLoading
                    ? 'Loading'
                    : `${(activityStats?.surveysCompleted ?? 0).toLocaleString()} surveys · ${(activityStats?.cmeCreditsEarned ?? 0).toLocaleString()} CME`}
              </p>
            </div>
          </Link>

          <Link
            to={requiredSurveysPending[0] ? `/app/surveys/${requiredSurveysPending[0].id}` : '/app/surveys'}
            className={`${bentoPending} col-span-2 col-start-1 row-start-3 md:col-span-2 md:col-start-2 md:row-start-2`}
          >
            <div className="flex w-full min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-amber-800 dark:text-amber-200">
                      <ClipboardCheck className="h-5 w-5" strokeWidth={2} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Pending actions</p>
                      <p className="mt-0.5 text-lg font-bold text-zinc-900 dark:text-zinc-100">Required surveys</p>
                    </div>
                  </div>
                  <ChevronRight
                    className="h-5 w-5 shrink-0 text-zinc-400 transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
                    aria-hidden
                  />
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 sm:mt-3">
                  {surveysLoading
                    ? 'Loading survey queue…'
                    : requiredSurveysPending.length === 0
                      ? 'No post-session surveys are required right now. Check Surveys after you attend a live program.'
                      : requiredSurveysPending[0]?.title
                        ? `Next up: ${requiredSurveysPending[0].title}`
                        : 'Open Surveys to finish eligibility tasks.'}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-center justify-center rounded-2xl bg-white/90 px-5 py-4 shadow-[0_8px_28px_-20px_rgba(245,158,11,0.2)] dark:bg-zinc-900/80">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-800 dark:text-amber-300">Due</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {surveysLoading ? '…' : requiredSurveysPending.length.toLocaleString()}
                </p>
                <p className="mt-0.5 text-center text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  required
                </p>
              </div>
            </div>
          </Link>
        </div>
        </div>
      </section>

      <section className="w-full space-y-4" aria-label="Featured highlights">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-xl">Featured</h2>
          <p className="mt-1.5 max-w-2xl text-pretty text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Swipe the card or use the dots to rotate highlights.
          </p>
        </div>

        <div className="relative isolate">
          {featuredSlideCount > 0 ? (
            <>
              <div
                className="overflow-hidden rounded-2xl bg-orange-600 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.35)]"
                onTouchStart={(e) => {
                  touchStartX.current = e.touches[0].clientX;
                }}
                onTouchEnd={(e) => {
                  if (touchStartX.current == null || featuredSlideCount <= 1) {
                    touchStartX.current = null;
                    return;
                  }
                  const dx = e.changedTouches[0].clientX - touchStartX.current;
                  touchStartX.current = null;
                  if (dx > 60) goSpotlightPrev();
                  else if (dx < -60) goSpotlightNext();
                }}
              >
                <div
                  className="flex transition-transform duration-500 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none"
                  style={{
                    width: `${featuredSlideCount * 100}%`,
                    transform:
                      featuredSlideCount <= 1
                        ? 'translateX(0)'
                        : `translateX(-${(spotlightIndex / featuredSlideCount) * 100}%)`,
                  }}
                >
                  {spotlightSlidesRendered.map((slide) => (
                    <div
                      key={slide.id}
                      className="relative shrink-0"
                      style={{ width: `${100 / featuredSlideCount}%` }}
                    >
                      <div className="relative h-[min(52vh,400px)] min-h-[280px] w-full sm:min-h-[320px]">
                        <img
                          src={slide.imageUrl}
                          alt=""
                          data-thumb-track={slide.thumbTrackKey ?? undefined}
                          className="absolute inset-0 h-full w-full object-cover object-center"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          draggable={false}
                          onError={slide.thumbTrackKey ? onSpotlightThumbError : undefined}
                        />
                        <div className="pointer-events-none absolute inset-y-0 left-0 w-[55%] bg-gradient-to-r from-black/55 via-black/18 to-transparent" />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[82%] bg-gradient-to-t from-black/78 via-black/30 to-transparent" />
                        <div className="relative z-10 flex h-full flex-col justify-end p-5 text-white sm:p-7 md:p-8">
                          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#fdba74]">
                            {slide.eyebrow}
                          </p>
                          <h3 className="mb-2 max-w-[20ch] text-balance font-sans text-[22px] font-extrabold leading-[1.08] tracking-[-0.02em] text-white sm:text-[28px]">
                            {slide.title}
                          </h3>
                          <p className="mb-4 line-clamp-3 max-w-lg text-pretty text-sm leading-relaxed text-white/90 md:text-[15px]">
                            {slide.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-3">
                            <Link
                              to={slide.primaryHref}
                              className="inline-flex h-11 min-w-[44px] items-center justify-center gap-2 rounded-md bg-white px-5 text-sm font-semibold text-zinc-900 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset] transition-[background-color,transform] duration-200 hover:bg-white/95 active:scale-[0.96]"
                            >
                              <PlayCircle className="h-4 w-4" aria-hidden />
                              {slide.primaryCta}
                            </Link>
                            <Link
                              to={slide.secondaryHref}
                              className="inline-flex h-11 min-w-[44px] items-center justify-center gap-2 rounded-md bg-orange-600 px-5 text-sm font-semibold text-white shadow-[0_1px_0_0_rgba(255,255,255,0.12)_inset,0_8px_24px_-10px_rgba(234,88,12,0.45)] transition-[background-color,transform] duration-200 hover:bg-orange-700 active:scale-[0.96]"
                            >
                              {slide.secondaryCta}
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {featuredSlideCount > 1 ? (
                  <div
                    className="mt-4 flex flex-wrap items-center justify-center gap-2"
                    role="tablist"
                    aria-label="Featured slides"
                  >
                    {spotlightSlidesRendered.map((s, i) => (
                      <button
                        key={s.id}
                        type="button"
                        role="tab"
                        aria-selected={i === spotlightIndex}
                        aria-label={`Show ${s.eyebrow}: ${s.title}`}
                        onClick={() => setSpotlightIndex(i)}
                        className={[
                          'h-2 rounded-full transition-[width,background-color] duration-300',
                          i === spotlightIndex ? 'w-8 bg-orange-500' : 'w-2 bg-zinc-300 dark:bg-zinc-600',
                        ].join(' ')}
                      />
                    ))}
                  </div>
              ) : null}
            </>
          ) : null}
        </div>
      </section>

      {useMediaHub ? (
        <div className="space-y-10">
          {isLoading ? (
            <ConversationRow title="Loading catalog" seeAllHref={APP_CATALOG_CLIPS_GRID}>
              <StripRowLoading />
            </ConversationRow>
          ) : (
            <>
              {recentCatalogForHome.length > 0 ? (
                <ConversationRow
                  title="Recently added"
                  subtitle={`${recentCatalogForHome.length} videos`}
                  seeAllHref={APP_CATALOG_CLIPS_GRID}
                >
                  {recentCatalogForHome.map((c) => (
                    <StripCard
                      key={c.id}
                      hideThumbnailOnError
                      onThumbnailError={() => markCarouselThumbBroken(`clip:${c.id}`)}
                      to={`/app/clip/${getShortClipId(c.id)}`}
                      title={c.title}
                      imageUrl={getMediaHubThumbnail(c)}
                      description={clipMetaString(c, 'recent')}
                    />
                  ))}
                </ConversationRow>
              ) : null}

              {BIOMARKER_ROWS.map((row) => (
                <BiomarkerConversationRow
                  key={row.focus}
                  label={row.label}
                  focus={row.focus}
                  isInApp={true}
                  hideBrokenCatalogThumbnails
                />
              ))}

              {topicTag && topicCatalogForHome.length > 0 ? (
                <ConversationRow
                  title={topicLabel ? `Clips · ${topicLabel}` : 'Clips by tag'}
                  subtitle={`${topicCatalogForHome.length} videos`}
                  seeAllHref={`${APP_CATALOG_CLIPS_GRID}?tag=${encodeURIComponent(topicTag)}`}
                >
                  {topicCatalogForHome.map((c) => (
                    <StripCard
                      key={c.id}
                      hideThumbnailOnError
                      onThumbnailError={() => markCarouselThumbBroken(`clip:${c.id}`)}
                      to={`/app/clip/${getShortClipId(c.id)}`}
                      title={c.title}
                      imageUrl={getMediaHubThumbnail(c)}
                      description={clipMetaString(c, 'recent')}
                    />
                  ))}
                </ConversationRow>
              ) : null}

              {playlistStrip.length > 0 ? (
                <ConversationRow
                  title="Playlists"
                  subtitle={`${playlistStrip.length} playlists`}
                  seeAllHref="/app/search"
                  seeAllLabel="See all playlists"
                >
                  {playlistStrip.map((p) => (
                    <StripCard
                      key={p.id}
                      hideThumbnailOnError
                      to={`/app/catalog/playlist/${p.id}`}
                      title={p.title}
                      imageUrl={p.thumbnailUrl || 'https://via.placeholder.com/400x260?text=Playlist'}
                      description={p.videoNames?.[0]?.trim() || 'Curated playlist'}
                      videoLabel={
                        p.videoCount != null && p.videoCount > 0
                          ? `${p.videoCount.toLocaleString()} video${p.videoCount !== 1 ? 's' : ''}`
                          : p.videoNames && p.videoNames.length > 0
                            ? `${p.videoNames.length} video${p.videoNames.length !== 1 ? 's' : ''}`
                            : undefined
                      }
                    />
                  ))}
                </ConversationRow>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-pretty text-sm text-zinc-600">
            Clips and playlists load when the media catalog is connected. You can still open scheduled sessions and surveys below.
          </p>
        </div>
      )}

      <section className="space-y-4">
        <ConversationRow
          title="Live sessions"
          subtitle={webinarsLoading ? 'Loading' : `${webinars.length} listed`}
          seeAllHref="/app/live"
          seeAllLabel="Full schedule"
        >
          {webinarsLoading ? (
            <StripRowLoading />
          ) : webinars.length === 0 ? (
            <div className="min-w-0 flex-1 rounded-2xl border border-dashed border-zinc-200/55 bg-zinc-50/80 px-4 py-8 text-center shadow-[0_4px_24px_-16px_rgba(0,0,0,0.06)]">
              <p className="text-sm font-medium text-zinc-800">No sessions listed yet</p>
              <p className="mt-1 text-pretty text-sm text-zinc-600">We post new times here when they are ready.</p>
            </div>
          ) : (
            webinars.slice(0, 12).map((w, i) => (
              <StripCard
                key={w.id}
                to={w.id ? `/app/live/${w.id}` : '/app/live'}
                title={w.title}
                imageUrl={w.imageUrl || WEBINAR_PLACEHOLDER_IMAGES[i % WEBINAR_PLACEHOLDER_IMAGES.length]}
                description={
                  w.startTime
                    ? `${isPast(new Date(w.startTime)) ? 'Past' : 'Upcoming'} · ${format(new Date(w.startTime), 'MMM d, yyyy')}`
                    : 'Medical education'
                }
              />
            ))
          )}
        </ConversationRow>
      </section>

      <section className="space-y-4">
        <ConversationRow
          title="CHM Office Hours"
          subtitle={officeHoursLoading ? 'Loading' : `${officeHours.length} listed`}
          seeAllHref="/app/chm-office-hours"
          seeAllLabel="Full schedule"
        >
          {officeHoursLoading ? (
            <StripRowLoading />
          ) : officeHours.length === 0 ? (
            <div className="min-w-0 flex-1 rounded-2xl border border-dashed border-zinc-200/90 bg-zinc-50/80 px-4 py-8 text-center shadow-[inset_0_0_0_1px_rgba(0,0,0,0.03)]">
              <p className="text-sm font-medium text-zinc-800">No office hours scheduled yet</p>
              <p className="mt-1 text-pretty text-sm text-zinc-600">When sessions are published, they will appear here.</p>
            </div>
          ) : (
            officeHours.slice(0, 12).map((w, i) => (
              <StripCard
                key={w.id}
                to={w.id ? `/app/chm-office-hours/${w.id}` : '/app/chm-office-hours'}
                title={w.title}
                imageUrl={w.imageUrl || WEBINAR_PLACEHOLDER_IMAGES[i % WEBINAR_PLACEHOLDER_IMAGES.length]}
                description={
                  w.startTime
                    ? `${isPast(new Date(w.startTime)) ? 'Past' : 'Upcoming'} · ${format(new Date(w.startTime), 'MMM d, yyyy')}`
                    : 'Interactive Q&A'
                }
              />
            ))
          )}
        </ConversationRow>
      </section>
    </div>
  );
}
