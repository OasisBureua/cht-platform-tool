import { useEffect, useRef, useState } from 'react';
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
import { ZoomSessionSurveysSection } from '../../components/admin/ZoomSessionSurveysSection';
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
  const [pullIsRefresh, setPullIsRefresh] = useState(false);
  const [pullingFileId, setPullingFileId] = useState<string | null>(null);
  const pullIsRefreshRef = useRef(false);
  const filesSectionRef = useRef<HTMLDivElement | null>(null);

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
    onMutate: () => {
      setPullMessage(null);
      setActionError(null);
      // Keep the files section in view so status changes are obvious.
      filesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    onSuccess: (res) => {
      setActionError(null);
      const errorCount = res.errors?.length ?? 0;
      const wasRefresh = pullIsRefreshRef.current;
      setPullMessage(
        errorCount > 0
          ? `Pull finished: ${res.pulledCount} file${res.pulledCount === 1 ? '' : 's'} uploaded to S3, ${errorCount} failed.`
          : wasRefresh
            ? `Refresh complete: ${res.pulledCount} file${res.pulledCount === 1 ? '' : 's'} re-checked and stored in S3.`
            : `Pull complete: ${res.pulledCount} file${res.pulledCount === 1 ? '' : 's'} uploaded to S3. View and Download are ready.`,
      );
      pullIsRefreshRef.current = false;
      setPullIsRefresh(false);
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'zoom-recordings', 'session', sessionId],
      });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'zoom-recordings'] });
    },
    onError: (err) => {
      setPullMessage(null);
      pullIsRefreshRef.current = false;
      setPullIsRefresh(false);
      setActionError(getApiErrorMessage(err, 'Could not pull recordings'));
    },
  });

  const pullFileMut = useMutation({
    mutationFn: (file: { id: string; zoomRecordingFileId: string; fileType: string }) =>
      adminApi.pullZoomRecordingSession(sessionId!, {
        zoomRecordingFileIds: [file.zoomRecordingFileId],
      }),
    onMutate: (file) => {
      setPullingFileId(file.id);
      setPullMessage(null);
      setActionError(null);
    },
    onSuccess: (res, file) => {
      setPullingFileId(null);
      setActionError(null);
      const errorCount = res.errors?.length ?? 0;
      setPullMessage(
        errorCount > 0
          ? `Could not pull ${file.fileType}: ${res.errors?.[0] ?? 'upload failed'}`
          : `${file.fileType} pulled to S3.`,
      );
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'zoom-recordings', 'session', sessionId],
      });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'zoom-recordings'] });
    },
    onError: (err) => {
      setPullingFileId(null);
      setPullMessage(null);
      setActionError(getApiErrorMessage(err, 'Could not pull this file'));
    },
  });

  const pullInFlight = pullMut.isPending || pullFileMut.isPending;

  // While Pull is running, poll session detail so file rows flip to
  // "Uploading to S3" / "Upload completed" as the backend marks each file.
  useEffect(() => {
    if (!pullInFlight || !sessionId) return;
    const tick = () => {
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'zoom-recordings', 'session', sessionId],
      });
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => window.clearInterval(id);
  }, [pullInFlight, sessionId, queryClient]);

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
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'zoom-recordings', 'session', sessionId, 'surveys'],
      });
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
  // Same rule as catalog list: file is "in S3" only when storedInS3 is true.
  const filesReadyCount = files.filter((f) => f.storedInS3 === true).length;
  const filesComplete = files.length > 0 && filesReadyCount >= files.length;

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
                ) : filesReadyCount > 0 ? (
                  <ZoomStatusBadge tone="neutral" icon={HardDrive}>
                    {filesReadyCount}/{files.length || session.fileCount} in S3
                  </ZoomStatusBadge>
                ) : session.fileCount > 0 ? (
                  <ZoomStatusBadge tone="neutral" icon={HardDrive}>
                    {session.fileCount} indexed
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
                {filesReadyCount > 0 ? (
                  <>
                    <strong className="font-medium text-foreground">{filesReadyCount}</strong> of{' '}
                    {files.length || session.fileCount} files are stored in S3 and ready for view or
                    download.
                    {!filesComplete
                      ? ' Use Pull from Zoom to fetch the remaining files.'
                      : null}
                  </>
                ) : (
                  <>
                    <strong className="font-medium text-foreground">
                      {files.length || session.fileCount}
                    </strong>{' '}
                    file
                    {(files.length || session.fileCount) === 1 ? '' : 's'} indexed from Sync. Pull
                    from Zoom to download into S3 before viewing or downloading.
                  </>
                )}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                variant="solid"
                size="sm"
                onClick={() => {
                  pullIsRefreshRef.current = filesComplete;
                  setPullIsRefresh(filesComplete);
                  pullMut.mutate();
                }}
                disabled={
                  pullInFlight ||
                  data.zoomConfigured === false ||
                  data.storageConfigured === false
                }
                title={
                  pullMut.isPending
                    ? pullIsRefresh
                      ? 'Refresh in progress — existing files stay available'
                      : 'Pull in progress — watch the Recording files section below'
                    : pullFileMut.isPending
                      ? 'Wait for the single-file pull to finish'
                    : filesComplete
                      ? 'Re-download all files from Zoom into S3 (refresh)'
                      : 'Fetch transcripts and recordings from Zoom into S3'
                }
              >
                {pullMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {pullMut.isPending
                  ? pullIsRefresh
                    ? 'Refreshing from Zoom…'
                    : 'Pulling from Zoom…'
                  : filesComplete
                    ? 'Re-pull from Zoom'
                    : 'Pull from Zoom'}
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

      <ZoomSessionSurveysSection
        sessionId={sessionId!}
        linked={session.linked}
        programId={session.programId}
        programTitle={session.programTitle}
      />

      <div ref={filesSectionRef}>
        <ZoomSectionCard
          title="Recording files"
          description={
            filesComplete
              ? 'Files are stored in S3. View and Download are available. Use Re-pull from Zoom only if you need to refresh from Zoom.'
              : 'Cloud recording files indexed from Zoom. View and Download stay disabled until each file is pulled into S3.'
          }
        >
          {pullMut.isPending ? (
            <div className="mb-4">
              {pullIsRefresh ? (
                <ZoomAlert tone="info" title="Refreshing from Zoom">
                  Re-downloading files from Zoom into S3. This can take several minutes for large
                  MP4s. Files that are already uploaded stay available for View and Download while
                  the refresh runs.
                  {files.length > 0 ? (
                    <>
                      {' '}
                      Progress:{' '}
                      <strong className="font-medium text-foreground">
                        {filesReadyCount}/{files.length}
                      </strong>{' '}
                      currently marked complete.
                    </>
                  ) : null}
                </ZoomAlert>
              ) : (
                <ZoomAlert tone="info" title="Pull in progress">
                  Fetching files from Zoom and uploading them to S3. Large MP4s can take several
                  minutes. Status for each file updates below — keep this page open until the pull
                  finishes.
                  {files.length > 0 ? (
                    <>
                      {' '}
                      Progress:{' '}
                      <strong className="font-medium text-foreground">
                        {filesReadyCount}/{files.length}
                      </strong>{' '}
                      in S3.
                    </>
                  ) : null}
                </ZoomAlert>
              )}
            </div>
          ) : null}

          {pullFileMut.isPending ? (
            <div className="mb-4">
              <ZoomAlert tone="info" title="Pulling one file">
                Fetching a single file from Zoom into S3. Other files are unchanged. View and
                Download stay available for files already uploaded.
              </ZoomAlert>
            </div>
          ) : null}

          {!pullInFlight && filesComplete ? (
            <div className="mb-4">
              <ZoomAlert tone="success" title="All files in S3">
                {filesReadyCount}/{files.length} files are stored. You can view or download them
                below. Re-run Pull from Zoom if you need to refresh from Zoom.
              </ZoomAlert>
            </div>
          ) : null}

          {!pullInFlight && files.length > 0 && !filesComplete ? (
            <div className="mb-4">
              <ZoomAlert tone="warning" title="Files not ready to view yet">
                {filesReadyCount > 0 ? (
                  <>
                    {filesReadyCount}/{files.length} files are in S3. Click{' '}
                    <strong>Pull from Zoom</strong> at the top to fetch the remaining files.
                    View and Download are available for files that already show Upload completed.
                  </>
                ) : (
                  <>
                    Sync only indexes metadata. Click <strong>Pull from Zoom</strong> at the top
                    of this page to fetch transcripts, recordings, and related files into S3.
                    After a successful pull, View and Download become available for each uploaded
                    file.
                  </>
                )}
              </ZoomAlert>
            </div>
          ) : null}

          <ZoomRecordingFilesTable
            recordings={files}
            isPulling={pullMut.isPending}
            pullingFileId={pullingFileId}
            emptyMessage="No files indexed yet. Run Sync from Zoom on the catalog, then open this session and click Pull from Zoom."
            onView={(id) => void openRecording(id, 'view')}
            onDownload={(id) => void openRecording(id, 'download')}
            onPullFile={(file) =>
              pullFileMut.mutate({
                id: file.id,
                zoomRecordingFileId: file.zoomRecordingFileId,
                fileType: file.fileType,
              })
            }
          />
        </ZoomSectionCard>
      </div>
    </div>
  );
}
