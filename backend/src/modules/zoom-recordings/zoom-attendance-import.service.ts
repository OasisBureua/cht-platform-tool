import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ProgramZoomSessionType,
  WebinarParticipantEventSource,
  ZoomSyncJobStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProgramRegistrationsService } from '../programs/program-registrations.service';
import { ZoomService, type ZoomReportParticipant } from '../webinars/zoom.service';
import { formatZoomHttpError } from './zoom-http-error.util';
import {
  buildWebinarParticipantEventListWhere,
  buildZoomAttendanceParticipantListWhere,
  clampAttendanceListPage,
  normalizeAttendanceSearchTerm,
} from './zoom-attendance-search.util';
import { syncWindowFromMonthsBack } from './zoom-sync-date.util';
import { ZoomAttendanceReportExportService } from './zoom-attendance-report-export.service';
import {
  canImportReportParticipant,
  normalizeReportParticipantEmail,
  normalizeReportZoomParticipantId,
  reportParticipantLabel,
} from './zoom-attendance-import-key.util';

type ImportProgress = {
  sessionsTotal: number;
  sessionsDone: number;
  participantsUpserted: number;
  registrationsAutoVerified: number;
  reportsExported: number;
  reportExportErrors: string[];
  errors: string[];
};

export type AttendanceParticipantDto = {
  id: string;
  zoomParticipantId: string;
  participantName: string | null;
  participantEmail: string | null;
  joinTime: string;
  leaveTime: string | null;
  durationSeconds: number | null;
  isHost: boolean;
  source: 'REPORT_IMPORT' | 'STAGING' | 'WEBHOOK' | 'MEETING_SDK';
  matchedRegistration: boolean;
};

@Injectable()
export class ZoomAttendanceImportService {
  private readonly logger = new Logger(ZoomAttendanceImportService.name);
  private runningJobId: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly zoom: ZoomService,
    private readonly registrations: ProgramRegistrationsService,
    private readonly reportExport: ZoomAttendanceReportExportService,
  ) {}

  async startImport(opts: {
    monthsBack?: number;
    sessionTypeFilter?: ProgramZoomSessionType | null;
    runAutoVerify?: boolean;
    startedByUserId?: string;
  }) {
    if (!this.zoom.isConfigured()) {
      throw new ServiceUnavailableException('Zoom API is not configured');
    }
    if (this.runningJobId) {
      throw new BadRequestException(
        'An attendance import is already running. Wait for it to finish before starting another.',
      );
    }

    const monthsBack =
      opts.monthsBack ??
      this.config.get<number>(
        'zoomRecordings.attendanceImportMonthsBackDefault',
      ) ??
      12;
    const { fromDate, toDate } = syncWindowFromMonthsBack(monthsBack);
    const runAutoVerify =
      opts.runAutoVerify ??
      this.config.get<boolean>(
        'zoomRecordings.attendanceImportAutoVerifyDefault',
      ) ??
      false;

    const sessionTypeFilter =
      opts.sessionTypeFilter ?? ProgramZoomSessionType.WEBINAR;
    const eligibleCount = await this.prisma.zoomRecordingSession.count({
      where: {
        sessionType: sessionTypeFilter,
        startTime: { gte: fromDate, lte: toDate },
      },
    });
    if (eligibleCount === 0) {
      throw new ConflictException(
        'No catalog sessions in the selected date range. Sync from Zoom first.',
      );
    }

    const job = await this.prisma.zoomAttendanceImportJob.create({
      data: {
        status: ZoomSyncJobStatus.QUEUED,
        monthsBack,
        sessionTypeFilter,
        fromDate,
        toDate,
        runAutoVerify,
        startedByUserId: opts.startedByUserId ?? null,
        progressJson: {
          sessionsTotal: 0,
          sessionsDone: 0,
          participantsUpserted: 0,
          registrationsAutoVerified: 0,
          reportsExported: 0,
          reportExportErrors: [],
          errors: [],
        },
      },
    });

    void this.runJob(job.id);
    return job;
  }

  async getJob(jobId: string) {
    const job = await this.prisma.zoomAttendanceImportJob.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new NotFoundException('Attendance import job not found');
    return job;
  }

  async getLatestJob() {
    return this.prisma.zoomAttendanceImportJob.findFirst({
      orderBy: { createdAt: 'desc' },
    });
  }

  async importSessionAttendees(
    sessionId: string,
    opts?: { runAutoVerify?: boolean; importJobId?: string },
  ) {
    if (!this.zoom.isConfigured()) {
      throw new ServiceUnavailableException('Zoom API is not configured');
    }

    const session = await this.prisma.zoomRecordingSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException('Zoom recording session not found');
    }

    const result = await this.importParticipantsForSession(session, {
      importJobId: opts?.importJobId,
    });

    let registrationsAutoVerified = 0;
    const shouldAutoVerify =
      opts?.runAutoVerify ??
      this.config.get<boolean>(
        'zoomRecordings.attendanceImportAutoVerifyDefault',
      ) ??
      false;
    if (shouldAutoVerify && session.programId) {
      const verified = await this.registrations.autoVerifyAttendanceFromZoomJoins(
        session.programId,
      );
      registrationsAutoVerified = verified.verifiedCount;
    }

    return {
      sessionId,
      participantsUpserted: result.upserted,
      registrationsAutoVerified,
      reportExported: result.reportExported,
      reportParticipantCount: result.reportParticipantCount,
      reportExportError: result.reportExportError ?? null,
      errors: result.errors,
    };
  }

  async listSessionAttendees(
    sessionId: string,
    opts?: { page?: number; pageSize?: number; search?: string },
  ) {
    const requestedPage = Math.max(opts?.page ?? 1, 1);
    const pageSize = Math.min(Math.max(opts?.pageSize ?? 10, 1), 100);
    const search = normalizeAttendanceSearchTerm(opts?.search);

    const session = await this.prisma.zoomRecordingSession.findUnique({
      where: { id: sessionId },
      select: { id: true, programId: true, zoomMeetingId: true },
    });
    if (!session) {
      throw new NotFoundException('Zoom recording session not found');
    }

    if (session.programId) {
      const where = buildWebinarParticipantEventListWhere(
        {
          programId: session.programId,
          event: 'JOINED',
          zoomMeetingId: session.zoomMeetingId,
        },
        search,
      );
      const { total, page, rows } = await this.prisma.$transaction(
        async (tx) => {
          const total = await tx.webinarParticipantEvent.count({ where });
          const page = clampAttendanceListPage(requestedPage, total, pageSize);
          const skip = (page - 1) * pageSize;
          const rows = await tx.webinarParticipantEvent.findMany({
            where,
            orderBy: [{ joinTime: 'desc' }, { occurredAt: 'desc' }],
            skip,
            take: pageSize,
          });
          return { total, page, rows };
        },
      );
      const matchedEmails = await this.matchedRegistrationEmails(
        session.programId,
      );
      return {
        sessionId,
        linked: true,
        page,
        pageSize,
        total,
        search: search ?? null,
        participants: rows.map((r) =>
          this.toParticipantDtoFromEvent(r, matchedEmails),
        ),
      };
    }

    const where = buildZoomAttendanceParticipantListWhere(
      { sessionId },
      search,
    );
    const { total, page, rows } = await this.prisma.$transaction(async (tx) => {
      const total = await tx.zoomAttendanceParticipant.count({ where });
      const page = clampAttendanceListPage(requestedPage, total, pageSize);
      const skip = (page - 1) * pageSize;
      const rows = await tx.zoomAttendanceParticipant.findMany({
        where,
        orderBy: { joinTime: 'desc' },
        skip,
        take: pageSize,
      });
      return { total, page, rows };
    });
    return {
      sessionId,
      linked: false,
      page,
      pageSize,
      total,
      search: search ?? null,
      participants: rows.map((r) => ({
        id: r.id,
        zoomParticipantId: r.zoomParticipantId ?? '',
        participantName: r.participantName,
        participantEmail: r.participantEmail,
        joinTime: r.joinTime.toISOString(),
        leaveTime: r.leaveTime?.toISOString() ?? null,
        durationSeconds: r.durationSeconds,
        isHost: r.isHost,
        source: 'STAGING' as const,
        matchedRegistration: false,
      })),
    };
  }

  /** Move staged attendees into WebinarParticipantEvent after catalog Link. */
  async migrateStagingToProgram(sessionId: string, programId: string) {
    const staged = await this.prisma.zoomAttendanceParticipant.findMany({
      where: { sessionId },
    });
    if (staged.length === 0) return 0;

    let migrated = 0;
    for (const row of staged) {
      const upserted = await this.upsertReportParticipant({
        programId,
        zoomMeetingId: row.zoomMeetingId,
        participant: {
          id: row.zoomParticipantId,
          name: row.participantName ?? undefined,
          userEmail: row.participantEmail ?? undefined,
          joinTime: row.joinTime.toISOString(),
          leaveTime: row.leaveTime?.toISOString(),
          durationSeconds: row.durationSeconds ?? undefined,
          internalUser: row.isHost,
        },
        importJobId: row.importJobId,
      });
      if (upserted) migrated += 1;
    }

    await this.prisma.zoomAttendanceParticipant.deleteMany({
      where: { sessionId },
    });

    await this.reportExport.reexportAfterLink(sessionId, programId);

    return migrated;
  }

  async runJob(jobId: string): Promise<void> {
    if (this.runningJobId && this.runningJobId !== jobId) return;
    this.runningJobId = jobId;

    try {
      const job = await this.prisma.zoomAttendanceImportJob.findUnique({
        where: { id: jobId },
      });
      if (!job || job.status === ZoomSyncJobStatus.COMPLETED) return;

      await this.prisma.zoomAttendanceImportJob.update({
        where: { id: jobId },
        data: {
          status: ZoomSyncJobStatus.RUNNING,
          startedAt: job.startedAt ?? new Date(),
        },
      });

      const sessionFilter = {
        sessionType:
          job.sessionTypeFilter ?? ProgramZoomSessionType.WEBINAR,
        startTime: {
          gte: job.fromDate,
          lte: job.toDate,
        },
      };

      const sessions = await this.prisma.zoomRecordingSession.findMany({
        where: sessionFilter,
        orderBy: [{ startTime: 'desc' }],
      });

      const progress: ImportProgress = {
        sessionsTotal: sessions.length,
        sessionsDone: 0,
        participantsUpserted: 0,
        registrationsAutoVerified: 0,
        reportsExported: 0,
        reportExportErrors: [],
        errors: [],
      };

      await this.prisma.zoomAttendanceImportJob.update({
        where: { id: jobId },
        data: { progressJson: progress },
      });

      const autoVerifiedPrograms = new Set<string>();

      for (const session of sessions) {
        try {
          const result = await this.importParticipantsForSession(session, {
            importJobId: jobId,
          });
          progress.participantsUpserted += result.upserted;
          if (result.reportExported) {
            progress.reportsExported += 1;
          } else if (result.reportExportError) {
            progress.reportExportErrors.push(
              `${session.zoomMeetingId}: ${result.reportExportError}`,
            );
          }

          if (
            job.runAutoVerify &&
            session.programId &&
            !autoVerifiedPrograms.has(session.programId)
          ) {
            const verified =
              await this.registrations.autoVerifyAttendanceFromZoomJoins(
                session.programId,
              );
            progress.registrationsAutoVerified += verified.verifiedCount;
            autoVerifiedPrograms.add(session.programId);
          }
        } catch (err) {
          const msg = formatZoomHttpError(err);
          progress.errors.push(`${session.zoomMeetingId}: ${msg}`);
          this.logger.warn(
            `Attendance import failed for ${session.zoomMeetingId}: ${msg}`,
          );
        }
        progress.sessionsDone += 1;
        await this.prisma.zoomAttendanceImportJob.update({
          where: { id: jobId },
          data: { progressJson: progress },
        });
      }

      await this.prisma.zoomAttendanceImportJob.update({
        where: { id: jobId },
        data: {
          status: ZoomSyncJobStatus.COMPLETED,
          finishedAt: new Date(),
          progressJson: progress,
          errorMessage:
            progress.errors.length > 0
              ? progress.errors.slice(0, 5).join('; ')
              : null,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.prisma.zoomAttendanceImportJob.update({
        where: { id: jobId },
        data: {
          status: ZoomSyncJobStatus.FAILED,
          finishedAt: new Date(),
          errorMessage: msg.slice(0, 1000),
        },
      });
      this.logger.error(`Attendance import job ${jobId} failed: ${msg}`);
    } finally {
      if (this.runningJobId === jobId) {
        this.runningJobId = null;
      }
    }
  }

  private async importParticipantsForSession(
    session: {
      id: string;
      zoomMeetingId: string;
      zoomUuid: string | null;
      sessionType: ProgramZoomSessionType;
      programId: string | null;
    },
    opts: { importJobId?: string },
  ): Promise<{
    upserted: number;
    errors: string[];
    reportExported: boolean;
    reportParticipantCount: number;
    reportExportError?: string;
  }> {
    const participants = await this.zoom.listReportParticipantsForSession({
      sessionType: session.sessionType,
      meetingId: session.zoomMeetingId,
      zoomUuid: session.zoomUuid,
    });

    let upserted = 0;
    const errors: string[] = [];

    for (const p of participants) {
      if (!canImportReportParticipant(p)) continue;
      try {
        if (session.programId) {
          const ok = await this.upsertReportParticipant({
            programId: session.programId,
            zoomMeetingId: session.zoomMeetingId,
            participant: p,
            importJobId: opts.importJobId,
          });
          if (ok) upserted += 1;
        } else {
          const ok = await this.upsertStagingParticipant({
            sessionId: session.id,
            zoomMeetingId: session.zoomMeetingId,
            participant: p,
            importJobId: opts.importJobId,
          });
          if (ok) upserted += 1;
        }
      } catch (err) {
        errors.push(`${reportParticipantLabel(p)}: ${formatZoomHttpError(err)}`);
      }
    }

    const reportResult = await this.reportExport.exportFromZoomParticipants(
      session,
      participants,
      opts.importJobId,
    );

    await this.prisma.zoomRecordingSession.update({
      where: { id: session.id },
      data: { attendanceLastImportedAt: new Date() },
    });

    return {
      upserted,
      errors,
      reportExported: reportResult.exported,
      reportParticipantCount: reportResult.participantCount,
      reportExportError: reportResult.error,
    };
  }

  private async upsertReportParticipant(opts: {
    programId: string;
    zoomMeetingId: string;
    participant: ZoomReportParticipant;
    importJobId?: string | null;
  }): Promise<boolean> {
    const joinTime = this.parseReportTime(opts.participant.joinTime);
    if (!joinTime || !canImportReportParticipant(opts.participant)) return false;

    const zoomParticipantId = normalizeReportZoomParticipantId(opts.participant.id);
    const email = normalizeReportParticipantEmail(opts.participant.userEmail);
    let userId: string | null = null;
    if (email) {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      userId = user?.id ?? null;
    }

    const data = {
      userId,
      participantName: opts.participant.name?.trim() || null,
      participantEmail: email,
      leaveTime: this.parseReportTime(opts.participant.leaveTime),
      durationSeconds: opts.participant.durationSeconds ?? null,
      isHost: !!opts.participant.internalUser,
      importJobId: opts.importJobId ?? null,
    };

    if (zoomParticipantId) {
      await this.prisma.webinarParticipantEvent.upsert({
        where: {
          programId_zoomParticipantId_event_source_joinTime: {
            programId: opts.programId,
            zoomParticipantId,
            event: 'JOINED',
            source: WebinarParticipantEventSource.REPORT_IMPORT,
            joinTime,
          },
        },
        create: {
          programId: opts.programId,
          event: 'JOINED',
          zoomMeetingId: opts.zoomMeetingId,
          zoomParticipantId,
          occurredAt: joinTime,
          source: WebinarParticipantEventSource.REPORT_IMPORT,
          joinTime,
          rawPayload: { source: 'report_import' },
          ...data,
        },
        update: data,
      });
      return true;
    }

    const existing = await this.prisma.webinarParticipantEvent.findFirst({
      where: {
        programId: opts.programId,
        event: 'JOINED',
        source: WebinarParticipantEventSource.REPORT_IMPORT,
        joinTime,
        zoomParticipantId: null,
        ...(email ? { participantEmail: email } : { participantName: opts.participant.name?.trim() || null }),
      },
    });

    if (existing) {
      await this.prisma.webinarParticipantEvent.update({
        where: { id: existing.id },
        data: {
          ...data,
          zoomMeetingId: opts.zoomMeetingId,
        },
      });
    } else {
      await this.prisma.webinarParticipantEvent.create({
        data: {
          programId: opts.programId,
          event: 'JOINED',
          zoomMeetingId: opts.zoomMeetingId,
          zoomParticipantId: null,
          occurredAt: joinTime,
          source: WebinarParticipantEventSource.REPORT_IMPORT,
          joinTime,
          rawPayload: { source: 'report_import' },
          ...data,
        },
      });
    }
    return true;
  }

  private async upsertStagingParticipant(opts: {
    sessionId: string;
    zoomMeetingId: string;
    participant: ZoomReportParticipant;
    importJobId?: string | null;
  }): Promise<boolean> {
    const joinTime = this.parseReportTime(opts.participant.joinTime);
    if (!joinTime || !canImportReportParticipant(opts.participant)) return false;

    const zoomParticipantId = normalizeReportZoomParticipantId(opts.participant.id);
    const email = normalizeReportParticipantEmail(opts.participant.userEmail);
    const data = {
      participantName: opts.participant.name?.trim() || null,
      participantEmail: email,
      leaveTime: this.parseReportTime(opts.participant.leaveTime),
      durationSeconds: opts.participant.durationSeconds ?? null,
      isHost: !!opts.participant.internalUser,
      importJobId: opts.importJobId ?? null,
    };

    if (zoomParticipantId) {
      const existing = await this.prisma.zoomAttendanceParticipant.findFirst({
        where: {
          sessionId: opts.sessionId,
          zoomParticipantId,
          joinTime,
        },
      });
      if (existing) {
        await this.prisma.zoomAttendanceParticipant.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await this.prisma.zoomAttendanceParticipant.create({
          data: {
            sessionId: opts.sessionId,
            zoomMeetingId: opts.zoomMeetingId,
            zoomParticipantId,
            joinTime,
            ...data,
          },
        });
      }
      return true;
    }

    const existing = await this.prisma.zoomAttendanceParticipant.findFirst({
      where: {
        sessionId: opts.sessionId,
        joinTime,
        zoomParticipantId: null,
        ...(email ? { participantEmail: email } : { participantName: opts.participant.name?.trim() || null }),
      },
    });

    if (existing) {
      await this.prisma.zoomAttendanceParticipant.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await this.prisma.zoomAttendanceParticipant.create({
        data: {
          sessionId: opts.sessionId,
          zoomMeetingId: opts.zoomMeetingId,
          zoomParticipantId: null,
          joinTime,
          ...data,
        },
      });
    }
    return true;
  }

  private parseReportTime(value?: string | null): Date | null {
    if (!value?.trim()) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private async matchedRegistrationEmails(programId: string): Promise<Set<string>> {
    const regs = await this.prisma.programRegistration.findMany({
      where: { programId, status: 'APPROVED' },
      select: { user: { select: { email: true } } },
    });
    return new Set(regs.map((r) => r.user.email.trim().toLowerCase()));
  }

  private toParticipantDtoFromEvent(
    row: {
      id: string;
      zoomParticipantId: string | null;
      participantName: string | null;
      participantEmail: string | null;
      joinTime: Date | null;
      leaveTime: Date | null;
      durationSeconds: number | null;
      isHost: boolean;
      source: WebinarParticipantEventSource;
    },
    matchedEmails: Set<string>,
  ): AttendanceParticipantDto {
    const email = row.participantEmail?.trim().toLowerCase() ?? null;
    return {
      id: row.id,
      zoomParticipantId: row.zoomParticipantId ?? '',
      participantName: row.participantName,
      participantEmail: row.participantEmail,
      joinTime: (row.joinTime ?? new Date()).toISOString(),
      leaveTime: row.leaveTime?.toISOString() ?? null,
      durationSeconds: row.durationSeconds,
      isHost: row.isHost,
      source: row.source,
      matchedRegistration: email ? matchedEmails.has(email) : false,
    };
  }
}
