import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ZoomRecordingPullStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ZoomRecordingsPullService } from './zoom-recordings-pull.service';
import { ZoomRecordingsStorageService } from './zoom-recordings-storage.service';
import { ZoomService } from '../webinars/zoom.service';
import { extForFile, type RecordingUrlDisposition } from './zoom-recordings-media.util';
import { ZoomAttendanceImportService } from './zoom-attendance-import.service';
import {
  buildSessionAttendeeStatusFields,
  loadSessionAttendeeImportCounts,
} from './zoom-session-attendee-status.util';

@Injectable()
export class ZoomRecordingsCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly zoom: ZoomService,
    private readonly storage: ZoomRecordingsStorageService,
    private readonly pull: ZoomRecordingsPullService,
    private readonly attendance: ZoomAttendanceImportService,
  ) {}

  async listSessions(opts: {
    page?: number;
    pageSize?: number;
    linked?: boolean;
    q?: string;
  }) {
    const page = Math.max(opts.page ?? 1, 1);
    const pageSize = Math.min(Math.max(opts.pageSize ?? 15, 1), 100);
    const skip = (page - 1) * pageSize;

    const where = {
      ...(opts.linked === true ? { programId: { not: null } } : {}),
      ...(opts.linked === false ? { programId: null } : {}),
      ...(opts.q?.trim()
        ? {
            OR: [
              { topic: { contains: opts.q.trim(), mode: 'insensitive' as const } },
              { zoomMeetingId: { contains: opts.q.trim() } },
              { hostEmail: { contains: opts.q.trim(), mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.zoomRecordingSession.count({ where }),
      this.prisma.zoomRecordingSession.findMany({
        where,
        orderBy: [{ startTime: 'desc' }, { lastSyncedAt: 'desc' }],
        skip,
        take: pageSize,
        include: {
          program: { select: { id: true, title: true, chmProgramId: true } },
          _count: { select: { files: true } },
        },
      }),
    ]);

    const sessionIds = items.map((s) => s.id);
    const inS3BySession =
      sessionIds.length > 0
        ? await this.prisma.zoomRecordingFile.groupBy({
            by: ['sessionId'],
            where: {
              sessionId: { in: sessionIds },
              pullStatus: ZoomRecordingPullStatus.COMPLETED,
              s3Key: { not: null },
            },
            _count: { _all: true },
          })
        : [];
    const inS3Map = new Map(
      inS3BySession.map((row) => [row.sessionId, row._count._all]),
    );

    const importCountMap = await loadSessionAttendeeImportCounts(
      this.prisma,
      items.map((s) => ({
        id: s.id,
        programId: s.programId,
        zoomMeetingId: s.zoomMeetingId,
      })),
    );

    return {
      storageConfigured: this.storage.isStorageConfigured(),
      zoomConfigured: this.zoom.isConfigured(),
      page,
      pageSize,
      total,
      sessions: items.map((s) =>
        this.toSessionSummaryDto(s, {
          fileCount: s._count.files,
          filesInS3Count: inS3Map.get(s.id) ?? 0,
          importCount: importCountMap.get(s.id) ?? 0,
        }),
      ),
    };
  }

  async getSession(sessionId: string) {
    const session = await this.prisma.zoomRecordingSession.findUnique({
      where: { id: sessionId },
      include: {
        program: { select: { id: true, title: true, chmProgramId: true } },
        files: {
          orderBy: [{ recordingStart: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });
    if (!session) throw new NotFoundException('Zoom recording session not found');

    const filesInS3Count = session.files.filter(
      (f) => f.pullStatus === ZoomRecordingPullStatus.COMPLETED && f.s3Key,
    ).length;

    const importCountMap = await loadSessionAttendeeImportCounts(this.prisma, [
      {
        id: session.id,
        programId: session.programId,
        zoomMeetingId: session.zoomMeetingId,
      },
    ]);
    const importCount = importCountMap.get(session.id) ?? 0;

    const attendeeCount = session.programId
      ? await this.prisma.webinarParticipantEvent.count({
          where: {
            programId: session.programId,
            event: 'JOINED',
            zoomMeetingId: session.zoomMeetingId,
          },
        })
      : importCount;

    return {
      storageConfigured: this.storage.isStorageConfigured(),
      zoomConfigured: this.zoom.isConfigured(),
      session: {
        ...this.toSessionSummaryDto(session, {
          fileCount: session.files.length,
          filesInS3Count,
          importCount,
        }),
        attendeeCount,
      },
      files: session.files.map((f) => this.pull.toDto(f)),
    };
  }

  private toSessionSummaryDto(
    session: {
      id: string;
      zoomMeetingId: string;
      topic: string | null;
      hostEmail: string | null;
      startTime: Date | null;
      sessionType: string;
      programId: string | null;
      chmProgramId: string | null;
      lastSyncedAt: Date;
      program?: { title: string | null; chmProgramId: string | null } | null;
      attendanceLastImportedAt?: Date | null;
      attendeeReportS3Bucket?: string | null;
      attendeeReportS3Key?: string | null;
      attendeeReportExportedAt?: Date | null;
      attendeeReportParticipantCount?: number | null;
    },
    counts: { fileCount: number; filesInS3Count: number; importCount: number },
  ) {
    const attendeeFields = buildSessionAttendeeStatusFields(
      {
        id: session.id,
        programId: session.programId,
        zoomMeetingId: session.zoomMeetingId,
        attendanceLastImportedAt: session.attendanceLastImportedAt ?? null,
        attendeeReportS3Bucket: session.attendeeReportS3Bucket ?? null,
        attendeeReportS3Key: session.attendeeReportS3Key ?? null,
        attendeeReportExportedAt: session.attendeeReportExportedAt ?? null,
        attendeeReportParticipantCount:
          session.attendeeReportParticipantCount ?? null,
      },
      counts.importCount,
    );
    return {
      id: session.id,
      zoomMeetingId: session.zoomMeetingId,
      topic: session.topic,
      hostEmail: session.hostEmail,
      startTime: session.startTime?.toISOString() ?? null,
      sessionType: session.sessionType,
      programId: session.programId,
      programTitle: session.program?.title ?? null,
      chmProgramId: session.chmProgramId ?? session.program?.chmProgramId ?? null,
      linked: !!session.programId,
      fileCount: counts.fileCount,
      filesInS3Count: counts.filesInS3Count,
      lastSyncedAt: session.lastSyncedAt.toISOString(),
      ...attendeeFields,
    };
  }

  async createDownloadUrl(
    sessionId: string,
    fileId: string,
    opts?: { disposition?: RecordingUrlDisposition },
  ) {
    const row = await this.prisma.zoomRecordingFile.findFirst({
      where: { id: fileId, sessionId },
    });
    if (!row) throw new NotFoundException('Recording file not found');
    if (!row.s3Bucket || !row.s3Key) {
      throw new NotFoundException(
        'Recording file is not stored in S3 yet. Pull from Zoom first.',
      );
    }

    const presigned = await this.storage.createPresignedDownloadUrl({
      bucket: row.s3Bucket,
      key: row.s3Key,
      fileType: row.fileType,
      fileExtension: row.fileExtension || extForFile(row.fileType, row.fileExtension),
      zoomRecordingFileId: row.zoomRecordingFileId,
      chmAssetFilename: row.chmAssetFilename,
      disposition: opts?.disposition,
    });

    return {
      ...presigned,
      recording: this.pull.toDto(row),
    };
  }

  async createAttendanceReportDownloadUrl(sessionId: string) {
    const session = await this.prisma.zoomRecordingSession.findUnique({
      where: { id: sessionId },
      select: {
        attendeeReportS3Bucket: true,
        attendeeReportS3Key: true,
        attendeeReportParticipantCount: true,
        attendeeReportExportedAt: true,
        zoomMeetingId: true,
      },
    });
    if (!session) {
      throw new NotFoundException('Zoom recording session not found');
    }
    if (!session.attendeeReportS3Bucket || !session.attendeeReportS3Key) {
      throw new NotFoundException(
        'Attendee report is not stored in S3 yet. Import attendees first.',
      );
    }

    const filename =
      this.config.get<string>('zoomRecordings.attendanceReportFilename') ||
      'attendees.csv';
    const presigned = await this.storage.createPresignedObjectDownloadUrl({
      bucket: session.attendeeReportS3Bucket,
      key: session.attendeeReportS3Key,
      contentType: 'text/csv; charset=utf-8',
      filename,
      disposition: 'attachment',
    });

    return {
      ...presigned,
      filename,
      participantCount: session.attendeeReportParticipantCount ?? null,
      exportedAt: session.attendeeReportExportedAt?.toISOString() ?? null,
      zoomMeetingId: session.zoomMeetingId,
    };
  }

  async linkSessionToProgram(sessionId: string, programId: string) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: { id: true, chmProgramId: true },
    });
    if (!program) throw new NotFoundException('Program not found');

    const session = await this.prisma.zoomRecordingSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });
    if (!session) throw new NotFoundException('Zoom recording session not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.zoomRecordingSession.update({
        where: { id: sessionId },
        data: {
          programId,
          ...(program.chmProgramId?.trim()
            ? { chmProgramId: program.chmProgramId.trim() }
            : {}),
        },
      });
      await tx.zoomRecordingFile.updateMany({
        where: { sessionId },
        data: { programId },
      });
    });

    await this.attendance.migrateStagingToProgram(sessionId, programId);

    return this.getSession(sessionId);
  }

  listSessionAttendees(
    sessionId: string,
    opts?: { page?: number; pageSize?: number; search?: string },
  ) {
    return this.attendance.listSessionAttendees(sessionId, opts);
  }
}
