import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Presentation, ClipboardList, PlayCircle, X } from 'lucide-react';
import { format, isPast, startOfWeek, endOfWeek } from 'date-fns';
import { webinarsApi, type WebinarItem } from '../api/webinars';
import { catalogApi, type MediaHubClip, type MediaHubTags, type CatalogItem } from '../api/catalog';
import { getShortClipId, getMediaHubThumbnail } from '../utils/clipUrl';
import { clipDisplaySummary } from '../utils/mediaHubClipText';
import { ConversationRow, StripCard, StripRowLoading } from '../components/home/ConversationRow';

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
    title: 'Surveys',
    desc: 'Complete short voice surveys after eligible sessions.',
    icon: ClipboardList,
    to: '/app/surveys',
  },
  {
    title: 'Conversations',
    desc: 'Watch short clips and playlists from the catalog.',
    icon: PlayCircle,
    to: '/app/catalog',
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

function getLatestWebinar(webinars: WebinarItem[]): WebinarItem | null {
  if (!webinars.length) return null;
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const thisWeek = webinars.filter((w) => {
    if (!w.startTime) return false;
    const d = new Date(w.startTime);
    return d >= weekStart && d <= weekEnd;
  });
  if (thisWeek.length > 0) {
    return thisWeek.sort((a, b) => (new Date(b.startTime!).getTime() - new Date(a.startTime!).getTime()))[0];
  }
  const sorted = [...webinars].sort((a, b) => {
    const aTime = a.startTime ? new Date(a.startTime).getTime() : 0;
    const bTime = b.startTime ? new Date(b.startTime).getTime() : 0;
    return bTime - aTime;
  });
  return sorted[0];
}

function clipMetaString(c: MediaHubClip, kind: 'recent' | 'views'): string {
  const summary = clipDisplaySummary(c);
  if (summary) return summary;
  if (kind === 'views' && c.view_count != null) {
    return `${c.view_count.toLocaleString()} views`;
  }
  return c.doctors?.[0] ?? '';
}

const CLIP_LIMIT = 14;

export default function Dashboard() {
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

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

  const { data: viewsData, isLoading: viewsLoading } = useQuery({
    queryKey: ['catalog', 'clips', 'dashboard', 'views'],
    queryFn: () => catalogApi.getClips({ limit: CLIP_LIMIT, sort_by: 'views' }),
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

  const latestWebinar = useMemo(() => getLatestWebinar(webinars), [webinars]);
  const recentItems = recentData?.items ?? [];
  const viewsItems = viewsData?.items ?? [];
  const topicItems = topicData?.items ?? [];
  const playlistStrip = (playlists as CatalogItem[]).slice(0, 10);

  const isLoading =
    webinarsLoading || (useMediaHub && (recentLoading || viewsLoading || playlistsLoading || (!!topicTag && topicLoading)));
  const featuredPanel = useMemo(() => {
    if (recentItems.length > 0) {
      const c = recentItems[0];
      return {
        eyebrow: 'Featured conversation',
        title: c.title,
        description: clipMetaString(c, 'recent') || 'Watch this newly released clinical conversation.',
        imageUrl: getMediaHubThumbnail(c),
        primaryHref: `/app/clip/${getShortClipId(c.id)}`,
        secondaryHref: '/app/catalog',
        primaryCta: 'Play',
        secondaryCta: 'Explore more',
      };
    }
    if (latestWebinar) {
      return {
        eyebrow: 'Featured live session',
        title: latestWebinar.title,
        description:
          latestWebinar.description ||
          'Join the latest medical education session and review practical treatment insights.',
        imageUrl: latestWebinar.imageUrl || WEBINAR_PLACEHOLDER_IMAGES[0],
        primaryHref: latestWebinar.id ? `/app/live/${latestWebinar.id}` : '/app/live',
        secondaryHref: '/app/live',
        primaryCta: 'Play',
        secondaryCta: 'Explore more',
      };
    }
    return {
      eyebrow: 'Featured',
      title: 'Latest CHM updates and releases',
      description: 'Catch newly released conversations, upcoming Live sessions, and fresh podcast drops in one place.',
      imageUrl: WEBINAR_PLACEHOLDER_IMAGES[0],
      primaryHref: '/app/catalog',
      secondaryHref: '/app/catalog',
      primaryCta: 'Play',
      secondaryCta: 'Explore more',
    };
  }, [latestWebinar, recentItems]);

  const releaseCarouselItems = useMemo(() => {
    const items: { href: string; title: string; imageUrl: string; meta?: string }[] = [];

    webinars
      .slice(0, 4)
      .forEach((w, i) =>
        items.push({
          href: w.id ? `/app/live/${w.id}` : '/app/live',
          title: w.title,
          imageUrl: w.imageUrl || WEBINAR_PLACEHOLDER_IMAGES[i % WEBINAR_PLACEHOLDER_IMAGES.length],
          meta: w.startTime
            ? `${isPast(new Date(w.startTime)) ? 'Past' : 'Upcoming'} · ${format(new Date(w.startTime), 'MMM d')}`
            : 'Live session',
        }),
      );

    const podcastThumb = '/images/iStock-1869998948-a6d5f1f2-fc95-4c9b-a1b6-b579bd7b6758.png';
    items.push(
      {
        href: '/app/podcasts',
        title: 'Breast Friends · New episode',
        imageUrl: podcastThumb,
        meta: 'Podcast release',
      },
      {
        href: '/app/podcasts',
        title: 'More podcast series coming soon',
        imageUrl: '/images/iStock-1917170353-5564763c-6ced-49b2-93ff-6a2261700399.png',
        meta: 'Podcast update',
      },
    );

    recentItems.slice(0, 4).forEach((c) =>
      items.push({
        href: `/app/clip/${getShortClipId(c.id)}`,
        title: c.title,
        imageUrl: getMediaHubThumbnail(c),
        meta: 'Conversation release',
      }),
    );

    return items.slice(0, 12);
  }, [recentItems, webinars]);

  return (
    <div className="space-y-8 md:space-y-10">
      {isOnboardingOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-3xl rounded-2xl border border-white/60 bg-white p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.4)] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.2,0,0,1)] sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-brand-600">New here?</p>
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {QUICK_START_ACTIONS.map((item) => (
                <Link
                  key={item.title}
                  to={item.to}
                  onClick={closeOnboarding}
                  className="group rounded-xl border border-zinc-200/90 bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_26px_-18px_rgba(0,0,0,0.18)] transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:border-zinc-300 hover:shadow-[0_2px_0_rgba(0,0,0,0.05),0_16px_30px_-16px_rgba(0,0,0,0.22)] active:scale-[0.96]"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <item.icon className="h-4 w-4 text-brand-600" aria-hidden />
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
                className="inline-flex min-h-[40px] min-w-[44px] items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-zinc-800 active:scale-[0.96]"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="-mx-4 -mt-4 overflow-hidden rounded-none bg-zinc-900 shadow-[0_1px_0_rgba(0,0,0,0.06),0_20px_50px_-24px_rgba(0,0,0,0.35)] sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-mt-8">
          <div className="relative h-[min(60vh,580px)] min-h-[320px] w-full sm:min-h-[360px]">
            <img
              src={featuredPanel.imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center"
              loading="eager"
              referrerPolicy="no-referrer"
              draggable={false}
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 w-[60%] bg-gradient-to-r from-black/55 via-black/20 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[85%] bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
            <div className="relative z-10 flex h-full max-w-[640px] flex-col justify-end px-4 pb-8 pt-20 sm:px-6 sm:pb-10 md:px-10 md:pt-24">
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-300">{featuredPanel.eyebrow}</p>
              <h2 className="mb-2 max-w-[18ch] text-balance font-sans text-[24px] font-extrabold leading-[1.08] tracking-[-0.02em] text-white md:text-[32px]">
                {featuredPanel.title}
              </h2>
              <p className="mb-4 line-clamp-2 max-w-[540px] text-pretty text-sm leading-relaxed text-white/80 md:text-[15px]">
                {featuredPanel.description}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to={featuredPanel.primaryHref}
                  className="hero-play-btn inline-flex h-11 min-w-[44px] items-center justify-center gap-2 rounded-md bg-white px-5 text-sm font-semibold text-zinc-900 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset] transition-[background-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-white/95 active:scale-[0.96]"
                >
                  <PlayCircle className="h-4 w-4" aria-hidden />
                  {featuredPanel.primaryCta}
                </Link>
                <Link
                  to={featuredPanel.secondaryHref}
                  className="inline-flex h-11 min-w-[44px] items-center justify-center gap-2 rounded-md bg-brand-600 px-5 text-sm font-semibold text-white shadow-[0_1px_0_0_rgba(255,255,255,0.12)_inset,0_8px_24px_-10px_rgba(43,168,154,0.45)] transition-[background-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-brand-700 active:scale-[0.96]"
                >
                  {featuredPanel.secondaryCta}
                </Link>
              </div>
            </div>
          </div>
        </section>

      {releaseCarouselItems.length > 0 ? (
        <section className="relative -top-[10px] space-y-4">
          <ConversationRow
            title="New releases"
            subtitle={`${releaseCarouselItems.length} items`}
            seeAllHref="/app/live"
            seeAllLabel="View all releases"
          >
            {releaseCarouselItems.map((item, i) => (
              <StripCard
                key={`${item.href}-${i}`}
                to={item.href}
                title={item.title}
                imageUrl={item.imageUrl}
                meta={item.meta}
              />
            ))}
          </ConversationRow>
        </section>
      ) : null}

      {useMediaHub ? (
        <div className="space-y-10">
          {isLoading ? (
            <ConversationRow title="Loading catalog" seeAllHref="/app/catalog">
              <StripRowLoading />
            </ConversationRow>
          ) : (
            <>
              {recentItems.length > 0 ? (
                <ConversationRow
                  title="Recently added"
                  subtitle={`${recentItems.length} videos`}
                  seeAllHref="/app/catalog"
                >
                  {recentItems.map((c) => (
                    <StripCard
                      key={c.id}
                      to={`/app/clip/${getShortClipId(c.id)}`}
                      title={c.title}
                      imageUrl={getMediaHubThumbnail(c)}
                      meta={clipMetaString(c, 'recent')}
                    />
                  ))}
                </ConversationRow>
              ) : null}

              {viewsItems.length > 0 ? (
                <ConversationRow
                  title="Popular"
                  subtitle={`${viewsItems.length} videos`}
                  seeAllHref="/app/catalog"
                >
                  {viewsItems.map((c) => (
                    <StripCard
                      key={c.id}
                      to={`/app/clip/${getShortClipId(c.id)}`}
                      title={c.title}
                      imageUrl={getMediaHubThumbnail(c)}
                      meta={clipMetaString(c, 'views')}
                    />
                  ))}
                </ConversationRow>
              ) : null}

              {topicTag && topicItems.length > 0 ? (
                <ConversationRow
                  title={topicLabel ? `Clips · ${topicLabel}` : 'Clips by tag'}
                  subtitle={`${topicItems.length} videos`}
                  seeAllHref={`/app/catalog?tag=${encodeURIComponent(topicTag)}`}
                >
                  {topicItems.map((c) => (
                    <StripCard
                      key={c.id}
                      to={`/app/clip/${getShortClipId(c.id)}`}
                      title={c.title}
                      imageUrl={getMediaHubThumbnail(c)}
                      meta={clipMetaString(c, 'recent')}
                    />
                  ))}
                </ConversationRow>
              ) : null}

              {playlistStrip.length > 0 ? (
                <ConversationRow
                  title="Playlists"
                  subtitle={`${playlistStrip.length} playlists`}
                  seeAllHref="/app/catalog?view=playlists"
                  seeAllLabel="See all playlists"
                >
                  {playlistStrip.map((p) => (
                    <StripCard
                      key={p.id}
                      to={`/app/catalog/playlist/${p.id}`}
                      title={p.title}
                      imageUrl={p.thumbnailUrl || 'https://via.placeholder.com/400x260?text=Playlist'}
                      meta={
                        p.videoCount != null
                          ? `${p.videoCount.toLocaleString()} video${p.videoCount !== 1 ? 's' : ''}`
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
            <div className="min-w-0 flex-1 rounded-2xl border border-dashed border-zinc-200/90 bg-zinc-50/80 px-4 py-8 text-center shadow-[inset_0_0_0_1px_rgba(0,0,0,0.03)]">
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
                meta={
                  w.startTime
                    ? `${isPast(new Date(w.startTime)) ? 'Past' : 'Upcoming'} · ${format(new Date(w.startTime), 'MMM d, yyyy')}`
                    : 'Medical education'
                }
              />
            ))
          )}
        </ConversationRow>
      </section>
    </div>
  );
}
