import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import {
  Calendar,
  ChevronLeft,
  Clock,
  Download,
  ExternalLink,
  HardDrive,
  Link2,
  Loader2,
  Mail,
  Search,
  User,
  Users,
} from 'lucide-react';
import { adminApi } from '../../api/admin';
import { getApiErrorMessage } from '../../api/client';
import { ZoomRecordingFilesTable } from '../../components/admin/ZoomRecordingFilesTable';
import { ZoomAttendanceTable } from '../../components/admin/ZoomAttendanceTable';
import {
  Button,
  ZoomAlert,
  ZoomBackLink,
  ZoomLoadingState,
  ZoomSectionCard,
  ZoomStatusBadge,
} from '../../components/admin/zoom-recordings/ZoomRecordingsUi';
import TablePagination from '../../components/ui/TablePagination';

const ATTENDANCE_PAGE_SIZE = 10;

function MetaItem({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Calendar;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

export default function AdminZoomRecordingDetail() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [pullMessage, setPullMessage] = useState<string | null>(null);
  const [linkProgramId, setLinkProgramId] = useState('');
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const [attendanceMessage, setAttendanceMessage] = useState<string | null>(null);
  const [attendancePage, setAttendancePage] = useState(1);
  const [attendanceSearchInput, setAttendanceSearchInput] = useState('');
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState('');
  const [reportDownloading, setReportDownloading] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'zoom-recordings', 'session', sessionId],
    queryFn: () => adminApi.getZoomRecordingSession(sessionId!),
    enabled: !!sessionId,
  });

  const { data: programs } = useQuery({
    queryKey: ['admin', 'webinars', 'WEBINAR'],
    queryFn: () => adminApi.getWebinars({ zoomSessionType: 'WEBINAR' }),
    enabled: !!sessionId && !data?.session.linked,
  });

  const { data: attendance, isLoading: attendanceLoading, isFetching: attendanceFetching, refetch: refetchAttendance } = useQuery({
    queryKey: [
      'admin',
      'zoom-recordings',
      'session',
      sessionId,
      'attendance',
      attendancePage,
      attendanceSearchQuery,
    ],
    queryFn: () =>
      adminApi.listZoomSessionAttendance(sessionId!, {
        page: attendancePage,
        pageSize: ATTENDANCE_PAGE_SIZE,
        search: attendanceSearchQuery || undefined,
      }),
    enabled: !!sessionId,
    staleTime: 0,
  });

  const attendanceMatchesQuery =
    attendance != null &&
    (attendance.search ?? '') === attendanceSearchQuery.trim();
  const showAttendanceLoading = attendanceLoading || (attendanceFetching && !attendanceMatchesQuery);

  useEffect(() => {
    if (attendance && attendance.page !== attendancePage) {
      setAttendancePage(attendance.page);
    }
  }, [attendance, attendancePage]);

  const attendanceTotalPages = attendance
    ? Math.max(1, Math.ceil(attendance.total / attendance.pageSize))
    : 1;

  const attendanceImportMut = useMutation({
    mutationFn: () => adminApi.importZoomSessionAttendance(sessionId!),
    onSuccess: (res) => {
      setActionError(null);
      let message =
        `Imported ${res.participantsUpserted} participant${res.participantsUpserted === 1 ? '' : 's'}`;
      if (res.reportExported) {
        message += ` · report CSV saved to S3 (${res.reportParticipantCount ?? 0} rows)`;
      } else if (res.reportExportError) {
        message += ` · report export failed: ${res.reportExportError}`;
      }
      if (res.errors?.length) {
        message += ` (${res.errors.length} error(s))`;
      }
      setAttendanceMessage(message);
      setAttendancePage(1);
      void refetchAttendance();
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'zoom-recordings', 'session', sessionId],
      });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'zoom-recordings'] });
    },
    onError: (err) => {
      setAttendanceMessage(null);
      setActionError(getApiErrorMessage(err, 'Could not import attendees'));
    },
  });

  const pullMut = useMutation({
    mutationFn: () => adminApi.pullZoomRecordingSession(sessionId!),
    onSuccess: (res) => {
      setActionError(null);
      setPullMessage(
        `Pulled ${res.pulledCount} file${res.pulledCount === 1 ? '' : 's'} into S3` +
          (res.errors?.length ? ` (${res.errors.length} error(s))` : ''),
      );
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'zoom-recordings', 'session', sessionId],
      });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'zoom-recordings'] });
    },
    onError: (err) => {
      setPullMessage(null);
      setActionError(getApiErrorMessage(err, 'Could not pull recordings'));
    },
  });

  const linkMut = useMutation({
    mutationFn: (programId: string) =>
      adminApi.linkZoomRecordingSession(sessionId!, programId),
    onSuccess: () => {
      setActionError(null);
      setLinkMessage('Linked to Program.');
      setAttendancePage(1);
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'zoom-recordings', 'session', sessionId],
      });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'zoom-recordings'] });
      void refetchAttendance();
    },
    onError: (err) => {
      setLinkMessage(null);
      setActionError(getApiErrorMessage(err, 'Could not link session'));
    },
  });

  const openRecording = async (fileId: string, mode: 'view' | 'download') => {
    setActionError(null);
    try {
      const { url, recording } = await adminApi.getZoomRecordingCatalogDownloadUrl(
        sessionId!,
        fileId,
        mode === 'view' ? 'inline' : 'attachment',
      );
      if (mode === 'download') {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${recording.fileType.toLowerCase()}-${recording.zoomRecordingFileId}.${recording.fileExtension || 'bin'}`;
        a.rel = 'noopener';
        a.click();
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not get download URL'));
    }
  };

  const downloadAttendanceReport = async () => {
    setActionError(null);
    setReportDownloading(true);
    try {
      const { url, filename } = await adminApi.getZoomSessionAttendanceReportDownloadUrl(
        sessionId!,
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      a.click();
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not download attendee report'));
    } finally {
      setReportDownloading(false);
    }
  };

  if (isLoading) {
    return <ZoomLoadingState label="Loading session details…" />;
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <ZoomBackLink to="/admin/programs/zoom-recordings">
          <ChevronLeft className="h-4 w-4" />
          Back to catalog
        </ZoomBackLink>
        <ZoomAlert tone="error" title="Session not found">
          {getApiErrorMessage(error, 'This recording session could not be loaded.')}
        </ZoomAlert>
      </div>
    );
  }

  const { session, files } = data;
  const filesComplete =
    session.filesInS3Count > 0 && session.filesInS3Count >= session.fileCount;

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="space-y-4">
        <ZoomBackLink to="/admin/programs/zoom-recordings">
          <ChevronLeft className="h-4 w-4" />
          Zoom Recordings
        </ZoomBackLink>

        <div className="rounded-card bg-card p-5 shadow-card md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {session.linked ? (
                  <ZoomStatusBadge tone="success" icon={Link2}>
                    Linked to program
                  </ZoomStatusBadge>
                ) : (
                  <ZoomStatusBadge tone="warning" icon={Link2}>
                    Zoom only
                  </ZoomStatusBadge>
                )}
                {session.attendeesImported ? (
                  <ZoomStatusBadge tone="success" icon={Users}>
                    Attendees imported
                    {(session.attendeeImportCount ?? 0) > 0
                      ? ` · ${session.attendeeImportCount}`
                      : ''}
                  </ZoomStatusBadge>
                ) : null}
                {filesComplete ? (
                  <ZoomStatusBadge tone="success" icon={HardDrive}>
                    All files in S3
                  </ZoomStatusBadge>
                ) : session.fileCount > 0 ? (
                  <ZoomStatusBadge tone="neutral" icon={HardDrive}>
                    {session.filesInS3Count}/{session.fileCount} in S3
                  </ZoomStatusBadge>
                ) : null}
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                  {session.topic?.trim() || 'Untitled session'}
                </h2>
                <p className="mt-1 font-mono text-sm text-muted-foreground">
                  Meeting ID {session.zoomMeetingId}
                </p>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {session.filesInS3Count > 0 ? (
                  <>
                    <strong className="font-medium text-foreground">{session.filesInS3Count}</strong> of{' '}
                    {session.fileCount} files are stored in S3 and ready for view or download.
                    {session.filesInS3Count < session.fileCount
                      ? ' Pull from Zoom to fetch the remaining files.'
                      : null}
                  </>
                ) : (
                  <>
                    <strong className="font-medium text-foreground">{session.fileCount}</strong> file
                    {session.fileCount === 1 ? '' : 's'} indexed from Sync. Pull from Zoom to download
                    into S3 before viewing or downloading.
                  </>
                )}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                variant="solid"
                size="sm"
                onClick={() => {
                  setPullMessage(null);
                  setActionError(null);
                  pullMut.mutate();
                }}
                disabled={pullMut.isPending}
              >
                {pullMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {pullMut.isPending ? 'Pulling…' : 'Pull from Zoom'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAttendanceMessage(null);
                  setActionError(null);
                  attendanceImportMut.mutate();
                }}
                disabled={attendanceImportMut.isPending || data.zoomConfigured === false}
              >
                {attendanceImportMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Users className="h-4 w-4" />
                )}
                {attendanceImportMut.isPending
                  ? 'Importing…'
                  : session.attendeesImported
                    ? 'Re-import attendees'
                    : 'Import attendees'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-card bg-card p-4 shadow-card">
          <MetaItem icon={Calendar} label="Start time">
            {session.startTime
              ? format(parseISO(session.startTime), 'MMM d, yyyy · h:mm a')
              : '—'}
          </MetaItem>
        </div>
        <div className="rounded-card bg-card p-4 shadow-card">
          <MetaItem icon={Mail} label="Host">
            {session.hostEmail || '—'}
          </MetaItem>
        </div>
        <div className="rounded-card bg-card p-4 shadow-card">
          <MetaItem icon={Clock} label="Last synced">
            {format(parseISO(session.lastSyncedAt), 'MMM d, yyyy · h:mm a')}
          </MetaItem>
        </div>
        <div className="rounded-card bg-card p-4 shadow-card">
          <MetaItem icon={User} label="Program">
            {session.linked && session.programId ? (
              <Link
                to={`/admin/programs/${session.programId}/hub`}
                className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline dark:text-brand-300"
              >
                {session.programTitle || 'Program Hub'}
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <span className="text-muted-foreground">Not linked</span>
            )}
            {session.chmProgramId ? (
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">{session.chmProgramId}</p>
            ) : null}
          </MetaItem>
        </div>
      </div>

      {!data.storageConfigured || !data.zoomConfigured ? (
        <div className="space-y-3">
          {!data.storageConfigured ? (
            <ZoomAlert tone="warning" title="S3 not configured">
              Pull will fail until SESSION_ASSETS_S3_BUCKET is set on this server.
            </ZoomAlert>
          ) : null}
          {!data.zoomConfigured ? (
            <ZoomAlert tone="warning" title="Zoom API not configured">
              Sync, pull, and attendee import require Zoom credentials.
            </ZoomAlert>
          ) : null}
        </div>
      ) : null}

      {!session.linked ? (
        <ZoomSectionCard
          title="Link to CHT Program"
          description="Connect this Zoom session to a program so attendance can flow into Program Hub."
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-sm font-medium text-foreground">
              Program
              <select
                value={linkProgramId}
                onChange={(e) => setLinkProgramId(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-[6px] bg-muted/50 px-3 text-sm text-foreground shadow-inner focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <option value="">Select a program…</option>
                {(programs ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                    {p.zoomMeetingId ? ` (${p.zoomMeetingId})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="solid"
              size="sm"
              disabled={!linkProgramId || linkMut.isPending}
              onClick={() => linkMut.mutate(linkProgramId)}
            >
              {linkMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {linkMut.isPending ? 'Linking…' : 'Link program'}
            </Button>
          </div>
        </ZoomSectionCard>
      ) : null}

      <div className="space-y-3">
        {pullMessage ? <ZoomAlert tone="success">{pullMessage}</ZoomAlert> : null}
        {linkMessage ? <ZoomAlert tone="success">{linkMessage}</ZoomAlert> : null}
        {attendanceMessage ? <ZoomAlert tone="success">{attendanceMessage}</ZoomAlert> : null}
        {actionError ? <ZoomAlert tone="error">{actionError}</ZoomAlert> : null}
      </div>

      <ZoomSectionCard
        title="Attendees"
        description={
          session.linked
            ? 'Participant list from Zoom Report API. Registration matches appear when email aligns with a CHT registration.'
            : 'Staged until linked to a program. Program Hub shows matches after link.'
        }
        action={
          session.attendeeReportStoredInS3 ? (
            <div className="flex flex-col items-end gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void downloadAttendanceReport()}
                disabled={reportDownloading}
              >
                {reportDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {reportDownloading ? 'Preparing…' : 'Download CSV'}
              </Button>
              {session.attendeeReportExportedAt ? (
                <p className="text-[11px] text-muted-foreground">
                  {session.attendeeReportParticipantCount ?? 0} rows ·{' '}
                  {format(parseISO(session.attendeeReportExportedAt), 'MMM d, yyyy h:mm a')}
                </p>
              ) : null}
            </div>
          ) : undefined
        }
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {attendanceMatchesQuery && attendance?.total != null ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium tabular-nums text-foreground">{attendance.total}</span>{' '}
              participant{attendance.total === 1 ? '' : 's'}
            </p>
          ) : (
            <span />
          )}
          <form
            className="relative w-full max-w-sm sm:w-auto sm:min-w-[280px]"
            onSubmit={(e) => {
              e.preventDefault();
              setAttendanceSearchQuery(attendanceSearchInput.trim());
              setAttendancePage(1);
            }}
          >
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={attendanceSearchInput}
              onChange={(e) => setAttendanceSearchInput(e.target.value)}
              placeholder="Search name, email, or participant ID…"
              className="h-10 w-full rounded-[6px] bg-muted/50 py-2 pl-9 pr-3 text-sm text-foreground shadow-inner placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label="Search attendees"
            />
          </form>
        </div>
        <ZoomAttendanceTable
          participants={attendanceMatchesQuery ? (attendance?.participants ?? []) : []}
          isLoading={showAttendanceLoading}
          showRegistrationMatch={session.linked}
          emptyMessage={
            attendanceSearchQuery
              ? 'No attendees match your search.'
              : session.attendeesImported
                ? 'No attendees match your filters.'
                : 'No attendees imported yet. Click Import attendees above to pull participant lists from Zoom.'
          }
        />
        <div className="mt-4">
          <TablePagination
            page={attendancePage}
            totalPages={attendanceTotalPages}
            totalItems={attendanceMatchesQuery ? attendance?.total : undefined}
            itemLabel={`attendee${attendance?.total === 1 ? '' : 's'}`}
            onPageChange={setAttendancePage}
          />
        </div>
      </ZoomSectionCard>

      <ZoomSectionCard
        title="Recording files"
        description="Cloud recording files indexed from Zoom. Pull stores them in S3 for view and download."
      >
        <ZoomRecordingFilesTable
          recordings={files}
          emptyMessage="No files indexed yet. Run Sync from Zoom on the catalog, then Pull here."
          onView={(id) => void openRecording(id, 'view')}
          onDownload={(id) => void openRecording(id, 'download')}
        />
      </ZoomSectionCard>
    </div>
  );
}
