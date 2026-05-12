import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Calendar, Clock, ChevronRight } from 'lucide-react';
import { format, isPast, formatDistanceToNow } from 'date-fns';
import { webinarsApi, type WebinarItem } from '../../api/webinars';

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

export default function PublicOfficeHours() {
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['office-hours', 'public'],
    queryFn: webinarsApi.listOfficeHours,
    staleTime: 5 * 60 * 1000,
  });

  const { upcoming, past } = useMemo(() => {
    const withDate = (w: WebinarItem) => (w.startTime ? new Date(w.startTime).getTime() : 0);
    const upcomingList = sessions.filter((w) => !isExpired(w)).sort((a, b) => withDate(a) - withDate(b));
    const pastList = sessions.filter((w) => isExpired(w)).sort((a, b) => withDate(b) - withDate(a));
    return { upcoming: upcomingList, past: pastList };
  }, [sessions]);

  return (
    <div className="bg-white min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10 md:py-14 space-y-8">
        <header className="space-y-1">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">CHM Office Hours</h1>
          <p className="text-sm text-gray-600 max-w-2xl md:text-base">
            Live sessions — click any session to register and join.
          </p>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <p className="text-lg font-semibold text-gray-900">No CHM Office Hours scheduled</p>
            <p className="mt-1 text-base text-gray-600">Check back soon for upcoming sessions.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {upcoming.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Upcoming · {upcoming.length}
                </h2>
                <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                  {upcoming.map((w) => (
                    <SessionRow key={w.id} session={w} />
                  ))}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Past · {past.length}
                </h2>
                <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden opacity-70">
                  {past.map((w) => (
                    <SessionRow key={w.id} session={w} expired />
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

function SessionRow({ session: w, expired = false }: { session: WebinarItem; expired?: boolean }) {
  const date = w.startTime ? new Date(w.startTime) : null;

  return (
    <Link
      to={`/chm-office-hours/${w.id}`}
      className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
    >
      <div className="shrink-0 w-12 text-center">
        {date ? (
          <>
            <p className="text-xs font-semibold text-gray-500 uppercase">{format(date, 'MMM')}</p>
            <p className="text-2xl font-bold text-gray-900 leading-none">{format(date, 'd')}</p>
          </>
        ) : (
          <p className="text-xs text-gray-400">TBD</p>
        )}
      </div>

      <div className="w-px h-10 bg-gray-200 shrink-0" />

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={['font-semibold truncate', expired ? 'text-gray-500' : 'text-gray-900'].join(' ')}>
            {w.title}
          </p>
          {w.hostDisplayName ? (
            <span className="text-xs font-medium text-gray-600 shrink-0">· Get time with {w.hostDisplayName}</span>
          ) : null}
          {expired && (
            <span className="shrink-0 rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
              Ended
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 tabular-nums">
          {date && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(date, 'EEE, MMM d, yyyy')}
              {!expired && (
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
          {w.duration && <span>{formatDuration(w.duration)}</span>}
        </div>
        {w.description && (
          <p className="text-xs text-gray-500 line-clamp-1">{w.description}</p>
        )}
      </div>

      <ChevronRight className="h-4 w-4 text-gray-400 shrink-0 group-hover:text-gray-600 transition-colors" />
    </Link>
  );
}
