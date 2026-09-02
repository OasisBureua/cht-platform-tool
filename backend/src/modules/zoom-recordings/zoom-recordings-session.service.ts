import { Injectable } from '@nestjs/common';
import {
  ProgramZoomSessionType,
  ZoomRecordingPullStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ZoomRecordingsSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureSessionForProgram(opts: {
    programId: string;
    meetingId: string;
    topic: string;
    sessionType: ProgramZoomSessionType;
    startTime: Date | null;
    durationMinutes: number | null;
    chmProgramId?: string | null;
    zoomUuid?: string | null;
    hostEmail?: string | null;
    totalSizeBytes?: number | null;
  }) {
    const chmProgramId = opts.chmProgramId?.trim() || null;
    return this.prisma.zoomRecordingSession.upsert({
      where: { zoomMeetingId: opts.meetingId },
      create: {
        zoomMeetingId: opts.meetingId,
        zoomUuid: opts.zoomUuid ?? null,
        programId: opts.programId,
        topic: opts.topic,
        sessionType: opts.sessionType,
        startTime: opts.startTime,
        durationMinutes: opts.durationMinutes,
        hostEmail: opts.hostEmail ?? null,
        totalSizeBytes: opts.totalSizeBytes ?? null,
        chmProgramId,
      },
      update: {
        programId: opts.programId,
        topic: opts.topic,
        sessionType: opts.sessionType,
        startTime: opts.startTime ?? undefined,
        durationMinutes: opts.durationMinutes ?? undefined,
        zoomUuid: opts.zoomUuid ?? undefined,
        hostEmail: opts.hostEmail ?? undefined,
        totalSizeBytes: opts.totalSizeBytes ?? undefined,
        ...(chmProgramId ? { chmProgramId } : {}),
        lastSyncedAt: new Date(),
      },
    });
  }

  async ensureSessionFromSync(opts: {
    meetingId: string;
    topic?: string | null;
    sessionType?: ProgramZoomSessionType;
    startTime?: Date | null;
    durationMinutes?: number | null;
    zoomUuid?: string | null;
    hostEmail?: string | null;
    totalSizeBytes?: number | null;
    programId?: string | null;
  }) {
    const programId = opts.programId ?? null;
    return this.prisma.zoomRecordingSession.upsert({
      where: { zoomMeetingId: opts.meetingId },
      create: {
        zoomMeetingId: opts.meetingId,
        zoomUuid: opts.zoomUuid ?? null,
        programId,
        topic: opts.topic ?? null,
        sessionType: opts.sessionType ?? ProgramZoomSessionType.WEBINAR,
        startTime: opts.startTime ?? null,
        durationMinutes: opts.durationMinutes ?? null,
        hostEmail: opts.hostEmail ?? null,
        totalSizeBytes: opts.totalSizeBytes ?? null,
      },
      update: {
        topic: opts.topic ?? undefined,
        startTime: opts.startTime ?? undefined,
        durationMinutes: opts.durationMinutes ?? undefined,
        zoomUuid: opts.zoomUuid ?? undefined,
        hostEmail: opts.hostEmail ?? undefined,
        totalSizeBytes: opts.totalSizeBytes ?? undefined,
        ...(programId ? { programId } : {}),
        lastSyncedAt: new Date(),
      },
    });
  }

  async upsertFileStub(opts: {
    sessionId: string;
    programId?: string | null;
    zoomMeetingId: string;
    zoomRecordingFileId: string;
    fileType: string;
    recordingType?: string | null;
    fileExtension?: string | null;
    fileSizeBytes?: number | null;
    recordingStart?: Date | null;
    recordingEnd?: Date | null;
    topic?: string | null;
  }) {
    return this.prisma.zoomRecordingFile.upsert({
      where: {
        zoomMeetingId_zoomRecordingFileId: {
          zoomMeetingId: opts.zoomMeetingId,
          zoomRecordingFileId: opts.zoomRecordingFileId,
        },
      },
      create: {
        sessionId: opts.sessionId,
        programId: opts.programId ?? null,
        zoomMeetingId: opts.zoomMeetingId,
        zoomRecordingFileId: opts.zoomRecordingFileId,
        fileType: opts.fileType,
        recordingType: opts.recordingType ?? null,
        fileExtension: opts.fileExtension ?? null,
        fileSizeBytes: opts.fileSizeBytes ?? null,
        pullStatus: ZoomRecordingPullStatus.PENDING,
        recordingStart: opts.recordingStart ?? null,
        recordingEnd: opts.recordingEnd ?? null,
        topic: opts.topic ?? null,
      },
      update: {
        sessionId: opts.sessionId,
        ...(opts.programId ? { programId: opts.programId } : {}),
        fileType: opts.fileType,
        recordingType: opts.recordingType ?? undefined,
        fileExtension: opts.fileExtension ?? undefined,
        fileSizeBytes: opts.fileSizeBytes ?? undefined,
        recordingStart: opts.recordingStart ?? undefined,
        recordingEnd: opts.recordingEnd ?? undefined,
        topic: opts.topic ?? undefined,
      },
    });
  }

  async linkSessionToProgram(opts: {
    sessionId: string;
    programId: string;
    chmProgramId?: string | null;
  }) {
    await this.prisma.zoomRecordingSession.update({
      where: { id: opts.sessionId },
      data: {
        programId: opts.programId,
        ...(opts.chmProgramId?.trim()
          ? { chmProgramId: opts.chmProgramId.trim() }
          : {}),
      },
    });
    await this.prisma.zoomRecordingFile.updateMany({
      where: { sessionId: opts.sessionId },
      data: { programId: opts.programId },
    });
  }

  async findProgramByZoomMeetingId(meetingId: string) {
    return this.prisma.program.findFirst({
      where: { zoomMeetingId: meetingId },
      select: { id: true, chmProgramId: true, zoomSessionType: true },
    });
  }
}
