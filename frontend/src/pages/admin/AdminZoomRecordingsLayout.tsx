import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Outlet } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Cloud, Loader2, RefreshCw, Users, Video, X } from 'lucide-react';
import { adminApi, type ZoomAttendanceImportJob, type ZoomSyncJob } from '../../api/admin';
import { getApiErrorMessage } from '../../api/client';
import {
  Button,
  ZoomAlert,
  ZoomFilterTabs,
  ZoomJobBanner,
} from '../../components/admin/zoom-recordings/ZoomRecordingsUi';

const SYNC_POLL_MS = 2500;

function syncInProgress(job: ZoomSyncJob | null | undefined): boolean {
  return job?.status === 'QUEUED' || job?.status === 'RUNNING';
}

function importInProgress(job: ZoomAttendanceImportJob | null | undefined): boolean {
  return job?.status === 'QUEUED' || job?.status === 'RUNNING';
}

function SyncStatusBanner({ job }: { job: ZoomSyncJob | null | undefined }) {
  if (!job) return null;

  const progress = job.progress;
  const pct =
    progress && progress.monthsTotal > 0
      ? Math.round((progress.monthsDone / progress.monthsTotal) * 100)
      : null;

  if (job.status === 'FAILED') {
    return (
      <ZoomJobBanner
        tone="error"
        title="Sync failed"
        detail={job.errorMessage ?? undefined}
      />
    );
  }

  if (syncInProgress(job)) {
    return (
      <ZoomJobBanner
        tone="running"
        title="Syncing from Zoom"
        progress={
          pct != null
            ? { pct, label: `${progress!.monthsDone}/${progress!.monthsTotal} months (${pct}%)` }
            : undefined
        }
        detail={
          progress
            ? `${progress.sessionsUpserted} sessions · ${progress.fileStubsUpserted} file stubs${
                progress.errors.length ? ` · ${progress.errors.length} window error(s)` : ''
              }`
            : undefined
        }
      />
    );
  }

  if (job.status === 'COMPLETED' && progress) {
    return (
      <ZoomJobBanner
        tone="success"
        title={`Last sync: ${progress.sessionsUpserted} sessions, ${progress.fileStubsUpserted} files indexed`}
        detail={[
          job.finishedAt ? format(parseISO(job.finishedAt), 'MMM d, yyyy h:mm a') : null,
          progress.errors.length ? `${progress.errors.length} window warning(s)` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      />
    );
  }

  return null;
}

function AttendanceImportStatusBanner({
  job,
}: {
  job: ZoomAttendanceImportJob | null | undefined;
}) {
  if (!job) return null;

  const progress = job.progress;
  const pct =
    progress && progress.sessionsTotal > 0
      ? Math.round((progress.sessionsDone / progress.sessionsTotal) * 100)
      : null;

  if (job.status === 'FAILED') {
    return (
      <ZoomJobBanner
        tone="error"
        title="Attendee import failed"
        detail={job.errorMessage ?? undefined}
      />
    );
  }

  if (importInProgress(job)) {
    return (
      <ZoomJobBanner
        tone="running"
        title="Importing attendees from Zoom"
        progress={
          pct != null
            ? {
                pct,
                label: `${progress!.sessionsDone}/${progress!.sessionsTotal} sessions (${pct}%)`,
              }
            : undefined
        }
        detail={
          progress
            ? `${progress.participantsUpserted} participants${
                progress.reportsExported
                  ? ` · ${progress.reportsExported} report(s) exported to S3`
                  : ''
              }${progress.errors.length ? ` · ${progress.errors.length} session error(s)` : ''}${
                progress.reportExportErrors?.length
                  ? ` · ${progress.reportExportErrors.length} report export warning(s)`
                  : ''
              }`
            : undefined
        }
      />
    );
  }

  if (job.status === 'COMPLETED' && progress) {
    return (
      <ZoomJobBanner
        tone="success"
        title={`Last attendee import: ${progress.participantsUpserted} participants across ${progress.sessionsDone} sessions`}
        detail={[
          job.finishedAt ? format(parseISO(job.finishedAt), 'MMM d, yyyy h:mm a') : null,
          progress.registrationsAutoVerified
            ? `${progress.registrationsAutoVerified} auto-verified`
            : null,
          progress.reportsExported ? `${progress.reportsExported} report(s) in S3` : null,
          progress.errors.length ? `${progress.errors.length} session warning(s)` : null,
          progress.reportExportErrors?.length
            ? `${progress.reportExportErrors.length} report export warning(s)`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      />
    );
  }

  return null;
}

/**
 * Zoom Recordings catalog chrome: sync controls + nested filter tabs.
 * List content renders in nested routes (All | Zoom Only | Linked to Program).
 */
export default function AdminZoomRecordingsLayout() {
  const queryClient = useQueryClient();
  const [syncJobId, setSyncJobId] = useState<string | null>(null);
  const [attendanceJobId, setAttendanceJobId] = useState<string | null>(null);
  const [bulkImportConfirmOpen, setBulkImportConfirmOpen] = useState(false);

  const { data: configProbe } = useQuery({
    queryKey: ['admin', 'zoom-recordings', 'config-probe'],
    queryFn: () => adminApi.listZoomRecordingSessions({ page: 1, pageSize: 1 }),
    staleTime: 60_000,
  });

  const { data: latestJob } = useQuery({
    queryKey: ['admin', 'zoom-recordings', 'sync', 'latest'],
    queryFn: () => adminApi.getLatestZoomSyncJob(),
    refetchInterval: (query) =>
      syncInProgress(query.state.data ?? undefined) ? SYNC_POLL_MS : false,
    staleTime: 5_000,
  });

  const syncMut = useMutation({
    mutationFn: () => adminApi.startZoomRecordingsSync(),
    onSuccess: (job) => {
      setSyncJobId(job.id);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'zoom-recordings', 'sync'] });
    },
  });

  const activeJobId = syncJobId ?? (syncInProgress(latestJob) ? latestJob?.id : null);

  const { data: activeJob } = useQuery({
    queryKey: ['admin', 'zoom-recordings', 'sync', activeJobId],
    queryFn: () => adminApi.getZoomSyncJob(activeJobId!),
    enabled: !!activeJobId,
    refetchInterval: (query) =>
      syncInProgress(query.state.data ?? undefined) ? SYNC_POLL_MS : false,
  });

  const displayJob = activeJob ?? latestJob;
  const syncBusy = syncMut.isPending || syncInProgress(displayJob);
  const syncError = syncMut.error
    ? getApiErrorMessage(syncMut.error, 'Could not start Zoom sync')
    : null;

  const { data: latestAttendanceJob } = useQuery({
    queryKey: ['admin', 'zoom-recordings', 'attendance', 'import', 'latest'],
    queryFn: () => adminApi.getLatestZoomAttendanceImportJob(),
    refetchInterval: (query) =>
      importInProgress(query.state.data ?? undefined) ? SYNC_POLL_MS : false,
    staleTime: 5_000,
  });

  const attendanceImportMut = useMutation({
    mutationFn: () => adminApi.startZoomAttendanceImport(),
    onSuccess: (job) => {
      setAttendanceJobId(job.id);
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'zoom-recordings', 'attendance', 'import'],
      });
    },
  });

  const activeAttendanceJobId =
    attendanceJobId ?? (importInProgress(latestAttendanceJob) ? latestAttendanceJob?.id : null);

  const { data: activeAttendanceJob } = useQuery({
    queryKey: ['admin', 'zoom-recordings', 'attendance', 'import', activeAttendanceJobId],
    queryFn: () => adminApi.getZoomAttendanceImportJob(activeAttendanceJobId!),
    enabled: !!activeAttendanceJobId,
    refetchInterval: (query) =>
      importInProgress(query.state.data ?? undefined) ? SYNC_POLL_MS : false,
  });

  const displayAttendanceJob = activeAttendanceJob ?? latestAttendanceJob;
  const attendanceBusy =
    attendanceImportMut.isPending || importInProgress(displayAttendanceJob);
  const attendanceError = attendanceImportMut.error
    ? getApiErrorMessage(attendanceImportMut.error, 'Could not start attendee import')
    : null;
  const catalogSessionCount = configProbe?.total ?? 0;
  const canBulkImportAttendees =
    catalogSessionCount > 0 && configProbe?.zoomConfigured !== false;

  const startBulkAttendanceImport = () => {
    setBulkImportConfirmOpen(false);
    attendanceImportMut.mutate();
  };

  useEffect(() => {
    if (activeJob && !syncInProgress(activeJob)) {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'zoom-recordings'] });
    }
  }, [activeJob, queryClient]);

  useEffect(() => {
    if (activeAttendanceJob && !importInProgress(activeAttendanceJob)) {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'zoom-recordings'] });
    }
  }, [activeAttendanceJob, queryClient]);

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="rounded-card bg-card p-3 shadow-card md:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="grid size-8 shrink-0 place-items-center rounded-[6px] bg-muted text-brand-600">
                <Video className="h-4 w-4" aria-hidden />
              </div>
              <div>
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  Zoom Recordings catalog
                </h2>
                <p className="text-xs text-muted-foreground">
                  {catalogSessionCount} session{catalogSessionCount === 1 ? '' : 's'} indexed
                </p>
              </div>
            </div>
            <p className="max-w-2xl text-xs leading-snug text-muted-foreground">
              Sync indexes webinar metadata from Zoom. Pull stores recordings and transcripts in S3.
              <br />
              Import attendees per session from the list below, or run a bulk import for all catalog
              sessions.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
            <Button
              variant="solid"
              size="sm"
              onClick={() => syncMut.mutate()}
              disabled={syncBusy || configProbe?.zoomConfigured === false}
            >
              {syncBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {syncBusy ? 'Syncing…' : 'Sync from Zoom'}
            </Button>
            {catalogSessionCount > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkImportConfirmOpen(true)}
                disabled={attendanceBusy || !canBulkImportAttendees}
                title={
                  !canBulkImportAttendees
                    ? 'Zoom API is not configured'
                    : `Import attendees for all ${catalogSessionCount} catalog session${catalogSessionCount === 1 ? '' : 's'} (last 12 months)`
                }
              >
                {attendanceBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Users className="h-4 w-4" />
                )}
                {attendanceBusy ? 'Importing…' : 'Import all attendees'}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {bulkImportConfirmOpen
        ? createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
              <div
                className="w-full max-w-md rounded-card bg-card p-6 shadow-card-hover"
                role="dialog"
                aria-modal="true"
                aria-labelledby="bulk-attendance-import-title"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2
                      id="bulk-attendance-import-title"
                      className="text-base font-semibold text-foreground"
                    >
                      Import all attendees?
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      This will import Zoom Report API participant lists for{' '}
                      <strong className="text-foreground">{catalogSessionCount}</strong> catalog
                      session
                      {catalogSessionCount === 1 ? '' : 's'} from the last 12 months. Use
                      per-session import on the list if you only need one webinar.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBulkImportConfirmOpen(false)}
                    className="shrink-0 rounded-[6px] p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setBulkImportConfirmOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="solid"
                    size="sm"
                    onClick={startBulkAttendanceImport}
                    disabled={attendanceBusy}
                  >
                    {attendanceBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Users className="h-4 w-4" />
                    )}
                    Start bulk import
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      <div className="space-y-2">
        {configProbe && !configProbe.storageConfigured ? (
          <ZoomAlert tone="warning" title="S3 not configured">
            Set <code className="rounded bg-black/5 px-1 py-0.5 text-xs">SESSION_ASSETS_S3_BUCKET</code>{' '}
            before pulling recordings into storage.
          </ZoomAlert>
        ) : null}
        {configProbe && !configProbe.zoomConfigured ? (
          <ZoomAlert tone="warning" title="Zoom API not configured">
            Sync and attendee import require Zoom credentials on this server.
          </ZoomAlert>
        ) : null}
        {syncError ? <ZoomAlert tone="error">{syncError}</ZoomAlert> : null}
        {attendanceError ? <ZoomAlert tone="error">{attendanceError}</ZoomAlert> : null}
        <SyncStatusBanner job={displayJob} />
        <AttendanceImportStatusBanner job={displayAttendanceJob} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ZoomFilterTabs
          tabs={[
            { to: '/admin/programs/zoom-recordings', end: true, label: 'All sessions' },
            { to: '/admin/programs/zoom-recordings/zoom-only', label: 'Zoom only' },
            { to: '/admin/programs/zoom-recordings/linked', label: 'Linked to program' },
          ]}
        />
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Cloud className="h-3.5 w-3.5" aria-hidden />
          Account-wide cloud recording index
        </p>
      </div>

      <Outlet />
    </div>
  );
}
