import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ProgramZoomSessionType,
  ZoomSyncJobStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ZoomService } from '../webinars/zoom.service';
import { buildMonthWindows } from './zoom-sync-date.util';
import { ZoomRecordingsSessionService } from './zoom-recordings-session.service';
import { extForFile } from './zoom-recordings-media.util';
import { formatZoomHttpError } from './zoom-http-error.util';

type SyncProgress = {
  monthsTotal: number;
  monthsDone: number;
  sessionsUpserted: number;
  fileStubsUpserted: number;
  errors: string[];
};

@Injectable()
export class ZoomRecordingsSyncService {
  private readonly logger = new Logger(ZoomRecordingsSyncService.name);
  private runningJobId: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly zoom: ZoomService,
    private readonly sessions: ZoomRecordingsSessionService,
  ) {}

  async startSync(opts: {
    monthsBack?: number;
    sessionTypeFilter?: ProgramZoomSessionType | null;
    startedByUserId?: string;
  }) {
    if (!this.zoom.isConfigured()) {
      throw new ServiceUnavailableException('Zoom API is not configured');
    }
    if (this.runningJobId) {
      throw new BadRequestException(
        'A Zoom sync is already running. Wait for it to finish before starting another.',
      );
    }

    const monthsBack =
      opts.monthsBack ??
      this.config.get<number>('zoomRecordings.syncMonthsBackDefault') ??
      24;
    const toDate = new Date(
      Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate(),
      ),
    );
    const fromDate = new Date(toDate);
    fromDate.setUTCMonth(fromDate.getUTCMonth() - monthsBack);

    const job = await this.prisma.zoomSyncJob.create({
      data: {
        status: ZoomSyncJobStatus.QUEUED,
        monthsBack,
        sessionTypeFilter: opts.sessionTypeFilter ?? null,
        fromDate,
        toDate,
        startedByUserId: opts.startedByUserId ?? null,
        progressJson: {
          monthsTotal: buildMonthWindows(fromDate, toDate).length,
          monthsDone: 0,
          sessionsUpserted: 0,
          fileStubsUpserted: 0,
          errors: [],
        },
      },
    });

    void this.runJob(job.id);
    return job;
  }

  async getJob(jobId: string) {
    const job = await this.prisma.zoomSyncJob.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new NotFoundException('Sync job not found');
    return job;
  }

  async getLatestJob() {
    return this.prisma.zoomSyncJob.findFirst({
      orderBy: { createdAt: 'desc' },
    });
  }

  async runJob(jobId: string): Promise<void> {
    if (this.runningJobId && this.runningJobId !== jobId) return;
    this.runningJobId = jobId;

    try {
      const job = await this.prisma.zoomSyncJob.findUnique({
        where: { id: jobId },
      });
      if (!job || job.status === ZoomSyncJobStatus.COMPLETED) return;

      await this.prisma.zoomSyncJob.update({
        where: { id: jobId },
        data: {
          status: ZoomSyncJobStatus.RUNNING,
          startedAt: job.startedAt ?? new Date(),
        },
      });

      const progress: SyncProgress = {
        monthsTotal: buildMonthWindows(job.fromDate, job.toDate).length,
        monthsDone: 0,
        sessionsUpserted: 0,
        fileStubsUpserted: 0,
        errors: [],
      };

      const windows = buildMonthWindows(job.fromDate, job.toDate);
      for (const window of windows) {
        try {
          const sessions = await this.zoom.listAccountRecordingsInRange({
            from: window.from,
            to: window.to,
          });
          for (const summary of sessions) {
            if (!summary.id) continue;

            const linked = await this.sessions.findProgramByZoomMeetingId(
              summary.id,
            );
            const session = await this.sessions.ensureSessionFromSync({
              meetingId: summary.id,
              topic: summary.topic,
              sessionType:
                linked?.zoomSessionType ?? ProgramZoomSessionType.WEBINAR,
              startTime: summary.startTime
                ? new Date(summary.startTime)
                : null,
              durationMinutes: summary.duration ?? null,
              zoomUuid: summary.uuid,
              hostEmail: summary.hostEmail,
              totalSizeBytes: summary.totalSize ?? null,
              programId: linked?.id ?? null,
            });
            progress.sessionsUpserted += 1;

            for (const file of summary.recordingFiles) {
              if (!file.id) continue;
              await this.sessions.upsertFileStub({
                sessionId: session.id,
                programId: linked?.id ?? null,
                zoomMeetingId: summary.id,
                zoomRecordingFileId: file.id,
                fileType: file.fileType,
                recordingType: file.recordingType ?? null,
                fileExtension: extForFile(file.fileType, file.fileExtension),
                fileSizeBytes: file.fileSize ?? null,
                recordingStart: file.recordingStart
                  ? new Date(file.recordingStart)
                  : null,
                recordingEnd: file.recordingEnd
                  ? new Date(file.recordingEnd)
                  : null,
                topic: summary.topic ?? null,
              });
              progress.fileStubsUpserted += 1;
            }
          }
        } catch (err) {
          const msg = formatZoomHttpError(err);
          progress.errors.push(`${window.from}..${window.to}: ${msg}`);
          this.logger.warn(`Zoom sync window failed: ${msg}`);
        }
        progress.monthsDone += 1;
        await this.prisma.zoomSyncJob.update({
          where: { id: jobId },
          data: { progressJson: progress },
        });
      }

      await this.prisma.zoomSyncJob.update({
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
      await this.prisma.zoomSyncJob.update({
        where: { id: jobId },
        data: {
          status: ZoomSyncJobStatus.FAILED,
          finishedAt: new Date(),
          errorMessage: msg.slice(0, 1000),
        },
      });
      this.logger.error(`Zoom sync job ${jobId} failed: ${msg}`);
    } finally {
      if (this.runningJobId === jobId) {
        this.runningJobId = null;
      }
    }
  }
}
