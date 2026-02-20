import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Loader2 } from 'lucide-react';
import { webinarsApi } from '../../api/webinars';

const STOCK_IMAGES = {
  featuredWebinar: 'https://picsum.photos/seed/pubweb-featured/800/450',
  activityCard: 'https://picsum.photos/seed/pubweb-activity/400/300',
  newestWebinar: 'https://picsum.photos/seed/pubweb-newest/600/200',
  nextActivity: 'https://picsum.photos/seed/pubweb-next/600/200',
} as const;

const FALLBACK_WEBINARS = [
  { id: '1', title: 'Webinar #1', imageUrl: 'https://picsum.photos/seed/pubweb-w1/400/220', description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.' },
  { id: '2', title: 'Webinar #2', imageUrl: 'https://picsum.photos/seed/pubweb-w2/400/220', description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.' },
  { id: '3', title: 'Webinar #3', imageUrl: 'https://picsum.photos/seed/pubweb-w3/400/220', description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.' },
];

export default function PublicWebinars() {
  const { data: webinars = [], isLoading } = useQuery({
    queryKey: ['webinars'],
    queryFn: webinarsApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const items = webinars.length > 0
    ? webinars.map((w) => ({ id: w.id, title: w.title, imageUrl: w.imageUrl || '', description: w.description }))
    : FALLBACK_WEBINARS;
  return (
    <div className="bg-white min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10 md:py-14 space-y-10 md:space-y-14">
        {/* Header: Title + View All Diseases */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">
            Webinars
          </h1>
          <Link
            to="/catalog"
            className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors w-fit"
          >
            View All Diseases
          </Link>
        </header>

        {/* Featured section: Featured Webinar + Webinar Activity card */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Featured Webinar (large) */}
          <Link
            to={items[0] ? `/webinars/${items[0].id}` : '/webinars'}
            className="lg:col-span-8 group relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 min-h-[280px] md:min-h-[320px]"
          >
            <img
              src={items[0]?.imageUrl || STOCK_IMAGES.featuredWebinar}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="eager"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />
            <span className="absolute left-4 top-4 rounded bg-[#000000] px-2.5 py-1 text-xs font-semibold text-white">
              New
            </span>
            <div className="absolute inset-0 p-6 flex flex-col justify-end">
              <p className="text-xl md:text-2xl font-semibold text-gray-900">
                {items[0]?.title || 'Featured Webinar'}
              </p>
              <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-lg bg-[#000000] px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 transition-colors">
                Join Now <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Link>

          {/* Webinar Activity card (dark) */}
          <Link
            to="/app/webinars"
            className="lg:col-span-4 relative rounded-2xl overflow-hidden min-h-[200px] md:min-h-[320px] bg-gradient-to-br from-gray-900 to-emerald-950"
          >
            <img
              src={STOCK_IMAGES.activityCard}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-40"
              loading="eager"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 flex flex-col justify-between p-6">
              <p className="text-lg md:text-xl font-semibold text-white">
                85 Minutes of Webinar Activity
              </p>
              <p className="text-sm text-gray-300">See More</p>
            </div>
          </Link>
        </section>

        {/* Horizontal featured cards: Newest Webinar + Next Activity Type */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Link
            to={items[1] ? `/webinars/${items[1].id}` : '/webinars'}
            className="group flex items-center gap-5 rounded-2xl border border-gray-200 bg-white p-4 hover:shadow-md transition-shadow"
          >
            <div className="h-24 w-32 shrink-0 overflow-hidden rounded-xl">
              <img
                src={items[1]?.imageUrl || STOCK_IMAGES.newestWebinar}
                alt=""
                className="h-full w-full object-cover"
                loading="eager"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{items[1]?.title || 'Newest Webinar'}</p>
            </div>
            <span className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-[#000000] text-white group-hover:bg-gray-800 transition-colors">
              <ArrowRight className="h-5 w-5" />
            </span>
          </Link>
          <Link
            to={items[2] ? `/webinars/${items[2].id}` : '/webinars'}
            className="group flex items-center gap-5 rounded-2xl border border-gray-200 bg-white p-4 hover:shadow-md transition-shadow"
          >
            <div className="h-24 w-32 shrink-0 overflow-hidden rounded-xl">
              <img
                src={items[2]?.imageUrl || STOCK_IMAGES.nextActivity}
                alt=""
                className="h-full w-full object-cover"
                loading="eager"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{items[2]?.title || 'Upcoming Webinar'}</p>
            </div>
            <span className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-[#000000] text-white group-hover:bg-gray-800 transition-colors">
              <ArrowRight className="h-5 w-5" />
            </span>
          </Link>
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
              {items.map((webinar) => (
                <WebinarCard key={webinar.id} webinar={webinar} />
              ))}
            </div>
          )}
        </section>
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
