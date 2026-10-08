import { Link } from 'react-router-dom';
import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Presentation,
  ClipboardList,
  CalendarClock,
  CalendarDays,
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
import {
  LIVE_WEBINARS_QUERY_KEY,
  OFFICE_HOURS_QUERY_KEY,
  liveSessionListQueryOptions,
} from '../utils/live-session-list-query';
import { webinarsApi, type WebinarItem } from '../api/webinars';
import { surveysApi } from '../api/surveys';
import { dashboardApi } from '../api/dashboard';
import { useAuth } from '../contexts/AuthContext';
import { catalogApi, type ContentHubClip, type ContentHubTags, type CatalogItem } from '../api/catalog';
import { getShortClipId, getContentHubThumbnail, shouldSurfaceCatalogClip } from '../utils/clipUrl';
import { clipStripeSubtitle } from '../utils/contentHubClipText';
import { ConversationRow, StripCard, StripRowLoading } from '../components/home/ConversationRow';
import {
  APP_CATALOG_CLIPS_GRID,
  APP_CATALOG_CONVERSATIONS_HUB,
  APP_CATALOG_PLAYLISTS_BROWSE,
} from '../components/navigation/appNavItems';
import { BiomarkerConversationRow, BIOMARKER_CAROUSEL_IDS } from '../components/content/BiomarkerConversationRow';
import { CalendarClockArt, SurveyClipboardArt } from '../components/dashboard/EmptyStateArt';
import { PodcastNetworkRow } from '../components/dashboard/PodcastNetworkRow';
import { FeatureCarousel, type FeatureSlide } from '../components/home/FeatureCarousel';

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
    to: '/app/office-hours',
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

function flattenTags(tags: ContentHubTags): { value: string; label: string }[] {
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

function clipMetaString(c: ContentHubClip): string {
  return clipStripeSubtitle(c) || '';
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
 * The tall pending-surveys tile. A plain `.card` like the metrics, so the
 * four tiles read as one set; its content stacks from the top and the
 * empty-state drawing settles at the foot.
 */
const bentoPending =
  'card group relative flex min-h-[148px] flex-col overflow-hidden p-5 text-left active:scale-[0.995]';

export default function Dashboard() {
  // First visit opens the onboarding; read once, so the first paint is already right.
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(() => {
    try {
      return typeof window !== 'undefined' && !window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    } catch {
      return false;
    }
  });
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

  const closeOnboarding = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
    }
    setIsOnboardingOpen(false);
  };

  const { data: webinars = [], isLoading: webinarsLoading } = useQuery({
    queryKey: LIVE_WEBINARS_QUERY_KEY,
    queryFn: webinarsApi.list,
    ...liveSessionListQueryOptions,
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
  const surveys = useMemo(() => surveyList?.active ?? [], [surveyList]);

  const { data: officeHours = [], isLoading: officeHoursLoading } = useQuery({
    queryKey: OFFICE_HOURS_QUERY_KEY,
    queryFn: webinarsApi.listOfficeHours,
    ...liveSessionListQueryOptions,
  });

  const { data: tags = {} } = useQuery({
    queryKey: ['catalog', 'tags'],
    queryFn: catalogApi.getTags,
    staleTime: 10 * 60 * 1000,
  });

  const tagOptions = useMemo(() => flattenTags(tags), [tags]);
  const useContentHub = tagOptions.length > 0;
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
    enabled: useContentHub,
    staleTime: 2 * 60 * 1000,
  });

  const { data: topicData, isLoading: topicLoading } = useQuery({
    queryKey: ['catalog', 'clips', 'dashboard', 'topic', topicTag],
    queryFn: () =>
      catalogApi.getClips({ tag: topicTag!, limit: CLIP_LIMIT, sort_by: 'recent' }),
    enabled: useContentHub && !!topicTag,
    staleTime: 2 * 60 * 1000,
  });

  const { data: playlists = [], isLoading: playlistsLoading } = useQuery({
    queryKey: ['catalog', 'playlists'],
    queryFn: catalogApi.getPlaylists,
    enabled: useContentHub,
    staleTime: 10 * 60 * 1000,
  });

  const nextUpcomingWebinar = useMemo(() => getNextUpcomingWebinar(webinars), [webinars]);
  const nextLiveCoverUrl = nextUpcomingWebinar?.imageUrl?.trim() || undefined;
  const nextOfficeHoursSession = useMemo(() => getNextUpcomingWebinar(officeHours), [officeHours]);
  const requiredSurveysPending = useMemo(() => surveys.filter((s) => s.required), [surveys]);
  const recentItems = useMemo(() => recentData?.items ?? [], [recentData]);
  const topicItems = useMemo(() => topicData?.items ?? [], [topicData]);
  /** Catalog clips that have a usable thumb URL, omit placeholder-only rows on the dashboard. */
  const recentCatalogClips = useMemo(() => recentItems.filter((clip) => shouldSurfaceCatalogClip(clip)), [recentItems]);
  const topicCatalogClips = useMemo(() => topicItems.filter((clip) => shouldSurfaceCatalogClip(clip)), [topicItems]);

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
    webinarsLoading || (useContentHub && (recentLoading || playlistsLoading || (!!topicTag && topicLoading)));

  const spotlightSlides = useMemo((): FeatureSlide[] => {
    const slides: FeatureSlide[] = [];
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
        description: clipMetaString(c) || 'Watch this newly released clinical conversation.',
        imageUrl: getContentHubThumbnail(c),
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
        'Four shows from the CHM podcast network: Breast Friends, Cancer Unfiltered, Big C Energy and TeTalks.',
      imageUrl: podcastThumb,
      primaryHref: '/app/podcast-network',
      secondaryHref: '/app/podcast-network',
      primaryCta: 'Listen',
      primaryIcon: 'listen',
      imageFit: 'contain',
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
          ? `/app/office-hours/${nextOfficeHoursSession.id}`
          : '/app/office-hours',
        secondaryHref: '/app/office-hours',
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


  return (
    <div className="space-y-8 md:space-y-10">
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

      {/* The overview as the dashboard design lays it out: the next live
          session tall on the left, earnings and activity stacked in the middle,
          pending surveys tall on the right. Tiles sit on the plain shell
          ground, the way the public site sets its cards. */}
      <section className="space-y-4" aria-labelledby="app-dashboard-overview-heading">
        <div className="px-0.5">
          <p className="eyebrow text-anchor">Overview</p>
          <h2
            id="app-dashboard-overview-heading"
            className="display mt-1 text-display-s text-text md:text-display-m"
          >
            Your dashboard
          </h2>
          <p className="prose-lede mt-1.5 max-w-xl text-body-s text-muted2">
            Your next live session, earnings, activity, and the surveys you still need to complete.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)_minmax(0,1.25fr)] md:gap-4">
          <Link
            to={nextUpcomingWebinar?.id ? `/app/live/${nextUpcomingWebinar.id}` : '/app/live'}
            className={[
              'group relative col-span-2 flex min-h-[260px] flex-col overflow-hidden rounded-card p-5 text-left shadow-card transition-[transform,box-shadow] duration-200 hover:shadow-card-hover active:scale-[0.995] sm:p-6 md:col-span-1 md:col-start-1 md:row-span-2 md:row-start-1 md:min-h-[340px]',
              nextLiveCoverUrl ? '' : 'bg-surface',
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
            ) : null}
            <div className="relative z-10 flex items-start justify-between gap-3">
              {nextLiveCoverUrl ? (
                /* Over a poster scrim: a fixed-bright glass pill carrying the
                   fixed dark label rather than page-following tokens. */
                <span className="eyebrow inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-3 py-1.5 text-on-bright shadow-card backdrop-blur-md dark:border-white/25 dark:text-white">
                  <Radio className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Next LIVE
                </span>
              ) : (
                <span className="eyebrow inline-flex items-center gap-2 text-muted2">
                  <Radio className="h-3.5 w-3.5 shrink-0 text-anchor" aria-hidden />
                  Next LIVE
                </span>
              )}
              <ChevronRight
                className={[
                  'h-5 w-5 shrink-0 transition-[color,transform] duration-200 group-hover:translate-x-0.5',
                  nextLiveCoverUrl ? 'text-white/90 group-hover:text-white' : 'text-muted2 group-hover:text-anchor',
                ].join(' ')}
                aria-hidden
              />
            </div>
            {webinarsLoading ? (
              <div className="relative z-10 mt-auto pt-6">
                <p className="display text-body-l text-dim">Loading sessions…</p>
                <p className="mt-2 text-body-s text-muted2">Checking the schedule</p>
              </div>
            ) : nextUpcomingWebinar ? (
              <div className="relative z-10 mt-auto pt-6">
                <p
                  className={[
                    'display line-clamp-3 text-display-s',
                    nextLiveCoverUrl ? 'text-white' : 'text-text',
                  ].join(' ')}
                >
                  {nextUpcomingWebinar.title}
                </p>
                <p className={['meta mt-3', nextLiveCoverUrl ? 'text-white/90' : 'text-dim'].join(' ')}>
                  {nextUpcomingWebinar.startTime
                    ? format(new Date(nextUpcomingWebinar.startTime), 'EEE, MMM d · h:mm a')
                    : 'Scheduled session'}
                </p>
                <p
                  className={[
                    'eyebrow mt-4',
                    /* Over a poster this is a permanently dark strip, so it
                       takes the amber tuned for deep grounds. */
                    nextLiveCoverUrl ? 'text-amber-on-deep' : 'text-anchor',
                  ].join(' ')}
                >
                  Open session
                </p>
              </div>
            ) : (
              <div className="relative z-10 flex flex-1 flex-col items-center justify-center pt-2 text-center">
                <CalendarClockArt className="h-auto w-full max-w-[220px]" />
                <p className="display mt-3 text-body-l text-text">Nothing on the calendar yet</p>
                <p className="mt-1 max-w-[32ch] text-body-s text-muted2">
                  New live sessions show up here as soon as they're scheduled.
                </p>
                {/* The whole tile is the link; this only looks like a button. */}
                <span className="mt-4 inline-flex h-9 items-center gap-2 rounded-[8px] bg-surface px-3.5 text-body-s font-medium text-text ring-1 ring-hairline-strong transition-colors duration-150 group-hover:bg-surface-2">
                  <CalendarDays className="h-4 w-4" aria-hidden />
                  Browse the schedule
                </span>
              </div>
            )}
          </Link>

          <Link to="/app/earnings" className={`${bentoMetric} md:col-start-2 md:row-start-1`}>
            <div className="flex items-start justify-between gap-2">
              <span className="eyebrow inline-flex items-center gap-2 text-muted2">
                <Banknote className="h-3.5 w-3.5 shrink-0 text-anchor" aria-hidden />
                Earnings
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted2 transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-anchor" aria-hidden />
            </div>
            <div className="pt-5">
              <p className="display text-4xl tabular-nums text-text">
                {!userId ? '--' : earningsSummaryLoading ? '…' : `$${(earningsSummary?.totalEarnings ?? 0).toFixed(2)}`}
              </p>
              <p className="mt-1 text-body-s text-muted2">Total balance</p>
            </div>
          </Link>

          <Link to="/app/surveys" className={`${bentoMetric} md:col-start-2 md:row-start-2`}>
            <div className="flex items-start justify-between gap-2">
              <span className="eyebrow inline-flex items-center gap-2 text-muted2">
                <Activity className="h-3.5 w-3.5 shrink-0 text-anchor" aria-hidden />
                Activity
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted2 transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-anchor" aria-hidden />
            </div>
            <div className="pt-5">
              <p className="display text-4xl tabular-nums text-text">
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
            className={`${bentoPending} col-span-2 md:col-span-1 md:col-start-3 md:row-span-2 md:row-start-1`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="eyebrow inline-flex items-center gap-2 text-muted2">
                <ClipboardCheck className="h-3.5 w-3.5 shrink-0 text-anchor" aria-hidden />
                Pending actions
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted2 transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-anchor" aria-hidden />
            </div>
            <div className="mt-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="display text-body-l text-text">Required surveys</p>
                <p className="prose-lede mt-1 line-clamp-3 text-body-s text-muted2">
                  {surveysLoading
                    ? 'Loading survey queue…'
                    : requiredSurveysPending.length === 0
                      ? 'None right now. A survey appears here after you attend a live program.'
                      : requiredSurveysPending[0]?.title
                        ? `Next up: ${requiredSurveysPending[0].title}`
                        : 'Open Surveys to finish eligibility tasks.'}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-center rounded-[10px] bg-anchor/10 px-4 py-2.5">
                <p className="eyebrow text-anchor">Due</p>
                <p className="display text-3xl tabular-nums text-text">
                  {surveysLoading ? '…' : requiredSurveysPending.length.toLocaleString()}
                </p>
                <p className="meta text-center text-[10px] uppercase tracking-wide text-faint">required</p>
              </div>
            </div>
            {!surveysLoading && requiredSurveysPending.length === 0 ? (
              <SurveyClipboardArt className="mx-auto mt-auto h-auto w-full max-w-[200px] pt-5" />
            ) : null}
          </Link>
        </div>
      </section>

      <section className="w-full space-y-4" aria-label="Featured highlights">
        <div>
          <h2 className="display text-display-s text-text">Featured</h2>
          <p className="prose-lede mt-1.5 max-w-2xl text-body-s text-muted2">
            Highlights from the library and the schedule.
          </p>
        </div>
        <FeatureCarousel slides={spotlightSlidesRendered} label="Featured slides" onImageError={markCarouselThumbBroken} />
      </section>

      {/* Order after Featured: what's new, then playlists, then the podcast
          network, then the disease-area and topic rows. */}
      <div className="space-y-10">
        {useContentHub ? (
          isLoading ? (
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
                      playOverlay
                      onThumbnailError={() => markCarouselThumbBroken(`clip:${c.id}`)}
                      to={`/app/clip/${getShortClipId(c.id)}`}
                      title={c.title}
                      imageUrl={getContentHubThumbnail(c)}
                      description={clipMetaString(c)}
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
                      stacked
                      to={`/app/catalog/playlist/${p.id}`}
                      title={p.title}
                      imageUrl={p.thumbnailUrl || '/images/placeholder-playlist.svg'}
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
          )
        ) : (
          <p className="prose-lede text-body-s text-muted2">
            Clips and playlists load when the media catalog is connected. You can still open scheduled sessions and surveys below.
          </p>
        )}

        <PodcastNetworkRow />

        {useContentHub && !isLoading ? (
          <>
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
                    playOverlay
                    onThumbnailError={() => markCarouselThumbBroken(`clip:${c.id}`)}
                    to={`/app/clip/${getShortClipId(c.id)}`}
                    title={c.title}
                    imageUrl={getContentHubThumbnail(c)}
                    description={clipMetaString(c)}
                  />
                ))}
              </ConversationRow>
            ) : null}
          </>
        ) : null}
      </div>

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
          seeAllHref="/app/office-hours"
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
                to={w.id ? `/app/office-hours/${w.id}` : '/app/office-hours'}
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
