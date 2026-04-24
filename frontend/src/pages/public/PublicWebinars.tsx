import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Calendar, Clock } from 'lucide-react';
import { format, isPast, isFuture, subMonths, formatDistanceToNow } from 'date-fns';
import { webinarsApi } from '../../api/webinars';

type WebinarRow = {
  id: string;
  title: string;
  description: string;
  startTime?: string;
  duration?: number;
};

export default function PublicWebinars() {
  const { data: webinars = [], isLoading } = useQuery({
    queryKey: ['webinars'],
    queryFn: webinarsApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const { upcoming, recent } = useMemo(() => {
    const now = new Date();
    const oneMonthAgo = subMonths(now, 1);

    const upcoming = webinars
      .filter((w) => w.startTime && isFuture(new Date(w.startTime)))
      .sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime());

    const recent = webinars
      .filter((w) => {
        if (!w.startTime) return false;
        const d = new Date(w.startTime);
        return isPast(d) && d >= oneMonthAgo;
      })
      .sort((a, b) => new Date(b.startTime!).getTime() - new Date(a.startTime!).getTime());

    return { upcoming, recent };
  }, [webinars]);

  return (
    <div className="bg-white min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10 md:py-14 space-y-10 md:space-y-14">
        <header>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">LIVE</h1>
          <p className="mt-2 text-sm text-gray-600">Live and upcoming sessions - click any webinar to register and join.</p>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
          </div>
        ) : upcoming.length === 0 && recent.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <p className="font-semibold text-gray-900">No LIVE sessions available</p>
            <p className="mt-1 text-sm text-gray-600">Check back soon for upcoming sessions.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {upcoming.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Upcoming · {upcoming.length}
                </h2>
                <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                  {upcoming.map((w) => (
                    <WebinarCard key={w.id} webinar={w} />
                  ))}
                </div>
              </section>
            )}

            {recent.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Recent · last 30 days · {recent.length}
                </h2>
                <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden opacity-80">
                  {recent.map((w) => (
                    <WebinarCard key={w.id} webinar={w} past />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function WebinarCard({ webinar, past = false }: { webinar: WebinarRow; past?: boolean }) {
  const date = webinar.startTime ? new Date(webinar.startTime) : null;

  return (
    <Link
      to={`/live/${webinar.id}`}
      className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
    >
      {/* Date block */}
      <div className="shrink-0 w-12 text-center">
        {date ? (
          <>
            <p className="text-xs font-semibold uppercase text-gray-500">{format(date, 'MMM')}</p>
            <p className="text-2xl font-bold leading-none text-gray-900">{format(date, 'd')}</p>
          </>
        ) : (
          <p className="text-xs text-gray-400">TBD</p>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-10 shrink-0 bg-gray-200" />

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={['font-semibold truncate', past ? 'text-gray-500' : 'text-gray-900'].join(' ')}>
            {webinar.title}
          </p>
          {past && (
            <span className="shrink-0 rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
              Expired
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 tabular-nums">
          {date && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(date, 'EEE, MMM d, yyyy')}
              {!past && (
                <span className="text-gray-400">· {formatDistanceToNow(date, { addSuffix: true })}</span>
              )}
            </span>
          )}
          {date && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(date, 'h:mm a')}
            </span>
          )}
          {webinar.duration && (
            <span>
              {webinar.duration < 60
                ? `${webinar.duration} min`
                : `${Math.floor(webinar.duration / 60)}h${webinar.duration % 60 ? ` ${webinar.duration % 60}m` : ''}`}
            </span>
          )}
        </div>
        {webinar.description && (
          <p className="text-xs text-gray-500 line-clamp-1">{webinar.description}</p>
        )}
      </div>

      {/* Arrow */}
      <span className="shrink-0 text-gray-400 group-hover:text-gray-600 transition-colors text-lg">›</span>
    </Link>
  );
}
