import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import {
  ChevronRight,
  CloudUpload,
  HardDrive,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  Users,
  Video,
} from 'lucide-react';
import {
  adminApi,
  type ZoomRecordingCatalogSession,
} from '../../api/admin';
import { getApiErrorMessage } from '../../api/client';
import {
  Button,
  ZoomAlert,
  ZoomEmptyState,
  ZoomLoadingState,
  ZoomStatusBadge,
} from '../../components/admin/zoom-recordings/ZoomRecordingsUi';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import TablePagination from '../../components/ui/TablePagination';
import { cn } from '../../lib/cn';

const PAGE_SIZE = 15;

export type ZoomRecordingsListFilter = 'all' | 'unlinked' | 'linked';

function sessionDetailPath(sessionId: string) {
  return `/admin/programs/zoom-recordings/${sessionId}`;
}

function FilesStatus({ session }: { session: ZoomRecordingCatalogSession }) {
  const inS3 = session.filesInS3Count > 0;
  const complete = inS3 && session.filesInS3Count >= session.fileCount;

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-[6px]',
          complete ? 'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300' : 'bg-muted text-muted-foreground',
        )}
      >
        <HardDrive className="h-3.5 w-3.5" aria-hidden />
      </div>
      <div>
        <p className="font-medium text-foreground">
          {inS3 ? `${session.filesInS3Count}/${session.fileCount}` : session.fileCount}
          <span className="ml-1 font-normal text-muted-foreground">
            {inS3 ? 'in S3' : 'indexed'}
          </span>
        </p>
        {inS3 && !complete ? (
          <p className="text-[11px] text-muted-foreground">Pull remaining files</p>
        ) : null}
      </div>
    </div>
  );
}

function SessionAttendeesCell({
  session,
  zoomConfigured,
  isImporting,
  importError,
  onImport,
}: {
  session: ZoomRecordingCatalogSession;
  zoomConfigured: boolean;
  isImporting: boolean;
  importError: string | null;
  onImport: () => void;
}) {
  if (session.attendeesImported) {
    const count =
      session.attendeeImportCount ??
      session.attendeeReportParticipantCount ??
      null;
    return (
      <div className="space-y-1.5">
        <ZoomStatusBadge tone="success" icon={Users}>
          Imported{count != null && count > 0 ? ` · ${count}` : ''}
        </ZoomStatusBadge>
        {session.attendanceLastImportedAt ? (
          <p className="text-[11px] text-muted-foreground">
            {format(parseISO(session.attendanceLastImportedAt), 'MMM d, yyyy')}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
      <Button variant="outline" size="sm" onClick={onImport} disabled={!zoomConfigured || isImporting}>
        {isImporting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Users className="h-3.5 w-3.5" />
        )}
        {isImporting ? 'Importing…' : 'Import'}
      </Button>
      {importError ? (
        <p className="max-w-[160px] text-[11px] leading-snug text-destructive">{importError}</p>
      ) : null}
    </div>
  );
}

function SessionRow({
  session,
  zoomConfigured,
  importingSessionId,
  importErrors,
  onImport,
}: {
  session: ZoomRecordingCatalogSession;
  zoomConfigured: boolean;
  importingSessionId: string | null;
  importErrors: Record<string, string>;
  onImport: (sessionId: string) => void;
}) {
  const navigate = useNavigate();
  const detailPath = sessionDetailPath(session.id);
  const title = session.topic?.trim() || 'Untitled session';

  const openDetail = () => navigate(detailPath);

  return (
    <tr
      className="group cursor-pointer transition-colors hover:bg-muted/30"
      onClick={openDetail}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDetail();
        }
      }}
      tabIndex={0}
      role="link"
      aria-label={`Open ${title} recordings`}
    >
      <td className="px-4 py-4 align-top">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[8px] bg-muted/80 text-muted-foreground transition-colors group-hover:bg-brand-50 group-hover:text-brand-600 dark:group-hover:bg-brand-950/40">
            <Video className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground transition-colors group-hover:text-brand-700 dark:group-hover:text-brand-300">
              {title}
            </p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{session.zoomMeetingId}</p>
          </div>
        </div>
      </td>
      <td className="hidden whitespace-nowrap px-4 py-4 align-top text-sm text-muted-foreground md:table-cell">
        {session.startTime
          ? format(parseISO(session.startTime), 'MMM d, yyyy · h:mm a')
          : '—'}
      </td>
      <td className="px-4 py-4 align-top">
        {session.linked ? (
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">
              {session.programTitle || 'Linked program'}
            </p>
            {session.chmProgramId ? (
              <p className="font-mono text-[11px] text-muted-foreground">{session.chmProgramId}</p>
            ) : null}
          </div>
        ) : (
          <ZoomStatusBadge tone="warning" icon={Link2}>
            Zoom only
          </ZoomStatusBadge>
        )}
      </td>
      <td className="px-4 py-4 align-top">
        <FilesStatus session={session} />
      </td>
      <td className="px-4 py-4 align-top" onClick={(e) => e.stopPropagation()}>
        <SessionAttendeesCell
          session={session}
          zoomConfigured={zoomConfigured}
          isImporting={importingSessionId === session.id}
          importError={importErrors[session.id] ?? null}
          onImport={() => onImport(session.id)}
        />
      </td>
      <td className="hidden max-w-[180px] truncate px-4 py-4 align-top text-sm text-muted-foreground lg:table-cell">
        {session.hostEmail || '—'}
      </td>
      <td className="px-4 py-4 align-top text-right">
        <Link
          to={detailPath}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 rounded-[6px] px-2 py-1.5 text-xs font-semibold text-muted-foreground opacity-80 transition-all group-hover:text-foreground group-hover:opacity-100"
        >
          Open
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </td>
    </tr>
  );
}

const EMPTY_COPY: Record<
  ZoomRecordingsListFilter,
  { title: string; body: string }
> = {
  all: {
    title: 'No sessions yet',
    body: 'Run Sync from Zoom to index webinars from your account. Then open a session to pull transcripts and recordings into S3.',
  },
  unlinked: {
    title: 'No Zoom-only sessions',
    body: 'Sessions that exist in Zoom but are not linked to a CHT Program will appear here after Sync from Zoom.',
  },
  linked: {
    title: 'No linked sessions',
    body: 'Sessions linked to a CHT Program appear here after Sync from Zoom or when you link a catalog session to a program.',
  },
};

export default function AdminZoomRecordingsList({
  filter,
}: {
  filter: ZoomRecordingsListFilter;
}) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [importingSessionId, setImportingSessionId] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setPage(1);
  }, [filter]);

  const linkedParam =
    filter === 'linked' ? true : filter === 'unlinked' ? false : undefined;

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'zoom-recordings', page, linkedParam, searchQuery],
    queryFn: () =>
      adminApi.listZoomRecordingSessions({
        page,
        pageSize: PAGE_SIZE,
        linked: linkedParam,
        q: searchQuery || undefined,
      }),
    staleTime: 15_000,
  });

  const importMut = useMutation({
    mutationFn: (sessionId: string) => adminApi.importZoomSessionAttendance(sessionId),
    onMutate: (sessionId) => {
      setImportingSessionId(sessionId);
      setImportErrors((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
    },
    onSuccess: (_res, sessionId) => {
      setImportingSessionId(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'zoom-recordings'] });
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'zoom-recordings', 'session', sessionId],
      });
    },
    onError: (err, sessionId) => {
      setImportingSessionId(null);
      setImportErrors((prev) => ({
        ...prev,
        [sessionId]: getApiErrorMessage(err, 'Import failed'),
      }));
    },
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const emptyCopy = EMPTY_COPY[filter];
  const zoomConfigured = data?.zoomConfigured !== false;

  const submitSearch = () => {
    setSearchQuery(searchInput.trim());
    setPage(1);
  };

  return (
    <div className="overflow-hidden rounded-card bg-card shadow-card">
      <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <form
          className="relative min-w-0 flex-1 sm:max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            submitSearch();
          }}
        >
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search webinar name or meeting ID…"
            className="h-10 w-full rounded-[6px] bg-muted/50 py-2 pl-9 pr-3 text-sm text-foreground shadow-inner placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label="Search webinar name or meeting ID"
          />
        </form>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {data ? (
            <p className="text-xs text-muted-foreground">
              Page {data.page} of {totalPages}
              {searchQuery ? (
                <>
                  {' '}
                  · filtered by &ldquo;{searchQuery}&rdquo;
                </>
              ) : null}
            </p>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <ZoomLoadingState label="Loading catalog sessions…" />
      ) : error ? (
        <div className="p-4">
          <ZoomAlert tone="error" title="Could not load catalog">
            {getApiErrorMessage(error, 'Please try again.')}
          </ZoomAlert>
        </div>
      ) : !data?.sessions.length ? (
        <div className="p-4">
          <ZoomEmptyState
            icon={searchQuery ? Search : Video}
            title={searchQuery ? 'No matching sessions' : emptyCopy.title}
            body={
              searchQuery
                ? `No sessions match “${searchQuery}”. Try a different webinar name or meeting ID, then press Enter.`
                : emptyCopy.body
            }
            action={
              !searchQuery ? (
                <Button variant="outline" size="sm" disabled>
                  <CloudUpload className="h-4 w-4" />
                  Use Sync from Zoom above
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="relative overflow-x-auto">
            {isFetching ? (
              <div className="absolute inset-0 z-10 flex items-start justify-center bg-card/60 pt-8">
                <LoadingSpinner />
              </div>
            ) : null}
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3.5">Session</th>
                  <th className="hidden px-4 py-3.5 md:table-cell">Start</th>
                  <th className="px-4 py-3.5">Program</th>
                  <th className="px-4 py-3.5">Files</th>
                  <th className="px-4 py-3.5">Attendees</th>
                  <th className="hidden px-4 py-3.5 lg:table-cell">Host</th>
                  <th className="px-4 py-3.5 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.sessions.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    zoomConfigured={zoomConfigured}
                    importingSessionId={importingSessionId}
                    importErrors={importErrors}
                    onImport={(sessionId) => importMut.mutate(sessionId)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border/60 px-4 py-3">
            <TablePagination
              page={page}
              totalPages={totalPages}
              totalItems={data.total}
              itemLabel={`session${data.total === 1 ? '' : 's'}`}
              onPageChange={setPage}
            />
          </div>
        </>
      )}
    </div>
  );
}
