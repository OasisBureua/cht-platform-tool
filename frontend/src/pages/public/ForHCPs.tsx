import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { webinarsApi } from '../../api/webinars';

const STOCK_IMAGES = {
  featuredVideo: 'https://picsum.photos/seed/forhcp-video/800/500',
  featuredWebinar: 'https://picsum.photos/seed/forhcp-webinar/800/500',
  featuredSurvey: 'https://picsum.photos/seed/forhcp-survey/600/300',
  featuredStudy: 'https://picsum.photos/seed/forhcp-study/600/300',
  biomarker: [
    'https://picsum.photos/seed/forhcp-bio1/600/200',
    'https://picsum.photos/seed/forhcp-bio2/600/200',
    'https://picsum.photos/seed/forhcp-bio3/600/200',
  ],
  webinar: [
    'https://picsum.photos/seed/forhcp-w1/400/220',
    'https://picsum.photos/seed/forhcp-w2/400/220',
    'https://picsum.photos/seed/forhcp-w3/400/220',
    'https://picsum.photos/seed/forhcp-w4/400/220',
    'https://picsum.photos/seed/forhcp-w5/400/220',
    'https://picsum.photos/seed/forhcp-w6/400/220',
  ],
} as const;

const BIOMARKER_PLAYLISTS = [
  { id: '1', title: 'HER2+ Big Picture & Practice Change', imageUrl: STOCK_IMAGES.biomarker[0] },
  { id: '2', title: 'First-Line & Sequencing Decisions', imageUrl: STOCK_IMAGES.biomarker[1] },
  { id: '3', title: 'High-Risk & CNS Disease', imageUrl: STOCK_IMAGES.biomarker[2] },
];

const FALLBACK_WEBINARS = [
  { id: '1', title: 'Webinar #1', imageUrl: STOCK_IMAGES.webinar[0], description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.' },
  { id: '2', title: 'Webinar #2', imageUrl: STOCK_IMAGES.webinar[1], description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.' },
  { id: '3', title: 'Webinar #3', imageUrl: STOCK_IMAGES.webinar[2], description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.' },
];

export default function ForHCPs() {
  const { data: webinars = [], isLoading } = useQuery({
    queryKey: ['webinars'],
    queryFn: webinarsApi.list,
    staleTime: 5 * 60 * 1000,
  });
  const webinarItems = webinars.length > 0
    ? webinars.map((w) => ({ id: w.id, title: w.title, imageUrl: w.imageUrl || '', description: w.description }))
    : FALLBACK_WEBINARS;
  return (
    <div className="bg-white min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10 md:py-14 space-y-12 md:space-y-16">
        {/* Main title */}
        <header>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">
            HCP Platform
          </h1>
        </header>

        {/* Featured content: 2 large + 2 small cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FeaturedCard
            title="Featured Video Title"
            imageUrl={STOCK_IMAGES.featuredVideo}
            cta="Conversations"
            size="large"
            to="/watch"
            showNew
          />
          <FeaturedCard
            title={webinarItems[0]?.title || 'Featured Webinar'}
            imageUrl={webinarItems[0]?.imageUrl || STOCK_IMAGES.featuredWebinar}
            cta="Join Now"
            size="large"
            to={webinarItems[0] ? `/webinars/${webinarItems[0].id}` : '/webinars'}
            showNew
          />
          <FeaturedCard
            title="Newest Survey"
            imageUrl={STOCK_IMAGES.featuredSurvey}
            cta="Join Now"
            size="small"
            to="/app/surveys"
          />
          <FeaturedCard
            title="Newest Study"
            imageUrl={STOCK_IMAGES.featuredStudy}
            cta="Join Now"
            size="small"
            to="/catalog"
          />
        </section>

        {/* Featured Biomarker Playlists */}
        <section className="space-y-5">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
              Featured Biomarker Playlists
            </h2>
            <p className="mt-1 text-lg font-semibold text-gray-900">HR+</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {BIOMARKER_PLAYLISTS.map((card) => (
              <BiomarkerPlaylistCard key={card.id} card={card} />
            ))}
          </div>
        </section>

        {/* Webinar Catalogue */}
        <section className="space-y-6">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
            Webinar Catalogue
          </h2>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {webinarItems.map((webinar) => (
                <WebinarCard key={webinar.id} webinar={webinar} />
              ))}
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
  size,
  to,
  showNew,
}: {
  title: string;
  imageUrl: string;
  cta: string;
  size: 'large' | 'small';
  to: string;
  showNew?: boolean;
}) {
  const isLarge = size === 'large';
  return (
    <Link
      to={to}
      className={`group relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 ${
        isLarge ? 'min-h-[220px] md:min-h-[260px]' : 'min-h-[160px]'
      }`}
    >
      <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="eager" referrerPolicy="no-referrer" />
      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />
      {showNew && (
        <span className="absolute left-3 top-3 rounded bg-[#000000] px-2.5 py-1 text-xs font-semibold text-white">
          New
        </span>
      )}
      <div className="absolute inset-0 p-5 flex flex-col justify-end">
        <p className="text-lg font-semibold text-gray-900">{title}</p>
        <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-lg bg-[#000000] px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 transition-colors">
          {cta} →
        </span>
      </div>
    </Link>
  );
}

function BiomarkerPlaylistCard({ card }: { card: { id: string; title: string; imageUrl: string } }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden flex flex-col">
      <div className="relative h-[140px] shrink-0">
        <img src={card.imageUrl} alt="" className="h-full w-full object-cover" loading="eager" referrerPolicy="no-referrer" />
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h4 className="font-bold text-gray-900">{card.title}</h4>
        <ul className="mt-3 space-y-2 flex-1">
          {[1, 2, 3, 4].map((i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
              <span className="h-1 w-1 rounded-full bg-gray-400 shrink-0" />
              Video Name
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end">
          <Link
            to="/watch"
            className="rounded-lg bg-[#000000] px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
          >
            Play all
          </Link>
        </div>
      </div>
    </div>
  );
}

function WebinarCard({
  webinar,
}: {
  webinar: { id: string; title: string; imageUrl: string; description: string };
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden flex flex-col sm:flex-row">
      <div className="relative w-full sm:w-48 h-40 sm:h-auto shrink-0">
        <img src={webinar.imageUrl} alt="" className="h-full w-full object-cover" loading="eager" referrerPolicy="no-referrer" />
        <span className="absolute left-2 top-2 rounded bg-[#000000] px-2 py-0.5 text-xs font-semibold text-white">
          New
        </span>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h4 className="font-bold text-gray-900">{webinar.title}</h4>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed line-clamp-3 flex-1">
          {webinar.description}
        </p>
        <div className="mt-4 flex justify-end">
          <Link
            to={`/webinars/${webinar.id}`}
            className="rounded-lg bg-[#000000] px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
          >
            Learn More
          </Link>
        </div>
      </div>
    </div>
  );
}
