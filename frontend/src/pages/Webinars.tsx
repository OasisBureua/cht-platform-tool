import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Calendar, Clock, ChevronRight, Radio } from 'lucide-react';
import { format, isPast, formatDistanceToNow } from 'date-fns';
import { webinarsApi, type WebinarItem } from '../api/webinars';
import { programsApi } from '../api/programs';
import { useAuth } from '../contexts/AuthContext';
import { liveSessionListBadgeLabel } from '../utils/live-session-list-badge';

const WEBINAR_PLACEHOLDER_IMAGES = [
  '/images/iStock-1473559425-01131144-01b5-4e7d-9b15-f3db8846cad3.png',
  '/images/iStock-1667819272-cc7e9fde-feb0-4590-bb35-f5a86deba0dd.png',
  '/images/iStock-1917170353-5564763c-6ced-49b2-93ff-6a2261700399.png',
  '/images/iStock-1938555104-3986b580-5ef8-4aae-989f-05a2edd0bc12.png',
  '/images/iStock-2036497889-fae3ed6e-9859-4983-b3ec-7a489bb6fb95.png',
  '/images/iStock-1344792109-f418c5f0-d729-4965-8b2a-bfff4368cea3.png',
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

function formatHonorariumDollars(amount?: number): string | null {
  if (amount == null || amount <= 0) return null;
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function Webinars() {
  const { user } = useAuth();
  const userId = user?.userId;

  const { data: webinars = [], isLoading } = useQuery({
    queryKey: ['webinars'],
    queryFn: webinarsApi.list,
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
        <div className="flex items-center gap-2.5 text-gray-900">
          <Radio className="h-5 w-5 text-brand-700" strokeWidth={2} aria-hidden />
          <h1 className="text-balance text-2xl font-bold text-gray-900 md:text-3xl">LIVE</h1>
        </div>
        <p className="text-pretty text-sm text-gray-600">
          Real-time sessions. Open a session to complete the Jotform registration survey; after an administrator approves
          you, use <span className="font-medium text-gray-800">Join session</span> to open Zoom in your browser or the
          Zoom app. Honorarium payouts use Bill.com.
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
        </div>
      ) : webinars.length === 0 ? (
        <div className="rounded-2xl border border-gray-100/90 bg-white p-12 text-center shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.06)]">
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
              <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100/90 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.06)]">
                {upcoming.map((w, i) => (
                  <WebinarRow
                    key={w.id}
                    webinar={w}
                    imageUrl={w.imageUrl || WEBINAR_PLACEHOLDER_IMAGES[i % WEBINAR_PLACEHOLDER_IMAGES.length]}
                    listBadge={liveSessionListBadgeLabel(
                      w.registrationRequiresApproval,
                      statusByProgramId.get(w.id),
                    )}
                  />
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
              <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100/90 bg-white opacity-70 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.06)]">
                {past.map((w, i) => (
                  <WebinarRow
                    key={w.id}
                    webinar={w}
                    imageUrl={w.imageUrl || WEBINAR_PLACEHOLDER_IMAGES[i % WEBINAR_PLACEHOLDER_IMAGES.length]}
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

function WebinarRow({
  webinar: w,
  imageUrl,
  expired = false,
  listBadge,
}: {
  webinar: WebinarItem;
  imageUrl: string;
  expired?: boolean;
  listBadge?: string | null;
}) {
  const date = w.startTime ? new Date(w.startTime) : null;
  const honorariumLabel = formatHonorariumDollars(w.honorariumAmount);

  return (
    <Link
      to={`/app/live/${w.id}`}
      className="group flex items-center gap-3 px-4 py-3 transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-gray-50 active:scale-[0.995] sm:gap-4 sm:px-5"
    >
      {/* Left thumbnail (Replit-like row card structure) */}
      <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:h-16 sm:w-24">
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover outline outline-1 -outline-offset-1 outline-black/10"
          loading="lazy"
          referrerPolicy="no-referrer"
          draggable={false}
        />
      </div>

      {/* Info */}
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
          {expired && (
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

      {/* Right meta rail */}
      <div className="hidden shrink-0 flex-col items-end justify-center gap-1.5 text-right sm:flex">
        {honorariumLabel ? (
          <span className="tabular-nums text-xl font-bold leading-none text-zinc-900">{honorariumLabel}</span>
        ) : null}
        <span
          className={[
            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
            expired ? 'bg-zinc-100 text-zinc-500' : 'bg-amber-50 text-amber-800',
          ].join(' ')}
        >
          {expired ? 'Session passed' : 'Survey required'}
        </span>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 transition-[color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] group-hover:translate-x-0.5 group-hover:text-gray-600" />
    </Link>
  );
}
