import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Calendar, Clock } from 'lucide-react';
import { format, isPast, formatDistanceToNow } from 'date-fns';
import { webinarsApi, type WebinarItem } from '../../api/webinars';
import { catalogApi, type CatalogItem } from '../../api/catalog';

const FALLBACK_WEBINAR_IMAGE = '/images/resource-webinars.png';

const STOCK_IMAGES = {
  featuredVideo: '/images/resource-watch.png',
  featuredWebinar: '/images/resource-webinars.png',
  featuredStudy: '/images/resource-clinicals.png',
} as const;

type Treatment = {
  id: string;
  title: string;
  imageUrl: string;
  slug: string;
  videoNames: string[];
  playlistUrl: string;
};

function catalogToTreatment(p: CatalogItem): Treatment {
  return {
    id: p.id,
    title: p.title,
    imageUrl: p.thumbnailUrl || 'https://via.placeholder.com/400x225?text=Playlist',
    slug: p.id,
    videoNames: p.videoNames || [],
    playlistUrl: `/catalog/playlist/${p.id}`,
  };
}

const FALLBACK_HR: Treatment[] = [
  { id: 'hr1', title: 'HR+ Big Picture & Practice Change', slug: 'hr-big-picture', imageUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80', videoNames: ['Video Name', 'Video Name', 'Video Name', 'Video Name'], playlistUrl: '/catalog' },
  { id: 'hr2', title: 'First-Line & Sequencing Decisions', slug: 'hr-first-line-sequencing', imageUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80', videoNames: ['Video Name', 'Video Name', 'Video Name', 'Video Name'], playlistUrl: '/catalog' },
  { id: 'hr3', title: 'High-Risk & CNS Disease', slug: 'hr-high-risk-cns', imageUrl: 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?auto=format&fit=crop&w=800&q=80', videoNames: ['Video Name', 'Video Name', 'Video Name', 'Video Name'], playlistUrl: '/catalog' },
];

function isExpired(w: WebinarItem): boolean {
  if (!w.startTime) return false;
  return isPast(new Date(w.startTime));
}

function formatDuration(minutes?: number): string {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function ForHCPs() {
  const { data: webinars = [], isLoading } = useQuery({
    queryKey: ['webinars'],
    queryFn: webinarsApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const { data: playlists = [], isLoading: playlistsLoading } = useQuery({
    queryKey: ['catalog', 'playlists'],
    queryFn: catalogApi.getPlaylists,
    staleTime: 5 * 60 * 1000,
  });

  const hrPlusPlaylists = useMemo<Treatment[]>(() => {
    if (playlists.length === 0) return FALLBACK_HR;
    const hrOrTnbc = playlists.filter(
      (p) => /HR\+|hormone|TNBC|mTNBC|CDK4|endocrine|triple.?negative/i.test(p.title) &&
        !/HER2|her2|DESTINY-Breast/i.test(p.title)
    );
    if (hrOrTnbc.length > 0) return hrOrTnbc.map(catalogToTreatment);
    const nonHer2 = playlists.filter(
      (p) => !/HER2|her2|DESTINY-Breast|HER2\+|HER2 Low|HER2 Positive/i.test(p.title)
    );
    return nonHer2.length > 0 ? nonHer2.map(catalogToTreatment) : FALLBACK_HR;
  }, [playlists]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const sorted = [...webinars].sort((a, b) => {
      if (!a.startTime && !b.startTime) return 0;
      if (!a.startTime) return 1;
      if (!b.startTime) return -1;
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
    return {
      upcoming: sorted.filter((w) => !isExpired(w)),
      past: sorted.filter((w) => {
        if (!isExpired(w) || !w.startTime) return false;
        return new Date(w.startTime).getTime() >= thirtyDaysAgo;
      }),
    };
  }, [webinars]);

  const firstWebinar = upcoming[0] ?? past[0] ?? null;
  return (
    <div className="bg-white min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10 md:py-14 space-y-12 md:space-y-16">
        {/* Main title */}
        <header>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">
            HCP Platform
          </h1>
        </header>

        {/* Featured grid — equal cells, light overlay, pill CTAs */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
          <FeaturedCard
            title="Clinical Conversations"
            imageUrl={STOCK_IMAGES.featuredVideo}
            cta="Conversations"
            to="/catalog"
            showNew
          />
          <FeaturedCard
            title={firstWebinar?.title || 'Featured Webinar'}
            imageUrl={firstWebinar?.imageUrl || STOCK_IMAGES.featuredWebinar}
            cta="Join Now"
            to={firstWebinar ? `/webinars/${firstWebinar.id}` : '/webinars'}
            showNew
          />
          <FeaturedCard
            title="Office Hours"
            imageUrl={STOCK_IMAGES.featuredWebinar}
            cta="View sessions"
            to="/office-hours"
            showNew
          />
          <FeaturedCard
            title="KOL Network"
            imageUrl={STOCK_IMAGES.featuredStudy}
            cta="View directory"
            to="/kol-network"
          />
        </section>

        {/* Featured Biomarker Playlists — HR+ */}
        <section className="space-y-5">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
              Featured Biomarker Playlists
            </h2>
            <p className="mt-1 text-lg font-semibold text-gray-900">HR+</p>
          </div>
          {playlistsLoading && playlists.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 auto-rows-fr">
              {hrPlusPlaylists.slice(0, 3).map((card) => (
                <BiomarkerPlaylistCard key={card.id} card={card} />
              ))}
            </div>
          )}
        </section>

        {/* Webinars */}
        <section className="space-y-6">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
            Webinars
          </h2>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
            </div>
          ) : webinars.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
              <p className="font-semibold text-gray-900">No webinars scheduled</p>
              <p className="mt-1 text-sm text-gray-600">Check back soon for upcoming sessions.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {upcoming.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Upcoming · {upcoming.length}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {upcoming.map((w) => (
                      <WebinarCard key={w.id} webinar={w} expired={false} />
                    ))}
                  </div>
                </div>
              )}
              {past.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Past · {past.length}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-75">
                    {past.map((w) => (
                      <WebinarCard key={w.id} webinar={w} expired />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* =======================
   UI Components
   ======================= */

function FeaturedCard({
  title,
  imageUrl,
  cta,
  to,
  showNew,
}: {
  title: string;
  imageUrl: string;
  cta: string;
  to: string;
  showNew?: boolean;
}) {
  return (
    <Link
      to={to}
      className="group relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 min-h-[240px] md:min-h-[280px] h-full flex flex-col"
    >
      <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="eager" referrerPolicy="no-referrer" />
      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/[0.28] transition-colors pointer-events-none" />
      {showNew && (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-black/90 px-2.5 py-1 text-xs font-semibold text-white">
          New
        </span>
      )}
      <div className="relative mt-auto flex flex-col justify-end p-5 md:p-6 bg-gradient-to-t from-black/75 via-black/35 to-transparent">
        <p className="text-base md:text-lg font-semibold text-white line-clamp-2">{title}</p>
        <span className="mt-3 inline-flex w-fit items-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-md group-hover:bg-gray-100 transition-colors">
          {cta} →
        </span>
      </div>
    </Link>
  );
}


function BiomarkerPlaylistCard({ card }: { card: Treatment }) {
  const names = card.videoNames.length > 0 ? card.videoNames : ['Video', 'Video', 'Video', 'Video'];
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden flex flex-col h-full min-h-[380px]">
      <div className="relative aspect-video shrink-0 bg-gray-100">
        <img src={card.imageUrl} alt="" className="h-full w-full object-cover" loading="eager" referrerPolicy="no-referrer" />
      </div>
      <div className="p-5 flex flex-col flex-1 min-h-0 min-w-0">
        <h4 className="font-bold text-gray-900 line-clamp-2 min-h-[3.25rem]">{card.title}</h4>
        <ul className="mt-3 space-y-1.5 flex-1 min-h-0">
          {names.slice(0, 4).map((name, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
              <span className="h-1 w-1 rounded-full bg-gray-400 shrink-0" />
              <span className="truncate" title={name}>
                {name}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end pt-2 border-t border-gray-100">
          <Link
            to={card.playlistUrl}
            className="rounded-full bg-[#000000] px-5 py-2 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
          >
            Play all
          </Link>
        </div>
      </div>
    </div>
  );
}

function WebinarCard({ webinar: w, expired }: { webinar: WebinarItem; expired: boolean }) {
  const date = w.startTime ? new Date(w.startTime) : null;
  const imgSrc = w.imageUrl || FALLBACK_WEBINAR_IMAGE;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden flex flex-col sm:flex-row">
      <div className="relative w-full sm:w-44 h-40 sm:h-auto shrink-0">
        <img src={imgSrc} alt="" className="h-full w-full object-cover" loading="eager" />
        {expired ? (
          <span className="absolute left-2 top-2 rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
            Expired
          </span>
        ) : (
          <span className="absolute left-2 top-2 rounded bg-black px-2 py-0.5 text-xs font-semibold text-white">
            Upcoming
          </span>
        )}
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h4 className={`font-bold leading-snug ${expired ? 'text-gray-500' : 'text-gray-900'}`}>
          {w.title}
        </h4>
        {date && (
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(date, 'EEE, MMM d, yyyy')}
              {!expired && (
                <span className="text-gray-400 ml-1">· {formatDistanceToNow(date, { addSuffix: true })}</span>
              )}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(date, 'h:mm a')}
            </span>
            {w.duration && <span>{formatDuration(w.duration)}</span>}
          </div>
        )}
        {w.description && (
          <p className="mt-2 text-sm text-gray-600 leading-relaxed line-clamp-2 flex-1">
            {w.description}
          </p>
        )}
        <div className="mt-4 flex justify-end">
          <Link
            to={`/webinars/${w.id}`}
            className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
          >
            Learn More
          </Link>
        </div>
      </div>
    </div>
  );
}
