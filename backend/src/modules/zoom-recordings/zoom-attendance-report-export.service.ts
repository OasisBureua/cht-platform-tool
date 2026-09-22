import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebinarParticipantEventSource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ZoomReportParticipant } from '../webinars/zoom.service';
import type { AttendanceReportExportMeta } from './zoom-attendance-report.types';
import {
  buildAttendanceReportS3Key,
  mapZoomParticipantsToReportRows,
  serializeAttendanceReportCsv,
} from './zoom-attendance-report.util';
import { ZoomRecordingsStorageService } from './zoom-recordings-storage.service';

export type AttendanceReportExportResult = {
  exported: boolean;
  participantCount: number;
  error?: string;
  meta?: AttendanceReportExportMeta;
};

@Injectable()
export class ZoomAttendanceReportExportService {
  private readonly logger = new Logger(ZoomAttendanceReportExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly storage: ZoomRecordingsStorageService,
  ) {}

  /** Upload attendee CSV for a session using Zoom Report API rows. */
  async exportFromZoomParticipants(
    session: {
      id: string;
      zoomMeetingId: string;
      programId: string | null;
    },
    participants: ZoomReportParticipant[],
    importJobId?: string | null,
  ): Promise<AttendanceReportExportResult> {
    const exportedAt = new Date();
    const rows = mapZoomParticipantsToReportRows(participants, {
      importJobId,
      exportedAt,
    });
    return this.uploadReport(session, rows, exportedAt);
  }

  /** Re-export after Link so the CSV moves to the programId S3 prefix. */
  async reexportAfterLink(sessionId: string, programId: string): Promise<AttendanceReportExportResult> {
    const session = await this.prisma.zoomRecordingSession.findUnique({
      where: { id: sessionId },
      select: { id: true, zoomMeetingId: true, programId: true },
    });
    if (!session) {
      return { exported: false, participantCount: 0, error: 'Session not found' };
    }

    const events = await this.prisma.webinarParticipantEvent.findMany({
      where: {
        programId,
        zoomMeetingId: session.zoomMeetingId,
        event: 'JOINED',
        source: WebinarParticipantEventSource.REPORT_IMPORT,
      },
      orderBy: [{ joinTime: 'asc' }, { occurredAt: 'asc' }],
    });

    const exportedAt = new Date();
    const rows = events.map((e) => ({
      zoomParticipantId: e.zoomParticipantId ?? '',
      participantName: e.participantName,
      participantEmail: e.participantEmail,
      joinTime: e.joinTime?.toISOString() ?? null,
      leaveTime: e.leaveTime?.toISOString() ?? null,
      durationSeconds: e.durationSeconds,
      isHost: e.isHost,
      source: e.source,
      importJobId: e.importJobId,
      exportedAt: exportedAt.toISOString(),
    }));

    return this.uploadReport(
      { id: session.id, zoomMeetingId: session.zoomMeetingId, programId },
      rows,
      exportedAt,
    );
  }

  private async uploadReport(
    session: {
      id: string;
      zoomMeetingId: string;
      programId: string | null;
    },
    rows: ReturnType<typeof mapZoomParticipantsToReportRows>,
    exportedAt: Date,
  ): Promise<AttendanceReportExportResult> {
    if (!this.storage.isStorageConfigured()) {
      const msg = 'S3 not configured; attendee report not exported';
      this.logger.warn(msg);
      return { exported: false, participantCount: rows.length, error: msg };
    }

    const filename =
      this.config.get<string>('zoomRecordings.attendanceReportFilename') ||
      'attendees.csv';
    const key = buildAttendanceReportS3Key({
      programId: session.programId,
      meetingId: session.zoomMeetingId,
      filename,
    });
    const bucket = this.storage.recordingsBucket();
    const body = Buffer.from(serializeAttendanceReportCsv(rows), 'utf8');

    try {
      await this.storage.uploadBuffer({
        key,
        body,
        contentType: 'text/csv; charset=utf-8',
      });

      await this.prisma.zoomRecordingSession.update({
        where: { id: session.id },
        data: {
          attendeeReportS3Bucket: bucket,
          attendeeReportS3Key: key,
          attendeeReportExportedAt: exportedAt,
          attendeeReportParticipantCount: rows.length,
        },
      });

      return {
        exported: true,
        participantCount: rows.length,
        meta: { s3Key: key, participantCount: rows.length, exportedAt },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to export attendee report for session ${session.id}: ${msg}`,
      );
      return { exported: false, participantCount: rows.length, error: msg };
    }
  }
}
