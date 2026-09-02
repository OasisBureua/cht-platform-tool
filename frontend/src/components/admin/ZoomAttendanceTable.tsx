import { format, parseISO } from 'date-fns';
import { Loader2 } from 'lucide-react';
import type { ZoomAttendanceParticipant } from '../../api/admin';
import { ZoomStatusBadge } from './zoom-recordings/ZoomRecordingsUi';

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return '—';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${Math.max(1, mins)} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value?.trim()) return '—';
  try {
    return format(parseISO(value), 'MMM d, yyyy · h:mm a');
  } catch {
    return '—';
  }
}

function sourceLabel(source: string): string {
  switch (source) {
    case 'REPORT_IMPORT':
      return 'Zoom report';
    case 'STAGING':
      return 'Staged';
    case 'WEBHOOK':
      return 'Live webhook';
    case 'MEETING_SDK':
      return 'In-app SDK';
    default:
      return source.replace(/_/g, ' ').toLowerCase();
  }
}

export function ZoomAttendanceTable({
  participants,
  isLoading,
  emptyMessage = 'No attendees imported yet.',
  showRegistrationMatch = false,
}: {
  participants: ZoomAttendanceParticipant[];
  isLoading?: boolean;
  emptyMessage?: string;
  showRegistrationMatch?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading attendees…
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="rounded-[8px] bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[8px] bg-muted/20">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Join time</th>
              <th className="px-4 py-3">Leave time</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Source</th>
              {showRegistrationMatch ? <th className="px-4 py-3">CHT registration</th> : null}
              <th className="hidden px-4 py-3 xl:table-cell">Zoom participant ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {participants.map((p) => {
              const displayName =
                p.participantName?.trim() || p.participantEmail?.trim() || 'Unknown';
              return (
                <tr key={p.id} className="text-foreground transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{displayName}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.participantEmail?.trim() || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatDateTime(p.joinTime)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatDateTime(p.leaveTime)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatDuration(p.durationSeconds)}
                  </td>
                  <td className="px-4 py-3">
                    {p.isHost ? (
                      <ZoomStatusBadge tone="neutral">Host</ZoomStatusBadge>
                    ) : (
                      <span className="text-muted-foreground">Attendee</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{sourceLabel(p.source)}</td>
                  {showRegistrationMatch ? (
                    <td className="px-4 py-3">
                      {p.matchedRegistration ? (
                        <ZoomStatusBadge tone="success">Matched</ZoomStatusBadge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ) : null}
                  <td className="hidden max-w-[140px] truncate px-4 py-3 font-mono text-xs text-muted-foreground xl:table-cell">
                    {p.zoomParticipantId || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
