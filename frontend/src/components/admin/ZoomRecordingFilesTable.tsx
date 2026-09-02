import { Download, ExternalLink, FileVideo, Loader2 } from 'lucide-react';
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

export function ZoomRecordingFilesTable({
  recordings,
  isLoading,
  emptyMessage = 'No recording files yet.',
  onView,
  onDownload,
}: {
  recordings: ProgramZoomRecordingRow[];
  isLoading?: boolean;
  emptyMessage?: string;
  onView: (recordingId: string) => void;
  onDownload: (recordingId: string) => void;
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

  return (
    <ul className="divide-y divide-border/60 overflow-hidden rounded-[8px] bg-muted/20">
      {recordings.map((r) => {
        const stored = r.storedInS3 ?? !!r.pulledAt;
        const isTranscript = ['TRANSCRIPT', 'CC'].includes(r.fileType.toUpperCase());
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
                  {!stored ? <ZoomStatusBadge tone="warning">Not in S3</ZoomStatusBadge> : null}
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
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={() => onView(r.id)} disabled={!stored}>
                <ExternalLink className="h-3.5 w-3.5" />
                View
              </Button>
              <Button variant="solid" size="sm" onClick={() => onDownload(r.id)} disabled={!stored}>
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
