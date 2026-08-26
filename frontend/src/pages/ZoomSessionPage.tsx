import { useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { ZoomEmbed } from '../components/zoom/ZoomEmbed';
import { webinarsApi } from '../api/webinars';
import { programsApi } from '../api/programs';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';

/**
 * Full-viewport Zoom Meeting SDK session (participant or admin host).
 * Query: `?host=1` starts as Zoom host (ADMIN only).
 * Optional `?returnTo=` absolute path for Back (e.g. Program Hub).
 */
export default function ZoomSessionPage({
  sessionKind,
}: {
  sessionKind: 'WEBINAR' | 'MEETING';
}) {
  const { id } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const asHost = search.get('host') === '1' || search.get('host') === 'true';
  const returnTo = search.get('returnTo')?.trim() || '';
  const { user } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'ADMIN';
  const hostRequested = asHost && isAdmin;

  const defaultBack =
    sessionKind === 'MEETING'
      ? `/app/chm-office-hours/${id}`
      : `/app/live/${id}`;
  const backTo =
    returnTo.startsWith('/') && !returnTo.startsWith('//')
      ? returnTo
      : defaultBack;

  const programQuery = useQuery({
    queryKey: ['programs', 'detail', id],
    queryFn: () => programsApi.getById(id!),
    enabled: !!id,
  });

  const title =
    programQuery.data?.title ||
    (sessionKind === 'MEETING' ? 'Office Hours' : 'Live webinar');

  const joinUrlFallback = useMemo(() => {
    const p = programQuery.data;
    if (!p) return undefined;
    if (hostRequested && p.zoomStartUrl?.trim()) return p.zoomStartUrl.trim();
    return p.zoomJoinUrl?.trim() || undefined;
  }, [programQuery.data, hostRequested]);

  const goBack = () => {
    // Prefer an explicit in-app return path so Back never lands on a blank history entry.
    navigate(backTo, { replace: true });
  };

  if (!id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <p>Missing session id.</p>
      </div>
    );
  }

  if (asHost && !isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-950 px-4 text-center text-white">
        <p>Only administrators can start as Zoom host.</p>
        <Link to={backTo} className="text-sm underline text-gray-300">
          Back to session
        </Link>
      </div>
    );
  }

  if (programQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-gray-950 text-white">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-white/10 px-3 sm:px-4">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-sm font-medium text-gray-200 hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="truncate text-[11px] text-white/70">
            {hostRequested ? 'Starting as Zoom host' : 'In-browser Zoom session'}
          </p>
        </div>
      </header>

      <main className="min-h-0 flex-1 p-2 sm:p-3">
        <ZoomEmbed
          layout="fill"
          autoJoin
          joinLabel={hostRequested ? 'Start as host in browser' : 'Join in browser'}
          leaveLabel={hostRequested ? 'End host session' : 'Leave session'}
          joinUrlFallback={joinUrlFallback}
          hint={
            hostRequested
              ? 'Starts this Zoom session as host inside CHT. Learners join after you start.'
              : undefined
          }
          fetchAuth={() =>
            sessionKind === 'MEETING'
              ? webinarsApi.getMeetingSdkAuth(id, { asHost: hostRequested })
              : webinarsApi.getWebinarMeetingSdkAuth(id, {
                  asHost: hostRequested,
                })
          }
          reportAttendance={
            hostRequested
              ? undefined
              : (event) =>
                  sessionKind === 'MEETING'
                    ? webinarsApi.reportOfficeHoursSdkAttendance(id, event)
                    : webinarsApi.reportWebinarSdkAttendance(id, event)
          }
        />
      </main>
    </div>
  );
}
