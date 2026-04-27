import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Calendar, Clock, ChevronRight } from 'lucide-react';
import { format, isPast, formatDistanceToNow } from 'date-fns';
import { webinarsApi, type WebinarItem } from '../api/webinars';
import { programsApi } from '../api/programs';
import { useAuth } from '../contexts/AuthContext';
import { liveSessionListBadgeLabel } from '../utils/live-session-list-badge';

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

export default function OfficeHours() {
  const { user } = useAuth();
  const userId = user?.userId;

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['office-hours'],
    queryFn: webinarsApi.listOfficeHours,
    staleTime: 5 * 60 * 1000,
  });

  const { data: liveStatuses = [] } = useQuery({
    queryKey: ['programs', 'me', 'live-session-status'],
    queryFn: () => programsApi.getMyLiveSessionStatus(),
    enabled: !!userId,
    staleTime: 60 * 1000,
  });

  const statusByProgramId = useMemo(() => {
    const m = new Map<string, (typeof liveStatuses)[0]>();
    for (const s of liveStatuses) m.set(s.programId, s);
    return m;
  }, [liveStatuses]);

  const { upcoming, past } = useMemo(() => {
    const withDate = (w: WebinarItem) => (w.startTime ? new Date(w.startTime).getTime() : 0);
    const upcomingList = sessions
      .filter((w) => !isExpired(w))
      .sort((a, b) => withDate(a) - withDate(b));
    const pastList = sessions
      .filter((w) => isExpired(w))
      .sort((a, b) => withDate(b) - withDate(a));
    return { upcoming: upcomingList, past: pastList };
  }, [sessions]);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-balance text-2xl font-bold text-gray-900 md:text-3xl">CHM Office Hours</h1>
        <p className="text-pretty text-sm text-gray-600">
          Get time with our experts — live sessions for Q&amp;A. Select an available time slot and join from here when
          it&apos;s time.
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl border border-gray-100/90 bg-white p-12 text-center shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.06)]">
          <p className="font-semibold text-gray-900">No CHM Office Hours scheduled</p>
          <p className="mt-1 text-sm text-gray-600">Check back soon for upcoming sessions.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Upcoming · {upcoming.length}
              </h2>
              <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100/90 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.06)]">
                {upcoming.map((w) => (
                  <SessionRow
                    key={w.id}
                    session={w}
                    listBadge={liveSessionListBadgeLabel(
                      w.registrationRequiresApproval,
                      statusByProgramId.get(w.id),
                    )}
                  />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Past · {past.length}
              </h2>
              <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100/90 bg-white opacity-70 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.06)]">
                {past.map((w) => (
                  <SessionRow
                    key={w.id}
                    session={w}
                    expired
                    listBadge={liveSessionListBadgeLabel(
                      w.registrationRequiresApproval,
                      statusByProgramId.get(w.id),
                    )}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function SessionRow({
  session: w,
  expired = false,
  listBadge,
}: {
  session: WebinarItem;
  expired?: boolean;
  listBadge?: string | null;
}) {
  const date = w.startTime ? new Date(w.startTime) : null;

  return (
    <Link
      to={`/app/chm-office-hours/${w.id}`}
      className="group flex items-center gap-4 px-5 py-4 transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-gray-50 active:scale-[0.995]"
    >
      <div className="shrink-0 w-12 text-center">
        {date ? (
          <>
            <p className="text-xs font-semibold text-gray-500 uppercase">{format(date, 'MMM')}</p>
            <p className="text-2xl font-bold leading-none text-gray-900 tabular-nums">{format(date, 'd')}</p>
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
          {listBadge ? (
            <span className="shrink-0 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-900">
              {listBadge}
            </span>
          ) : null}
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

      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 transition-[color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] group-hover:translate-x-0.5 group-hover:text-gray-600" />
    </Link>
  );
}
