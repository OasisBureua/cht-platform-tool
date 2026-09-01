import { zoomRecordingsOwnerKey } from './zoom-recordings-media.util';
import type { AttendanceReportRow } from './zoom-attendance-report.types';
import {
  canImportReportParticipant,
  normalizeReportParticipantEmail,
  normalizeReportZoomParticipantId,
} from './zoom-attendance-import-key.util';

/** Fixed object name under each webinar prefix (overwrite on re-import). */
export const ATTENDANCE_REPORT_FILENAME = 'attendees.csv';

export const ATTENDANCE_REPORT_CSV_HEADERS = [
  'zoom_participant_id',
  'participant_name',
  'participant_email',
  'join_time',
  'leave_time',
  'duration_seconds',
  'is_host',
  'source',
  'import_job_id',
  'exported_at',
] as const;

export function buildAttendanceReportS3Key(opts: {
  programId?: string | null;
  meetingId: string;
  filename?: string;
}): string {
  const owner = zoomRecordingsOwnerKey(opts.programId);
  const meetingId = opts.meetingId.trim();
  const filename = opts.filename?.trim() || ATTENDANCE_REPORT_FILENAME;
  return `zoom-recordings/${owner}/${meetingId}/${filename}`;
}

/** RFC 4180-style CSV field quoting. */
export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return escapeCsvField(String(value));
}

export function serializeAttendanceReportCsv(rows: AttendanceReportRow[]): string {
  const lines = [
    ATTENDANCE_REPORT_CSV_HEADERS.join(','),
    ...rows.map((row) =>
      [
        row.zoomParticipantId,
        row.participantName,
        row.participantEmail,
        row.joinTime,
        row.leaveTime,
        row.durationSeconds,
        row.isHost,
        row.source,
        row.importJobId,
        row.exportedAt,
      ]
        .map(formatCsvCell)
        .join(','),
    ),
  ];
  return `${lines.join('\n')}\n`;
}

/** Build CSV rows from Zoom Report API participants (all fetched rows). */
export function mapZoomParticipantsToReportRows(
  participants: Array<{
    id?: string | null;
    name?: string;
    userEmail?: string;
    joinTime?: string;
    leaveTime?: string;
    durationSeconds?: number;
    internalUser?: boolean;
  }>,
  opts: { importJobId?: string | null; exportedAt: Date },
): AttendanceReportRow[] {
  const exportedAt = opts.exportedAt.toISOString();
  return participants.filter(canImportReportParticipant).map((p) => ({
    zoomParticipantId: normalizeReportZoomParticipantId(p.id) ?? '',
    participantName: p.name?.trim() || null,
    participantEmail: normalizeReportParticipantEmail(p.userEmail),
    joinTime: p.joinTime ?? null,
    leaveTime: p.leaveTime ?? null,
    durationSeconds: p.durationSeconds ?? null,
    isHost: !!p.internalUser,
    source: 'REPORT_IMPORT',
    importJobId: opts.importJobId ?? null,
    exportedAt,
  }));
}
