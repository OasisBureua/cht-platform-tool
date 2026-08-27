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
import { format } from 'date-fns';
import { isSessionExpired } from '../utils/live-session-timing';
import { webinarsApi, type WebinarItem } from '../api/webinars';
import { surveysApi } from '../api/surveys';
import { dashboardApi } from '../api/dashboard';
import { useAuth } from '../contexts/AuthContext';
import { catalogApi, type MediaHubClip, type MediaHubTags, type CatalogItem } from '../api/catalog';
import { getShortClipId, getMediaHubThumbnail, shouldSurfaceCatalogClip } from '../utils/clipUrl';
import { clipStripeSubtitle } from '../utils/mediaHubClipText';
import { ConversationRow, StripCard, StripRowLoading } from '../components/home/ConversationRow';
import {
  APP_CATALOG_CLIPS_GRID,
  APP_CATALOG_CONVERSATIONS_HUB,
  APP_CATALOG_PLAYLISTS_BROWSE,
} from '../components/navigation/appNavItems';
import { BiomarkerConversationRow, BIOMARKER_CAROUSEL_IDS } from '../components/content/BiomarkerConversationRow';

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
    desc: 'Drop in for live Q&A with experts. Book a slot and join.',
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

/**
 * Shared bento tile surface. `.card` carries the surface, the elevation
 * and the 2px hover lift, so the tile no longer hand-rolls an rgba
 * shadow per appearance.
 */
const bentoMetric =
  'card group relative flex min-h-[132px] flex-col justify-between overflow-hidden p-5 text-left active:scale-[0.995]';

/**
 * Same to-br three-stop wash as before, retuned off raw amber/zinc onto
 * the spectrum: warm coral corner → paper → the deeper paper step. The
 * gradient paints the surface, so this one keeps `shadow-card` by hand
 * rather than `.card`, whose flat background would cover the wash.
 */
const bentoPending =
  'group relative flex min-h-[148px] flex-col overflow-hidden rounded-card bg-gradient-to-br from-cerebral-coral/25 via-surface to-surface-2 p-5 text-left shadow-card transition-[box-shadow,translate] duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-0.5 hover:shadow-card-hover active:scale-[0.995]';

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

  const { data: surveyList, isLoading: surveysLoading } = useQuery({
    queryKey: ['surveys'],
    queryFn: surveysApi.getAll,
    staleTime: 5 * 60 * 1000,
  });
  const surveys = surveyList?.active ?? [];

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
  const nextLiveCoverUrl = nextUpcomingWebinar?.imageUrl?.trim() || undefined;
  const nextOfficeHoursSession = useMemo(() => getNextUpcomingWebinar(officeHours), [officeHours]);
  const requiredSurveysPending = useMemo(() => surveys.filter((s) => s.required), [surveys]);
  const recentItems = recentData?.items ?? [];
  const topicItems = topicData?.items ?? [];
  /** Catalog clips that have a usable thumb URL, omit placeholder-only rows on the dashboard. */
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
    const podcastThumb = '/images/podcasts/breast-friends/cover.png';

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
      title: 'CHM podcasts',
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
        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow text-anchor">New here?</p>
              <h2 className="display mt-1 text-display-s text-text">Pick a place to start</h2>
              <p className="prose-lede mt-1 text-body-s text-muted2">Choose one path and you can switch anytime.</p>
            </div>
            <button
              type="button"
              onClick={closeOnboarding}
              className="press inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-[6px] text-muted2 hover:bg-surface-2 hover:text-text"
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
                className="group rounded-card bg-surface-2 p-4 shadow-card transition-[transform,box-shadow,background-color] duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-0.5 hover:bg-surface hover:shadow-card-hover active:scale-[0.96]"
              >
                <div className="mb-2 flex items-center gap-2">
                  <item.icon className="h-4 w-4 text-anchor" aria-hidden />
                  <p className="display text-body-s text-text">{item.title}</p>
                </div>
                <p className="prose-lede text-body-s text-muted2">{item.desc}</p>
              </Link>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={closeOnboarding}
              className="press inline-flex min-h-[40px] min-w-[44px] items-center justify-center rounded-[6px] bg-cta px-4 text-body-s font-medium text-ground shadow-card hover:bg-cta-deep"
            >
              Continue
            </button>
          </div>
        </div>
      ) : null}

      {/* Same to-b three-stop band, now off the ground ramp: the tokens
          follow the appearance, so the dark overrides are gone. */}
      <section
        className="-mx-4 border-y border-hairline bg-gradient-to-b from-ground via-surface/90 to-surface-2/45 sm:-mx-6 lg:-mx-8"
        aria-labelledby="app-dashboard-overview-heading"
      >
        <div className="px-4 pb-6 pt-5 sm:px-6 sm:pb-8 sm:pt-6 lg:px-8">
          <div className="mb-5 px-0.5">
            <p className="eyebrow text-anchor">
              Overview
            </p>
            <h2
              id="app-dashboard-overview-heading"
              className="display mt-1 text-display-s text-text md:text-display-m"
            >
              Your dashboard
            </h2>
            <p className="prose-lede mt-1.5 max-w-xl text-body-s text-muted2">
              Next live session, earnings, activity, and surveys you still need to complete.
            </p>
          </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:grid-rows-2 md:gap-4">
          <Link
            to={nextUpcomingWebinar?.id ? `/app/live/${nextUpcomingWebinar.id}` : '/app/live'}
            className={[
              'group relative col-span-1 row-span-2 row-start-1 flex min-h-[200px] flex-col justify-between overflow-hidden rounded-card p-4 text-left transition-[transform,box-shadow] duration-200 active:scale-[0.995] sm:p-6 md:col-span-1 md:min-h-[300px]',
              nextLiveCoverUrl
                ? 'shadow-card hover:shadow-card-hover'
                : /* Same to-br three-stop wash, off the spectrum now:
                     cool blue corner → paper → warm coral corner. */
                  'bg-gradient-to-br from-cerebral-blue/20 via-surface to-cerebral-coral/25 shadow-card hover:shadow-card-hover',
            ].join(' ')}
          >
            {nextLiveCoverUrl ? (
              <>
                <img
                  src={nextLiveCoverUrl}
                  alt={nextUpcomingWebinar?.title ? `Cover for ${nextUpcomingWebinar.title}` : ''}
                  className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.02]"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
                <div className="pointer-events-none absolute inset-y-0 left-0 w-[58%] max-w-[320px] bg-gradient-to-r from-black/50 to-transparent" />
              </>
            ) : (
              <>
                <div className="pointer-events-none absolute -right-12 -top-10 h-40 w-40 rounded-full bg-cerebral-blue/20 blur-3xl dark:bg-cerebral-blue/15" />
                <div className="pointer-events-none absolute -bottom-10 left-4 h-32 w-32 rounded-full bg-cerebral-coral/35 blur-3xl dark:bg-cerebral-coral/15" />
              </>
            )}
            <div className="relative z-10 flex items-start justify-between gap-3">
              {/* The badge sits over a poster scrim as often as over the
                  wash, so it is a fixed-bright glass pill carrying the
                  fixed dark label rather than page-following tokens. */}
              <span className="eyebrow inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-3 py-1.5 text-on-bright shadow-card backdrop-blur-md">
                <Radio className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Next LIVE
              </span>
              <ChevronRight
                className={[
                  'h-5 w-5 shrink-0 transition-[color,transform] duration-200 group-hover:translate-x-0.5',
                  nextLiveCoverUrl
                    ? 'text-white/90 group-hover:text-white'
                    : 'text-anchor group-hover:text-cta',
                ].join(' ')}
                aria-hidden
              />
            </div>
            <div className="relative z-10 mt-4 flex flex-1 flex-col justify-end">
              {webinarsLoading ? (
                <>
                  <p className="display text-body-l text-dim">Loading sessions…</p>
                  <p className="mt-2 text-body-s text-muted2">Checking the schedule</p>
                </>
              ) : nextUpcomingWebinar ? (
                <>
                  <p
                    className={[
                      'display line-clamp-3 text-display-s',
                      nextLiveCoverUrl ? 'text-white' : 'text-text',
                    ].join(' ')}
                  >
                    {nextUpcomingWebinar.title}
                  </p>
                  <p
                    className={[
                      'meta mt-3',
                      nextLiveCoverUrl ? 'text-white/90' : 'text-dim',
                    ].join(' ')}
                  >
                    {nextUpcomingWebinar.startTime
                      ? format(new Date(nextUpcomingWebinar.startTime), 'EEE, MMM d · h:mm a')
                      : 'Scheduled session'}
                  </p>
                  <p
                    className={[
                      'eyebrow mt-4',
                      /* Over a poster this is a permanently dark strip, so
                         it takes the amber tuned for deep grounds. */
                      nextLiveCoverUrl ? 'text-amber-on-deep' : 'text-anchor',
                    ].join(' ')}
                  >
                    Tap to open session
                  </p>
                </>
              ) : (
                <>
                  <p className="display text-display-s text-text">Nothing on the calendar</p>
                  <p className="mt-2 text-body-s text-muted2">
                    Browse the full schedule for new drops.
                  </p>
                </>
              )}
            </div>
          </Link>

          <Link to="/app/earnings" className={`${bentoMetric} col-start-2 row-start-1 md:col-start-2 md:row-start-1`}>
            <div className="flex items-start justify-between gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-[6px] text-anchor">
                <Banknote className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted2 transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-anchor" aria-hidden />
            </div>
            <div>
              <p className="eyebrow text-muted2">Earnings</p>
              <p className="display mt-3 text-3xl tabular-nums text-text">
                {!userId ? '--' : earningsSummaryLoading ? '…' : `$${(earningsSummary?.totalEarnings ?? 0).toFixed(2)}`}
              </p>
              <p className="mt-1 text-body-s text-muted2">Total balance</p>
            </div>
          </Link>

          <Link to="/app/surveys" className={`${bentoMetric} col-start-2 row-start-2 md:col-start-3 md:row-start-1`}>
            <div className="flex items-start justify-between gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-[6px] text-anchor">
                <Activity className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted2 transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-anchor" aria-hidden />
            </div>
            <div>
              <p className="eyebrow text-muted2">Activity</p>
              <p className="display mt-3 text-3xl tabular-nums text-text">
                {!userId ? '--' : activityStatsLoading ? '…' : (activityStats?.activitiesCompleted ?? 0).toLocaleString()}
              </p>
              <p className="mt-1 text-body-s text-muted2">
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
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] text-ink-coral">
                      <ClipboardCheck className="h-5 w-5" strokeWidth={2} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="eyebrow text-muted2">Pending actions</p>
                      <p className="display mt-0.5 text-body-l text-text">Required surveys</p>
                    </div>
                  </div>
                  <ChevronRight
                    className="h-5 w-5 shrink-0 text-muted2 transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-ink-coral"
                    aria-hidden
                  />
                </div>
                <p className="prose-lede mt-2 line-clamp-2 text-body-s text-muted2 sm:mt-3">
                  {surveysLoading
                    ? 'Loading survey queue…'
                    : requiredSurveysPending.length === 0
                      ? 'No post-session surveys are required right now. Check Surveys after you attend a live program.'
                      : requiredSurveysPending[0]?.title
                        ? `Next up: ${requiredSurveysPending[0].title}`
                        : 'Open Surveys to finish eligibility tasks.'}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-center justify-center rounded-card bg-cerebral-coral/20 px-5 py-4 shadow-card">
                <p className="eyebrow text-ink-coral">Due</p>
                <p className="display mt-1 text-3xl tabular-nums text-text">
                  {surveysLoading ? '…' : requiredSurveysPending.length.toLocaleString()}
                </p>
                <p className="meta mt-0.5 text-center text-[10px] uppercase tracking-wide text-faint">
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
          <h2 className="display text-display-s text-text">Featured</h2>
          <p className="prose-lede mt-1.5 max-w-2xl text-body-s text-muted2">
            Swipe the card or use the dots to rotate highlights.
          </p>
        </div>

        <div className="relative isolate">
          {featuredSlideCount > 0 ? (
            <>
              <div
                className="overflow-hidden rounded-card bg-surface shadow-card"
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
                  {spotlightSlidesRendered.map((slide) => {
                    const isPodcastSpotlight = slide.id === 'podcast-episodes';
                    return (
                    <div
                      key={slide.id}
                      className="relative shrink-0"
                      style={{ width: `${100 / featuredSlideCount}%` }}
                    >
                      <div
                        className={[
                          'relative w-full',
                          isPodcastSpotlight
                            ? 'h-[min(62.4vh,480px)] min-h-[336px] bg-surface sm:min-h-[384px]'
                            : 'h-[min(52vh,400px)] min-h-[280px] sm:min-h-[320px]',
                        ].join(' ')}
                      >
                        <img
                          src={slide.imageUrl}
                          alt=""
                          data-thumb-track={slide.thumbTrackKey ?? undefined}
                          className={[
                            'absolute inset-0 h-full w-full',
                            isPodcastSpotlight
                              ? 'box-border object-contain object-center p-2 sm:p-3'
                              : 'object-cover object-center',
                          ].join(' ')}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          draggable={false}
                          onError={slide.thumbTrackKey ? onSpotlightThumbError : undefined}
                        />
                        <div className="pointer-events-none absolute inset-y-0 left-0 w-[55%] bg-gradient-to-r from-black/55 via-black/20 to-transparent" />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[82%] bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                        <div className="relative z-10 flex h-full flex-col justify-end p-5 text-white sm:p-7 md:p-8">
                          {/* Permanently dark: over the scrim the eyebrow
                              takes the amber tuned for deep grounds and the
                              copy stays fixed white. */}
                          <p className="eyebrow mb-2 text-amber-on-deep">
                            {slide.eyebrow}
                          </p>
                          <h3 className="display mb-2 max-w-[20ch] text-display-s text-white md:text-display-m">
                            {slide.title}
                          </h3>
                          <p className="prose-lede mb-4 line-clamp-3 max-w-lg text-body-s text-white/90 md:text-body-m">
                            {slide.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-3">
                            <Link
                              to={slide.primaryHref}
                              /* Fixed white, written as an arbitrary value so
                                 the global `.dark .bg-white` remap cannot
                                 flip it to near-black on this dark scrim. */
                              className="press inline-flex h-11 min-w-[44px] items-center justify-center gap-2 rounded-[6px] bg-[#ffffff] px-5 text-body-s font-medium text-on-bright shadow-card transition-[filter,scale] hover:brightness-95"
                            >
                              <PlayCircle className="h-4 w-4" aria-hidden />
                              {slide.primaryCta}
                            </Link>
                            <Link
                              to={slide.secondaryHref}
                              className="press inline-flex h-11 min-w-[44px] items-center justify-center gap-2 rounded-[6px] bg-cta px-5 text-body-s font-medium text-ground shadow-card hover:bg-cta-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            >
                              {slide.secondaryCta}
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })}
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
                          i === spotlightIndex ? 'w-8 bg-cta' : 'w-2 bg-faint/40',
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

              {BIOMARKER_CAROUSEL_IDS.map((carouselId) => (
                <BiomarkerConversationRow
                  key={carouselId}
                  carouselId={carouselId}
                  isInApp={true}
                  hideBrokenCatalogThumbnails
                />
              ))}

              {topicTag && topicCatalogForHome.length > 0 ? (
                <ConversationRow
                  title={topicLabel ? `Clips · ${topicLabel}` : 'Clips by tag'}
                  subtitle={`${topicCatalogForHome.length} videos`}
                  seeAllHref={`${APP_CATALOG_CLIPS_GRID}&tag=${encodeURIComponent(topicTag)}`}
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
                  seeAllHref={APP_CATALOG_PLAYLISTS_BROWSE}
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
          <p className="prose-lede text-body-s text-muted2">
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
            <div className="min-w-0 flex-1 rounded-card bg-surface-2 px-4 py-8 text-center shadow-card">
              <p className="display text-body-s text-text">No sessions listed yet</p>
              <p className="prose-lede mt-1 text-body-s text-muted2">We post new times here when they are ready.</p>
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
                    ? `${isSessionExpired(w.startTime, w.duration) ? 'Past' : 'Upcoming'} · ${format(new Date(w.startTime), 'MMM d, yyyy')}`
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
            <div className="min-w-0 flex-1 rounded-card bg-surface-2 px-4 py-8 text-center shadow-card">
              <p className="display text-body-s text-text">No office hours scheduled yet</p>
              <p className="prose-lede mt-1 text-body-s text-muted2">When sessions are published, they will appear here.</p>
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
                    ? `${isSessionExpired(w.startTime, w.duration) ? 'Past' : 'Upcoming'} · ${format(new Date(w.startTime), 'MMM d, yyyy')}`
                    : 'Office Hours'
                }
              />
            ))
          )}
        </ConversationRow>
      </section>
    </div>
  );
}
