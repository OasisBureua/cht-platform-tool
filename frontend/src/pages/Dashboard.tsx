import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Presentation, ClipboardList, PlayCircle, ArrowRight, Loader2 } from 'lucide-react';
import { webinarsApi, type WebinarItem } from '../api/webinars';
import { format, isPast, startOfWeek, endOfWeek } from 'date-fns';

const WEBINAR_PLACEHOLDER_IMAGES = [
  '/images/iStock-1473559425-01131144-01b5-4e7d-9b15-f3db8846cad3.png',
  '/images/iStock-1667819272-cc7e9fde-feb0-4590-bb35-f5a86deba0dd.png',
  '/images/iStock-1917170353-5564763c-6ced-49b2-93ff-6a2261700399.png',
  '/images/iStock-1938555104-3986b580-5ef8-4aae-989f-05a2edd0bc12.png',
  '/images/iStock-2036497889-fae3ed6e-9859-4983-b3ec-7a489bb6fb95.png',
  '/images/iStock-1344792109-f418c5f0-d729-4965-8b2a-bfff4368cea3.png',
];

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

const QUICK_ACCESS = [
  { title: 'LIVE Sessions', desc: 'Attend live medical education sessions and earn $500-$1,000 per session', icon: Presentation, to: '/app/live' },
  { title: 'Complete Surveys', desc: 'Share your insights through voice-based surveys in just 5-10 minutes', icon: ClipboardList, to: '/app/surveys' },
  { title: 'Conversations', desc: 'View educational videos and earn rewards for staying engaged', icon: PlayCircle, to: '/app/catalog' },
];

export default function Dashboard() {
  const { data: webinars = [], isLoading } = useQuery({
    queryKey: ['webinars'],
    queryFn: webinarsApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const featuredWebinars = webinars.slice(0, 6);
  const latestWebinar = useMemo(() => getLatestWebinar(webinars), [webinars]);

  return (
    <div className="space-y-8">
      {/* Quick Access - dark cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {QUICK_ACCESS.map((item) => (
          <Link
            key={item.title}
            to={item.to}
            className="group relative rounded-2xl overflow-hidden bg-gray-900 p-6 text-white hover:bg-black transition-colors"
          >
            <div className="relative z-10">
              <item.icon className="h-10 w-10 text-white/90 mb-4" />
              <h3 className="text-lg font-bold mb-2">{item.title}</h3>
              <p className="text-sm text-white/80">{item.desc}</p>
            </div>
          </Link>
        ))}
      </section>

      {/* Recommended Activity */}
      <section className="rounded-2xl overflow-hidden bg-white border border-gray-200">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center p-6 md:p-8 lg:p-10">
            <div className="space-y-5 order-2 lg:order-1">
              <h2 className="text-xl font-bold text-gray-900">Recommended Activity</h2>
              {latestWebinar ? (
                <>
                  <h4 className="text-2xl md:text-3xl font-semibold text-gray-900">{latestWebinar.title}</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {latestWebinar.description || 'Medical education webinar.'}
                  </p>
                  {latestWebinar.startTime && (
                    <p className="text-sm text-gray-500">
                      {isPast(new Date(latestWebinar.startTime))
                        ? `Held ${format(new Date(latestWebinar.startTime), 'MMM d, yyyy')}`
                        : format(new Date(latestWebinar.startTime), 'MMM d, yyyy')}
                      {latestWebinar.duration ? ` · ${latestWebinar.duration} min` : ''}
                    </p>
                  )}
                  <Link
                    to={latestWebinar.id ? `/app/live/${latestWebinar.id}` : '/app/live'}
                    className="inline-flex rounded-full bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-black transition-colors"
                  >
                    Sign Up
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600">No webinars scheduled.</p>
                  <Link
                    to="/app/live"
                    className="inline-flex rounded-full bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-black transition-colors"
                  >
                    View Webinars
                  </Link>
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 lg:gap-5 order-1 lg:order-2">
              <div className="rounded-2xl overflow-hidden bg-white border border-gray-200">
                <div className="relative w-full aspect-[3/4] min-h-0">
                  <img
                    src="/images/iStock-1473559425-01131144-01b5-4e7d-9b15-f3db8846cad3.png"
                    alt=""
                    className="h-full w-full object-cover object-top"
                    loading="eager"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="p-4 space-y-1">
                  <p className="text-sm font-semibold text-gray-900">Featured Speaker</p>
                  <p className="text-xs text-gray-600">Medical education webinar</p>
                </div>
              </div>
              <div className="rounded-2xl overflow-hidden bg-white border border-gray-200">
                <div className="relative w-full aspect-[3/4] min-h-0">
                  <img
                    src="/images/iStock-1667819272-cc7e9fde-feb0-4590-bb35-f5a86deba0dd.png"
                    alt=""
                    className="h-full w-full object-cover object-top"
                    loading="eager"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="p-4 space-y-1">
                  <p className="text-sm font-semibold text-gray-900">Featured Speaker</p>
                  <p className="text-xs text-gray-600">Medical education webinar</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Featured Activities */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Featured Activities</h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
          </div>
        ) : featuredWebinars.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <p className="font-semibold text-gray-900">No webinars scheduled</p>
            <p className="mt-1 text-sm text-gray-600">Check back soon for upcoming sessions.</p>
            <Link
              to="/app/live"
              className="mt-4 inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
            >
              View Webinars
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {featuredWebinars.map((w, i) => (
                <WebinarCard key={w.id} webinar={w} imageIndex={i} />
              ))}
            </div>
            <div className="flex justify-center">
              <Link
                to="/app/live"
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-8 py-3 text-sm font-semibold text-white hover:bg-black"
              >
                See More <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function WebinarCard({ webinar, imageIndex }: { webinar: WebinarItem; imageIndex: number }) {
  const imgSrc = webinar.imageUrl || WEBINAR_PLACEHOLDER_IMAGES[imageIndex % WEBINAR_PLACEHOLDER_IMAGES.length];
  return (
    <Link
      to="/app/live"
      className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow block flex flex-col"
    >
      <div className="relative h-40">
        <img src={imgSrc} alt="" className="h-full w-full object-cover" loading="eager" referrerPolicy="no-referrer" />
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-gray-900">{webinar.title}</h3>
        <p className="text-sm text-gray-600 line-clamp-3 flex-1 mt-2">{webinar.description || 'Medical education webinar.'}</p>
        <span className="inline-flex w-fit rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black mt-4">
          Learn More
        </span>
      </div>
    </Link>
  );
}
