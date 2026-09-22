import { CloudDownload, Download, ExternalLink, FileVideo, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { ProgramZoomRecordingRow } from '../../api/admin';
import { Button } from '../ui/Button';
import { ZoomStatusBadge } from './zoom-recordings/ZoomRecordingsUi';

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return '';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

type FilePullUiStatus =
  | 'pending'
  | 'fetching'
  | 'uploading'
  | 'completed'
  | 'failed';

function resolvePullUiStatus(
  row: ProgramZoomRecordingRow,
  opts: { bulkPulling: boolean; pullingFileId?: string | null },
): FilePullUiStatus {
  const status = (row.pullStatus ?? '').toUpperCase();
  // Must match catalog counting: only real S3 objects count as complete.
  const stored = row.storedInS3 === true;
  const thisFilePulling = opts.pullingFileId === row.id;

  if (status === 'FAILED' || (!!row.pullError && !stored && !thisFilePulling)) {
    return 'failed';
  }
  if (stored && !thisFilePulling && status !== 'IN_PROGRESS') return 'completed';
  if (status === 'IN_PROGRESS' || thisFilePulling) {
    return status === 'IN_PROGRESS' ? 'uploading' : 'fetching';
  }
  if (opts.bulkPulling && !stored) return 'fetching';
  return 'pending';
}

function PullStatusBadge({
  status,
}: {
  status: FilePullUiStatus;
}) {
  switch (status) {
    case 'completed':
      return <ZoomStatusBadge tone="success">Upload completed</ZoomStatusBadge>;
    case 'uploading':
      return (
        <ZoomStatusBadge tone="info" icon={Loader2} className="[&_svg]:animate-spin">
          Uploading to S3
        </ZoomStatusBadge>
      );
    case 'fetching':
      return (
        <ZoomStatusBadge tone="info" icon={Loader2} className="[&_svg]:animate-spin">
          Fetching from Zoom
        </ZoomStatusBadge>
      );
    case 'failed':
      return <ZoomStatusBadge tone="error">Failed upload</ZoomStatusBadge>;
    default:
      return <ZoomStatusBadge tone="warning">Not in S3 — pull required</ZoomStatusBadge>;
  }
}

export function ZoomRecordingFilesTable({
  recordings,
  isLoading,
  isPulling = false,
  pullingFileId = null,
  emptyMessage = 'No recording files yet.',
  onView,
  onDownload,
  onPullFile,
}: {
  recordings: ProgramZoomRecordingRow[];
  isLoading?: boolean;
  /** True while a bulk Pull from Zoom request is in flight. */
  isPulling?: boolean;
  /** DB row id of the file currently being pulled individually. */
  pullingFileId?: string | null;
  emptyMessage?: string;
  onView: (recordingId: string) => void;
  onDownload: (recordingId: string) => void;
  /** When set, shows a per-row Pull button (does not replace bulk pull). */
  onPullFile?: (recording: ProgramZoomRecordingRow) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading recordings…
      </div>
    );
  }

  if (recordings.length === 0) {
    return (
      <div className="rounded-[8px] bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const anyFilePulling = !!pullingFileId;
  const pullBusy = isPulling || anyFilePulling;

  return (
    <ul className="divide-y divide-border/60 overflow-hidden rounded-[8px] bg-muted/20">
      {recordings.map((r) => {
        const stored = r.storedInS3 === true;
        const isTranscript = ['TRANSCRIPT', 'CC'].includes(r.fileType.toUpperCase());
        const pullUi = resolvePullUiStatus(r, {
          bulkPulling: isPulling,
          pullingFileId,
        });
        const thisFilePulling = pullingFileId === r.id;
        return (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-muted/30"
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[6px] bg-card text-muted-foreground shadow-card">
                <FileVideo className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-foreground">{r.fileType}</p>
                  {r.recordingType ? (
                    <span className="text-sm text-muted-foreground">· {r.recordingType}</span>
                  ) : null}
                  {isTranscript ? (
                    <ZoomStatusBadge tone="success">Transcript</ZoomStatusBadge>
                  ) : null}
                  <PullStatusBadge status={pullUi} />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.recordingStart
                    ? format(parseISO(r.recordingStart), 'MMM d, yyyy · h:mm a')
                    : 'Recording time unknown'}
                  {r.fileSizeBytes != null ? ` · ${formatFileSize(r.fileSizeBytes)}` : ''}
                  {r.pulledAt
                    ? ` · pulled ${format(parseISO(r.pulledAt), 'MMM d, yyyy')}`
                    : ''}
                </p>
                {pullUi === 'failed' && r.pullError ? (
                  <p className="mt-1 text-xs text-destructive">{r.pullError}</p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {onPullFile ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPullFile(r)}
                  disabled={pullBusy}
                  title={
                    stored
                      ? 'Re-pull only this file from Zoom into S3'
                      : 'Pull only this file from Zoom into S3'
                  }
                >
                  {thisFilePulling ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CloudDownload className="h-3.5 w-3.5" />
                  )}
                  {thisFilePulling ? 'Pulling…' : stored ? 'Re-pull' : 'Pull'}
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onView(r.id)}
                disabled={!stored}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View
              </Button>
              <Button
                variant="solid"
                size="sm"
                onClick={() => onDownload(r.id)}
                disabled={!stored}
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
