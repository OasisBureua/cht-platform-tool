import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Calendar, Clock, ChevronRight } from 'lucide-react';
import { format, isPast, formatDistanceToNow } from 'date-fns';
import { webinarsApi, type WebinarItem } from '../api/webinars';

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

export default function Webinars() {
  const { data: webinars = [], isLoading } = useQuery({
    queryKey: ['webinars'],
    queryFn: webinarsApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const { upcoming, past } = useMemo(() => {
    const withDate = (w: WebinarItem) => (w.startTime ? new Date(w.startTime).getTime() : 0);
    const upcomingList = webinars
      .filter((w) => !isExpired(w))
      .sort((a, b) => withDate(a) - withDate(b));
    const pastList = webinars
      .filter((w) => isExpired(w))
      .sort((a, b) => withDate(b) - withDate(a));
    return { upcoming: upcomingList, past: pastList };
  }, [webinars]);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">LIVE</h1>
        <p className="text-sm text-gray-600">
          Real-time sessions. Open a session to complete the Jotform registration survey; after an administrator
          approves you, use <span className="font-medium text-gray-800">Join session</span> to open Zoom in your browser
          or the Zoom app. Honorarium payouts use Bill.com.
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
        </div>
      ) : webinars.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
          <p className="font-semibold text-gray-900">No LIVE sessions scheduled</p>
          <p className="mt-1 text-sm text-gray-600">Check back soon for upcoming sessions.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Upcoming · {upcoming.length}
              </h2>
              <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {upcoming.map((w) => (
                  <WebinarRow key={w.id} webinar={w} />
                ))}
              </div>
            </section>
          )}

          {/* Past / Expired */}
          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Past · {past.length}
              </h2>
              <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden opacity-70">
                {past.map((w) => (
                  <WebinarRow key={w.id} webinar={w} expired />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function WebinarRow({ webinar: w, expired = false }: { webinar: WebinarItem; expired?: boolean }) {
  const date = w.startTime ? new Date(w.startTime) : null;

  return (
    <Link
      to={`/app/live/${w.id}`}
      className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
    >
      {/* Date block */}
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

      {/* Divider */}
      <div className="w-px h-10 bg-gray-200 shrink-0" />

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={['font-semibold truncate', expired ? 'text-gray-500' : 'text-gray-900'].join(' ')}>
            {w.title}
          </p>
          {expired && (
            <span className="shrink-0 rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
              Expired
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
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
          {w.duration && (
            <span>{formatDuration(w.duration)}</span>
          )}
        </div>
        {w.description && (
          <p className="text-xs text-gray-500 line-clamp-1">{w.description}</p>
        )}
      </div>

      {/* Arrow */}
      <ChevronRight className="h-4 w-4 text-gray-400 shrink-0 group-hover:text-gray-600 transition-colors" />
    </Link>
  );
}
