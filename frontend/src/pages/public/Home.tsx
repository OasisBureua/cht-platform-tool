import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Monitor, Headphones, FileText, Video, Clock, CalendarClock, LayoutGrid, Loader2 } from 'lucide-react';
import { catalogApi, type CatalogItem } from '../../api/catalog';
import { getShortClipId } from '../../utils/clipUrl';
import { ConversationRow, StripCard, StripRowLoadingThumbnails } from '../../components/home/ConversationRow';
import DISEASE_AREAS from '../../data/disease-areas';
import { APP_CATALOG_PLAYLIST_SECTIONS } from '../../data/catalogPlaylistRows';
import {
  buildCatalogSectionPlaylistsHref,
  filterPlaylistsByFocus,
  CATALOG_SECTION_TO_FOCUS,
  VIEW_PLAYLIST_LABEL,
} from '../../utils/playlistFocusFilters';
import { useFlattenedPlaylistVideos } from '../../hooks/useFlattenedPlaylistVideos';

const resourceImages: Record<string, string> = {
  webinars: '/images/resource-webinars.png',
  protocols: '/images/resource-protocols.png',
  clinicals: '/images/resource-clinicals.png',
  watch: '/images/resource-watch.png',
  reporting: '/images/resource-reporting.png',
  data: '/images/resource-data.png',
  search: '/images/resource-search.png',
};


type FeaturedVideo = {
  id: string;
  title: string;
  imageUrl: string;
  youtubeUrl?: string;
};

type Treatment = {
  id: string;
  title: string;
  imageUrl: string;
  slug: string;
  videoNames: string[];
  /** From YouTube `itemCount`; may exceed length of `videoNames` preview. */
  videoCount: number;
  playlistUrl: string;
};

type Resource = {
  id: string;
  title: string;
  href: string;
  icon: ReactNode;
  imageUrl: string;
};

function catalogToTreatment(p: CatalogItem): Treatment {
  const thumb = p.thumbnailUrl || 'https://via.placeholder.com/400x225?text=Playlist';
  const previewNames = p.videoNames || [];
  const count = p.videoCount ?? previewNames.length;
  return {
    id: p.id,
    title: p.title,
    imageUrl: thumb,
    slug: p.id,
    videoNames: previewNames,
    videoCount: count > 0 ? count : previewNames.length,
    playlistUrl: `/catalog/playlist/${p.id}`,
  };
}

function playlistRowSubtitle(focus: 'her2' | 'hr', treatments: Treatment[], usingFallback: boolean): string {
  if (!usingFallback && treatments.length > 0) {
    const total = treatments.reduce((s, t) => s + Math.max(0, t.videoCount), 0);
    if (total > 0) return `${total} video${total === 1 ? '' : 's'}`;
  }

  const section = APP_CATALOG_PLAYLIST_SECTIONS.find((s) => CATALOG_SECTION_TO_FOCUS[s.label] === focus);
  if (!section) return '';

  /** HR-style rows often have "9 videos · …" on each strip item — sum those for a static fallback total. */
  let hintedSum = 0;
  let hintedCount = 0;
  for (const item of section.items) {
    const m = item.speakers?.match(/^(\d+)\s*videos?\b/i);
    if (m) {
      hintedSum += parseInt(m[1], 10);
      hintedCount += 1;
    }
  }
  if (hintedCount > 0) return `${hintedSum} video${hintedSum === 1 ? '' : 's'}`;

  return section.subtitle?.trim() ?? '';
}

function playlistMetaLabel(videoCount: number, videoNamesSample: number): string {
  if (videoCount > 0) {
    const n = videoCount;
    return `${n} video${n === 1 ? '' : 's'}`;
  }
  if (videoNamesSample > 0) return `${videoNamesSample} video${videoNamesSample === 1 ? '' : 's'}`;
  return 'Playlist';
}

const FALLBACK_HER2: Treatment[] = [
  {
    id: 'bp1',
    title: 'HER2+ Big Picture & Practice Change',
    slug: 'her2-big-picture',
    imageUrl:
      'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
    videoNames: ['Video Name', 'Video Name', 'Video Name', 'Video Name'],
    videoCount: 4,
    playlistUrl: '/catalog?view=playlists&playlistFocus=her2',
  },
  {
    id: 'bp2',
    title: 'First-Line & Sequencing Decisions',
    slug: 'first-line-sequencing',
    imageUrl:
      'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=800&q=80',
    videoNames: ['Video Name', 'Video Name', 'Video Name', 'Video Name'],
    videoCount: 4,
    playlistUrl: '/catalog?view=playlists&playlistFocus=her2',
  },
  {
    id: 'bp3',
    title: 'High-Risk & CNS Disease',
    slug: 'high-risk-cns',
    imageUrl: 'https://images.unsplash.com/photo-1551190822-a9333d879b1f?auto=format&fit=crop&w=800&q=80',
    videoNames: ['Video Name', 'Video Name', 'Video Name', 'Video Name'],
    videoCount: 4,
    playlistUrl: '/catalog?view=playlists&playlistFocus=her2',
  },
];

const FALLBACK_HR: Treatment[] = [
  {
    id: 'hr1',
    title: 'HR+ Big Picture & Practice Change',
    slug: 'hr-big-picture',
    imageUrl:
      'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80',
    videoNames: ['Video Name', 'Video Name', 'Video Name', 'Video Name'],
    videoCount: 4,
    playlistUrl: '/catalog?view=playlists&playlistFocus=hr',
  },
  {
    id: 'hr2',
    title: 'First-Line & Sequencing Decisions',
    slug: 'hr-first-line-sequencing',
    imageUrl:
      'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80',
    videoNames: ['Video Name', 'Video Name', 'Video Name', 'Video Name'],
    videoCount: 4,
    playlistUrl: '/catalog?view=playlists&playlistFocus=hr',
  },
  {
    id: 'hr3',
    title: 'High-Risk & CNS Disease',
    slug: 'hr-high-risk-cns',
    imageUrl:
      'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?auto=format&fit=crop&w=800&q=80',
    videoNames: ['Video Name', 'Video Name', 'Video Name', 'Video Name'],
    videoCount: 4,
    playlistUrl: '/catalog?view=playlists&playlistFocus=hr',
  },
];

/** Shown when `/catalog/random-videos` returns [] (e.g. YouTube not configured) so the carousel is never blank */
const FALLBACK_FEATURED: FeaturedVideo[] = [
  {
    id: 'home-placeholder-1',
    title: 'Browse clinical conversations in the library',
    imageUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80',
    youtubeUrl: undefined,
  },
  {
    id: 'home-placeholder-2',
    title: 'Expert-led education across therapeutic areas',
    imageUrl: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=800&q=80',
    youtubeUrl: undefined,
  },
  {
    id: 'home-placeholder-3',
    title: 'Webinars, protocols, and patient resources',
    imageUrl: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=800&q=80',
    youtubeUrl: undefined,
  },
];

/** Staggered landing animation delays (ms) - paired with `.home-enter` in `index.css` */
const HOME_STAGGER_MS = {
  heroTitle: 0,
  heroLead: 90,
  heroCtas: 180,
  featHeading: 260,
  featCarousel: 340,
  disease: 420,
  biomarkerHead: 500,
  biomarkerBody: 580,
  hrHead: 680,
  hrBody: 760,
  about: 840,
  whoWe: 920,
  resourcesHead: 1000,
  resourcesGrid: 1080,
  faqHead: 1160,
  faqBody: 1240,
  closingHead: 1320,
  closingCta: 1400,
} as const;

/** Max horizontally scrolled video tiles per biomarker strip (full list lives on catalogue). */
const HOME_STRIP_VIDEO_CAP = 40;

export default function Home() {
  const { data: playlistsData, isLoading: playlistsLoading } = useQuery({
    queryKey: ['catalog', 'playlists'],
    queryFn: catalogApi.getPlaylists,
    staleTime: 5 * 60 * 1000,
  });
  const playlists = Array.isArray(playlistsData) ? playlistsData : [];

  const { data: randomVideosData, isLoading: randomVideosLoading } = useQuery({
    queryKey: ['catalog', 'random-videos'],
    queryFn: () => catalogApi.getRandomVideos(6),
    staleTime: 5 * 60 * 1000,
  });
  const randomVideos = Array.isArray(randomVideosData) ? randomVideosData : [];

  const her2PlaylistStrip = useMemo(() => {
    if (playlists.length === 0) return { treatments: FALLBACK_HER2, fallback: true };
    const her2 = filterPlaylistsByFocus(playlists, 'her2');
    return her2.length > 0
      ? { treatments: her2.map(catalogToTreatment), fallback: false }
      : { treatments: FALLBACK_HER2, fallback: true };
  }, [playlists]);

  const hrPlaylistStrip = useMemo(() => {
    if (playlists.length === 0) return { treatments: FALLBACK_HR, fallback: true };
    const hr = filterPlaylistsByFocus(playlists, 'hr');
    return hr.length > 0 ? { treatments: hr.map(catalogToTreatment), fallback: false } : { treatments: FALLBACK_HR, fallback: true };
  }, [playlists]);

  const biomarkerPlaylists = her2PlaylistStrip.treatments;
  const hrPlusPlaylists = hrPlaylistStrip.treatments;

  const her2StripSubtitle = useMemo(
    () =>
      playlistRowSubtitle('her2', her2PlaylistStrip.treatments, her2PlaylistStrip.fallback),
    [her2PlaylistStrip],
  );

  const hrStripSubtitle = useMemo(
    () => playlistRowSubtitle('hr', hrPlaylistStrip.treatments, hrPlaylistStrip.fallback),
    [hrPlaylistStrip],
  );

  /** YouTube playlist ids for stripping — used to hydrate individual videos on the carousel. */
  const her2PlaylistIds = useMemo(
    () => (her2PlaylistStrip.fallback ? [] : her2PlaylistStrip.treatments.map((t) => t.id)),
    [her2PlaylistStrip],
  );
  const hrPlaylistIds = useMemo(
    () => (hrPlaylistStrip.fallback ? [] : hrPlaylistStrip.treatments.map((t) => t.id)),
    [hrPlaylistStrip],
  );

  const her2FlattenedVideos = useFlattenedPlaylistVideos(her2PlaylistIds, her2PlaylistIds.length > 0);
  const hrFlattenedVideos = useFlattenedPlaylistVideos(hrPlaylistIds, hrPlaylistIds.length > 0);

  const featuredVideos: FeaturedVideo[] = useMemo(() => {
    const mapped = randomVideos.map((v) => ({
      id: v.id,
      title: v.title,
      imageUrl: v.thumbnailUrl || `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`,
      youtubeUrl: v.youtubeUrl,
    }));
    if (mapped.length > 0) return mapped;
    return randomVideosLoading ? [] : FALLBACK_FEATURED;
  }, [randomVideos, randomVideosLoading]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const resources: Resource[] = [
    { id: 'r1', title: 'Webinars', href: '/webinars', icon: <Monitor className="h-10 w-10" />, imageUrl: resourceImages.webinars },
    {
      id: 'office-hours',
      title: 'CHM Office Hours',
      href: '/chm-office-hours',
      icon: <CalendarClock className="h-10 w-10" />,
      imageUrl: resourceImages.webinars,
    },
    { id: 'r2', title: 'Protocols', href: '/catalog', icon: <Headphones className="h-10 w-10" />, imageUrl: resourceImages.protocols },
    { id: 'r3', title: 'Clinicals', href: '/catalog', icon: <FileText className="h-10 w-10" />, imageUrl: resourceImages.clinicals },
    { id: 'r4', title: 'Conversations', href: '/catalog', icon: <Video className="h-10 w-10" />, imageUrl: resourceImages.watch },
    { id: 'r5', title: 'Reporting', href: '/catalog', icon: <Clock className="h-10 w-10" />, imageUrl: resourceImages.reporting },
    { id: 'r6', title: 'Data', href: '/catalog', icon: <LayoutGrid className="h-10 w-10" />, imageUrl: resourceImages.data },
    { id: 'r7', title: 'Library', href: '/catalog', icon: <Search className="h-10 w-10" />, imageUrl: resourceImages.search },
  ];

  return (
    <div className="min-w-0 overflow-x-hidden bg-white text-gray-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Hero: shorter than full-viewport; text stays legible on scrim + photo */}
      <section className="relative shadow-[0_20px_50px_-24px_rgba(0,0,0,0.35)]">
        <div
          className="w-full min-h-[min(42vh,380px)] bg-cover bg-center bg-gray-800 sm:min-h-[min(48vh,420px)] md:min-h-[min(52vh,460px)]"
          style={{
            backgroundImage: "url('/images/hero-bg.png')",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/55" />
          <div className="relative mx-auto flex min-h-[min(42vh,380px)] max-w-7xl items-center justify-center px-4 py-10 text-center sm:min-h-[min(48vh,420px)] sm:px-6 sm:py-12 md:min-h-[min(52vh,460px)] md:py-14">
            <div className="max-w-3xl space-y-4 sm:space-y-5">
              <div className="home-enter" style={{ animationDelay: `${HOME_STAGGER_MS.heroTitle}ms` }}>
                <h1 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
                  The Future of Healthcare Marketing and Education
                </h1>
              </div>
              <div className="home-enter" style={{ animationDelay: `${HOME_STAGGER_MS.heroLead}ms` }}>
                <p className="text-pretty text-sm leading-relaxed text-white/90 md:text-base">
                  Community Health Technologies is redefining how pharma reaches healthcare audiences, and educates them where they actively consume and trust information.
                </p>
              </div>
              <div className="home-enter" style={{ animationDelay: `${HOME_STAGGER_MS.heroCtas}ms` }}>
                <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link
                    to="/join"
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-gray-900 shadow-[0_1px_0_0_rgba(255,255,255,0.5)_inset,0_8px_24px_-8px_rgba(0,0,0,0.2)] transition-[color,background-color,transform,box-shadow] hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.96]"
                  >
                    Get Started
                  </Link>
                  <Link
                    to="/about"
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-full border border-white/20 bg-gray-900/90 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset,0_8px_24px_-8px_rgba(0,0,0,0.35)] transition-[color,background-color,transform,box-shadow] hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.96]"
                  >
                    Learn More
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured: Replit-style horizontal row + strip cards (same as in-app) */}
      <section className="space-y-6 pt-4 pb-10 sm:space-y-8 sm:pt-6 sm:pb-12">
        {randomVideosLoading && (
          <div
            className="home-enter mx-auto max-w-7xl px-4 sm:px-6"
            style={{ animationDelay: `${HOME_STAGGER_MS.featCarousel}ms` }}
          >
            <ConversationRow title="Featured videos" seeAllHref="/catalog?view=clips" seeAllLabel="See all in library">
              <StripRowLoadingThumbnails />
            </ConversationRow>
          </div>
        )}

        {!randomVideosLoading && featuredVideos.length > 0 && (
          <div
            className="home-enter mx-auto max-w-7xl px-4 sm:px-6"
            style={{ animationDelay: `${HOME_STAGGER_MS.featCarousel}ms` }}
          >
            <ConversationRow
              title="Featured videos"
              subtitle={`${featuredVideos.length} items`}
              seeAllHref="/catalog?view=clips"
              seeAllLabel="See all in library"
            >
              {featuredVideos.map((v) => (
                <StripCard
                  key={v.id}
                  to={v.id.startsWith('home-placeholder') ? '/catalog?view=clips' : `/catalog/clip/${getShortClipId(v.id)}`}
                  title={v.title}
                  imageUrl={v.imageUrl}
                  variant="thumbnailOnly"
                  meta={v.youtubeUrl ? 'YouTube' : 'Conversation'}
                />
              ))}
            </ConversationRow>
          </div>
        )}
      </section>

      {playlistsLoading && playlists.length === 0 ? (
        <section className="py-10 sm:py-12" aria-live="polite" aria-busy="true">
          <div className="flex flex-col items-center justify-center gap-2 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-gray-400 dark:text-zinc-500" aria-hidden />
            <span className="text-sm text-gray-600 dark:text-zinc-400">Loading playlists</span>
          </div>
        </section>
      ) : (
        <>
          <section
            className="home-enter py-6 sm:py-8"
            style={{ animationDelay: `${HOME_STAGGER_MS.biomarkerBody}ms` }}
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <ConversationRow
                title="HER2+"
                subtitle={her2StripSubtitle}
                seeAllHref={buildCatalogSectionPlaylistsHref(false, 'HER2+ Conversations')}
                seeAllLabel={VIEW_PLAYLIST_LABEL}
              >
                {her2FlattenedVideos.isLoading ? (
                  <StripRowLoadingThumbnails />
                ) : her2FlattenedVideos.entries.length > 0 ? (
                  her2FlattenedVideos.entries.slice(0, HOME_STRIP_VIDEO_CAP).map((e) => (
                    <StripCard
                      key={`${e.playlistId}-${e.video.id}`}
                      to={`/catalog/playlist/${encodeURIComponent(e.playlistId)}?v=${encodeURIComponent(e.video.id)}`}
                      title={e.video.title}
                      imageUrl={e.video.thumbnailUrl || `https://img.youtube.com/vi/${e.video.id}/hqdefault.jpg`}
                      description={e.playlistTitle}
                    />
                  ))
                ) : (
                  biomarkerPlaylists.map((t) => (
                    <StripCard
                      key={t.id}
                      to={t.playlistUrl}
                      title={t.title}
                      imageUrl={t.imageUrl}
                      meta={playlistMetaLabel(t.videoCount, t.videoNames.length)}
                    />
                  ))
                )}
              </ConversationRow>
            </div>
          </section>

          <section
            className="home-enter py-6 sm:py-8"
            style={{ animationDelay: `${HOME_STAGGER_MS.hrBody}ms` }}
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <ConversationRow
                title="HR+"
                subtitle={hrStripSubtitle}
                seeAllHref={buildCatalogSectionPlaylistsHref(false, 'HR+ · CDK4/6 · Endocrine')}
                seeAllLabel={VIEW_PLAYLIST_LABEL}
              >
                {hrFlattenedVideos.isLoading ? (
                  <StripRowLoadingThumbnails />
                ) : hrFlattenedVideos.entries.length > 0 ? (
                  hrFlattenedVideos.entries.slice(0, HOME_STRIP_VIDEO_CAP).map((e) => (
                    <StripCard
                      key={`${e.playlistId}-${e.video.id}`}
                      to={`/catalog/playlist/${encodeURIComponent(e.playlistId)}?v=${encodeURIComponent(e.video.id)}`}
                      title={e.video.title}
                      imageUrl={e.video.thumbnailUrl || `https://img.youtube.com/vi/${e.video.id}/hqdefault.jpg`}
                      description={e.playlistTitle}
                    />
                  ))
                ) : (
                  hrPlusPlaylists.map((t) => (
                    <StripCard
                      key={t.id}
                      to={t.playlistUrl}
                      title={t.title}
                      imageUrl={t.imageUrl}
                      meta={playlistMetaLabel(t.videoCount, t.videoNames.length)}
                    />
                  ))
                )}
              </ConversationRow>
            </div>
          </section>

          {/* View treatment specific content — below HR+ playlists */}
          <DiseaseAreasCarousel staggerBaseMs={HOME_STAGGER_MS.disease} />
        </>
      )}

      {/* About Us teaser */}
      <section className="py-10 sm:py-14">
        <div className="mx-auto flex max-w-7xl justify-center px-4 sm:px-6">
          <div
            className="home-enter max-w-2xl space-y-5 text-center"
            style={{ animationDelay: `${HOME_STAGGER_MS.about}ms` }}
          >
            <h4 className="text-balance text-3xl font-semibold text-gray-900 dark:text-zinc-100">About Us</h4>
            <p className="text-pretty text-sm leading-relaxed text-gray-700 dark:text-zinc-300">
              Community Health Media (CHM) is a full-service medical communications partner: expert-led content,
              strategic distribution, and multichannel campaigns for healthcare. We help organizations connect with HCPs,
              KOLs, and patient communities through clinically credible communication.
            </p>
            <p className="text-pretty text-sm leading-relaxed text-gray-700 dark:text-zinc-300">
              Learn more about what we stand for, who we serve, and how our platform supports clinical learning.
            </p>
            <Link
              to="/about"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset] transition-[color,background-color,transform] hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 active:scale-[0.96] dark:bg-brand-600 dark:hover:bg-brand-500"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Who We Reach */}
      <section className="border-t border-gray-200 py-10 dark:border-zinc-800 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h4
            className="home-enter mb-8 text-center text-balance text-3xl font-semibold text-gray-900 dark:text-zinc-100"
            style={{ animationDelay: `${HOME_STAGGER_MS.whoWe}ms` }}
          >
            Who We Reach
          </h4>
          <div
            className="home-enter grid grid-cols-1 gap-6 md:grid-cols-3"
            style={{ animationDelay: `${HOME_STAGGER_MS.whoWe + 90}ms` }}
          >
            <div className="rounded-2xl bg-white p-6 shadow-[0_12px_36px_-18px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.06] dark:bg-zinc-900 dark:ring-white/10">
              <p className="mb-2 font-semibold text-gray-900 dark:text-zinc-100">HCPs</p>
              <p className="text-pretty text-sm leading-relaxed text-gray-600 dark:text-zinc-400">Beyond conferences and CME, where they actually consume content</p>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-[0_12px_36px_-18px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.06] dark:bg-zinc-900 dark:ring-white/10">
              <p className="mb-2 font-semibold text-gray-900 dark:text-zinc-100">Patients</p>
              <p className="text-pretty text-sm leading-relaxed text-gray-600 dark:text-zinc-400">Pre or active treatment, searching for credible information</p>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-[0_12px_36px_-18px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.06] dark:bg-zinc-900 dark:ring-white/10">
              <p className="mb-2 font-semibold text-gray-900 dark:text-zinc-100">Caregivers</p>
              <p className="text-pretty text-sm leading-relaxed text-gray-600 dark:text-zinc-400">Making decisions, seeking guidance, needing support</p>
            </div>
          </div>
        </div>
      </section>

      {/* Resources */}
      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6">
          <div className="space-y-2 text-center">
            <h5
              className="home-enter text-balance text-4xl font-semibold text-gray-900 dark:text-zinc-100 md:text-5xl"
              style={{ animationDelay: `${HOME_STAGGER_MS.resourcesHead}ms` }}
            >
              Resources
            </h5>
          </div>
          <div
            className="home-enter grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4"
            style={{ animationDelay: `${HOME_STAGGER_MS.resourcesGrid}ms` }}
          >
            {resources.map((r) => (
              <Link
                key={r.id}
                to={r.href}
                className="group relative block min-h-[140px] overflow-hidden rounded-2xl bg-gray-700 shadow-[0_10px_28px_-12px_rgba(0,0,0,0.35)] ring-1 ring-black/[0.08] transition-[transform] active:scale-[0.96] md:min-h-[160px]"
              >
                <img
                  src={r.imageUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover ring-1 ring-inset ring-black/10"
                />
                <div className="absolute inset-0 bg-black/45 transition-[background-color] group-hover:bg-black/55" />
                <div className="relative flex min-h-[140px] flex-col justify-between p-4 md:min-h-[160px]">
                  <span className="text-white/95 transition-[color] group-hover:text-white">{r.icon}</span>
                  <p className="text-balance text-sm font-semibold text-white">{r.title}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How We Help Pharma - FAQ accordion */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2
            className="home-enter mb-8 text-center text-balance text-3xl font-semibold tracking-tighter text-gray-900 dark:text-zinc-100 md:mb-10 md:text-4xl lg:text-5xl"
            style={{ animationDelay: `${HOME_STAGGER_MS.faqHead}ms` }}
          >
            How We Help Pharma Educate Healthcare Audiences
          </h2>
          <div className="home-enter space-y-0" style={{ animationDelay: `${HOME_STAGGER_MS.faqBody}ms` }}>
            <details className="group">
              <summary className="list-none flex cursor-pointer items-center justify-between border-b border-gray-200 py-5 group-open:border-b-0 dark:border-zinc-800">
                <span className="flex items-center gap-2">
                  <span className="text-green-600 dark:text-emerald-400" aria-hidden>
                    ✓
                  </span>
                  <span className="text-balance text-xl font-medium leading-snug text-gray-900 dark:text-zinc-100 md:text-[1.375rem]">AI-Powered Content Automation</span>
                </span>
                <span className="ml-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-900 transition-transform group-open:rotate-45 dark:bg-zinc-800 dark:text-zinc-100">
                  <span className="text-lg font-light leading-none">+</span>
                </span>
              </summary>
              <p className="text-pretty px-4 pb-5 pt-2 text-base leading-relaxed text-gray-600">
                Turn one medical webinar or clinical presentation into 20+ platform-specific assets: social posts, podcast clips, infographics, and more.
              </p>
            </details>
            <details className="group">
              <summary className="list-none flex cursor-pointer items-center justify-between border-b border-gray-200 py-5 group-open:border-b-0 dark:border-zinc-800">
                <span className="flex items-center gap-2">
                  <span className="text-green-600 dark:text-emerald-400" aria-hidden>✓</span>
                  <span className="text-balance text-xl font-medium leading-snug text-gray-900 dark:text-zinc-100 md:text-[1.375rem]">Multi-Audience Reach</span>
                </span>
                <span className="ml-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-900 transition-transform group-open:rotate-45 dark:bg-zinc-800 dark:text-zinc-100">
                  <span className="text-lg font-light leading-none">+</span>
                </span>
              </summary>
              <p className="text-pretty px-4 pb-5 pt-2 text-base leading-relaxed text-gray-600">
                Engage KOLs, HCPs, patients, and caregivers through a unified content ecosystem.
              </p>
            </details>
            <details className="group">
              <summary className="list-none flex items-center justify-between cursor-pointer py-5 border-b border-gray-200 group-open:border-b-0">
                <span className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span className="text-balance text-xl font-medium leading-snug text-gray-900 md:text-[1.375rem]">Entertainment-Grade Distribution</span>
                </span>
                <span className="ml-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-900 transition-transform group-open:rotate-45">
                  <span className="text-lg font-light leading-none">+</span>
                </span>
              </summary>
              <p className="text-pretty px-4 pb-5 pt-2 text-base leading-relaxed text-gray-600">
                Leverage podcasts, social media, live events, and owned digital properties to reach audiences where they consume trusted information.
              </p>
            </details>
            <details className="group">
              <summary className="list-none flex items-center justify-between cursor-pointer py-5 border-b border-gray-200 group-open:border-b-0">
                <span className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span className="text-balance text-xl font-medium leading-snug text-gray-900 md:text-[1.375rem]">First-Party HCP Intelligence</span>
                </span>
                <span className="ml-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-900 transition-transform group-open:rotate-45">
                  <span className="text-lg font-light leading-none">+</span>
                </span>
              </summary>
              <p className="text-pretty px-4 pb-5 pt-2 text-base leading-relaxed text-gray-600">
                Access proprietary data for precision targeting, lookalike audiences, and measurable activation.
              </p>
            </details>
            <details className="group">
              <summary className="list-none flex items-center justify-between cursor-pointer py-5 border-b border-gray-200 group-open:border-b-0">
                <span className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span className="text-balance text-xl font-medium leading-snug text-gray-900 md:text-[1.375rem]">Real Engagement Analytics</span>
                </span>
                <span className="ml-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-900 transition-transform group-open:rotate-45">
                  <span className="text-lg font-light leading-none">+</span>
                </span>
              </summary>
              <p className="text-pretty px-4 pb-5 pt-2 text-base leading-relaxed text-gray-600">
                Move beyond impressions. Track who watched, who shared, and who took meaningful action.
              </p>
            </details>
          </div>
          <div
            className="home-enter mt-10 flex justify-center"
            style={{ animationDelay: `${HOME_STAGGER_MS.faqBody + 90}ms` }}
          >
            <Link
              to="/join"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-gray-900 px-8 py-2.5 text-sm font-semibold text-white shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset] transition-[color,background-color,transform] hover:bg-black active:scale-[0.96]"
            >
              Get Started
            </Link>
          </div>
        </div>
      </section>

      {/* A media company thats about more than just content - Figma Frame 13 */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
          <h2
            className="home-enter text-balance mx-auto mb-6 md:mb-8 text-gray-900 dark:text-white"
            style={{
              animationDelay: `${HOME_STAGGER_MS.closingHead}ms`,
              fontFamily: '"Apple Garamond", Garamond, serif',
              fontSize: 'clamp(2.5rem, 8vw, 96px)',
              fontWeight: 400,
              lineHeight: 1.15,
              maxWidth: '955px',
            }}
          >
            A Media Company That&apos;s About More Than Just Content
          </h2>
          <Link
            to="/join"
            className="home-enter inline-flex min-h-[48px] min-w-[208px] items-center justify-center rounded-full bg-gray-900 px-10 py-4 text-base font-medium text-white shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset] transition-[color,background-color,transform] hover:bg-black active:scale-[0.96]"
            style={{ animationDelay: `${HOME_STAGGER_MS.closingCta}ms` }}
          >
            Join Us
          </Link>
        </div>
      </section>
    </div>
  );
}

type DiseaseAreasCarouselProps = {
  /** Base delay (ms) for landing stagger; sub-regions add ~80–90ms each */
  staggerBaseMs?: number;
};

function DiseaseAreasCarousel({ staggerBaseMs = 0 }: DiseaseAreasCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const mid = Math.floor(DISEASE_AREAS.length / 2);
    const cards = el.querySelectorAll('[data-disease-card]');
    cards[mid]?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
    setActiveIdx(mid);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const cards = el.querySelectorAll('[data-disease-card]');
    const containerCenter = el.scrollLeft + el.clientWidth / 2;
    let closest = 0;
    let closestDist = Infinity;
    cards.forEach((card, i) => {
      const rect = (card as HTMLElement).getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const cardCenter = rect.left - elRect.left + el.scrollLeft + rect.width / 2;
      const dist = Math.abs(containerCenter - cardCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });
    setActiveIdx(closest);
  }, []);

  const scrollTo = useCallback((idx: number) => {
    setActiveIdx(idx);
    scrollRef.current?.querySelectorAll('[data-disease-card]')[idx]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, []);

  return (
    <section className="space-y-6 py-10 sm:space-y-8 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="space-y-2 text-center">
          <h3
            className="home-enter text-balance text-2xl font-medium tracking-tight text-gray-900 dark:text-zinc-100 sm:text-3xl md:text-4xl"
            style={{ animationDelay: `${staggerBaseMs}ms` }}
          >
            View treatment specific content
          </h3>
          <p
            className="home-enter mx-auto max-w-xl text-pretty text-sm text-zinc-500 dark:text-zinc-400 sm:text-base"
            style={{ animationDelay: `${staggerBaseMs + 90}ms` }}
          >
            Explore content by therapeutic area - expert-led education, conversations, and resources.
          </p>
        </div>
      </div>

      <div
        className="home-enter w-full min-w-0"
        style={{ animationDelay: `${staggerBaseMs + 180}ms` }}
      >
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="scrollbar-hide flex snap-x snap-mandatory gap-5 overflow-x-auto overflow-y-hidden scroll-smooth px-4 sm:px-6"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div
            className="w-[max(1rem,calc(50%-280px))] shrink-0 sm:w-[max(1rem,calc(50%-300px))] md:w-[max(1rem,calc(50%-340px))] lg:w-[max(1rem,calc(50%-360px))]"
            aria-hidden
          />
          {DISEASE_AREAS.map((area) => {
            const inner = (
              <div
                data-disease-card
                className="group relative h-[180px] w-[280px] shrink-0 snap-center overflow-hidden rounded-[20px] shadow-[0_16px_40px_-16px_rgba(0,0,0,0.45)] ring-1 ring-black/[0.12] sm:h-[260px] sm:w-[420px] md:h-[320px] md:w-[560px] lg:h-[340px] lg:w-[640px] dark:ring-white/10"
              >
                <img
                  src={area.image}
                  alt={area.title}
                  className="absolute inset-0 h-full w-full object-cover ring-1 ring-inset ring-black/10"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 rounded-[20px] bg-black/30" />
                <div className="absolute inset-0 flex items-center justify-between px-5 sm:px-8 md:px-10">
                  <h4 className="text-balance text-2xl font-normal text-white sm:text-3xl md:text-4xl">
                    {area.title}
                  </h4>
                  <span className="whitespace-nowrap text-sm text-white underline decoration-solid underline-offset-4 transition-[opacity] group-hover:opacity-80 sm:text-base md:text-xl">
                    Explore Treatment
                  </span>
                </div>
              </div>
            );
            return area.active ? (
              <Link
                key={area.slug}
                to={`/catalog/${area.slug}`}
                className="shrink-0 snap-center transition-[transform] active:scale-[0.96]"
              >
                {inner}
              </Link>
            ) : (
              <div key={area.slug} className="w-fit shrink-0 cursor-default snap-center">
                {inner}
              </div>
            );
          })}
          <div
            className="w-[max(1rem,calc(50%-280px))] shrink-0 sm:w-[max(1rem,calc(50%-300px))] md:w-[max(1rem,calc(50%-340px))] lg:w-[max(1rem,calc(50%-360px))]"
            aria-hidden
          />
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl justify-center px-4 sm:px-6">
        <div
          className="home-enter flex items-center justify-center gap-1"
          style={{ animationDelay: `${staggerBaseMs + 270}ms` }}
        >
          {DISEASE_AREAS.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => scrollTo(idx)}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-[transform] after:block after:h-2 after:w-2 after:rounded-full after:content-[''] after:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 active:scale-[0.96] ${
                idx === activeIdx
                  ? 'after:bg-gray-900 dark:after:bg-zinc-100'
                  : 'after:bg-gray-300 hover:after:bg-gray-400 dark:after:bg-zinc-600 dark:hover:after:bg-zinc-500'
              }`}
              aria-label={`Go to disease area ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
