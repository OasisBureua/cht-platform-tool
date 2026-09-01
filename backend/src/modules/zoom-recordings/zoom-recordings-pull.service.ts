import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProgramZoomSessionType, ZoomRecordingPullStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ZoomService,
  type ZoomMeetingRecordings,
  type ZoomRecordingFile,
} from '../webinars/zoom.service';
import { ChmContentIdService } from './chm-content-id.service';
import { buildChmAssetFilenameForZoomFile } from './chm-content-id.util';
import {
  buildRecordingS3Key,
  extForFile,
  shouldStreamFileType,
  storedContentType,
} from './zoom-recordings-media.util';
import { ZoomRecordingsSessionService } from './zoom-recordings-session.service';
import { ZoomRecordingsStorageService } from './zoom-recordings-storage.service';

export type ZoomRecordingFileDto = {
  id: string;
  programId: string;
  zoomMeetingId: string;
  zoomRecordingFileId: string;
  fileType: string;
  recordingType: string | null;
  fileExtension: string | null;
  fileSizeBytes: number | null;
  topic: string | null;
  recordingStart: string | null;
  recordingEnd: string | null;
  pulledAt: string | null;
  pulledByUserId: string | null;
  pullStatus: string;
  storedInS3: boolean;
};

@Injectable()
export class ZoomRecordingsPullService {
  private readonly logger = new Logger(ZoomRecordingsPullService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly zoom: ZoomService,
    private readonly chmContentId: ChmContentIdService,
    private readonly sessions: ZoomRecordingsSessionService,
    private readonly storage: ZoomRecordingsStorageService,
  ) {}

  toDto(r: {
    id: string;
    programId: string | null;
    zoomMeetingId: string;
    zoomRecordingFileId: string;
    fileType: string;
    recordingType: string | null;
    fileExtension: string | null;
    fileSizeBytes: number | null;
    recordingStart: Date | null;
    recordingEnd: Date | null;
    topic: string | null;
    pulledAt: Date | null;
    pulledByUserId: string | null;
    pullStatus?: string;
    s3Bucket?: string | null;
    s3Key?: string | null;
  }): ZoomRecordingFileDto {
    const storedInS3 = !!(r.s3Bucket && r.s3Key);
    return {
      id: r.id,
      programId: r.programId ?? '',
      zoomMeetingId: r.zoomMeetingId,
      zoomRecordingFileId: r.zoomRecordingFileId,
      fileType: r.fileType,
      recordingType: r.recordingType,
      fileExtension: r.fileExtension,
      fileSizeBytes: r.fileSizeBytes,
      topic: r.topic,
      recordingStart: r.recordingStart?.toISOString() ?? null,
      recordingEnd: r.recordingEnd?.toISOString() ?? null,
      pulledAt: r.pulledAt?.toISOString() ?? null,
      pulledByUserId: r.pulledByUserId,
      pullStatus: r.pullStatus ?? (storedInS3 ? 'COMPLETED' : 'PENDING'),
      storedInS3,
    };
  }

  async pullForProgram(
    programId: string,
    opts: { zoomMeetingId?: string; adminUserId?: string },
  ) {
    if (!this.zoom.isConfigured()) {
      throw new ServiceUnavailableException('Zoom API is not configured');
    }
    if (!this.storage.isStorageConfigured()) {
      throw new ServiceUnavailableException(
        'Zoom recordings S3 is not configured. Set SESSION_ASSETS_S3_BUCKET (files go under zoom-recordings/).',
      );
    }

    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: {
        id: true,
        zoomMeetingId: true,
        title: true,
        zoomSessionType: true,
        chmProgramId: true,
      },
    });
    if (!program) throw new NotFoundException('Program not found');

    const meetingId =
      opts.zoomMeetingId?.trim() || program.zoomMeetingId?.trim() || '';
    if (!meetingId) {
      throw new BadRequestException(
        'No Zoom meeting/webinar id on this program. Pass zoomMeetingId or set it on the program first.',
      );
    }

    const zoomPayload = await this.fetchMeetingRecordings(meetingId);
    const completed = this.completedFiles(zoomPayload);
    if (completed.length === 0) {
      throw new NotFoundException(
        'Zoom returned no completed recording files yet. Wait for cloud processing and try again.',
      );
    }

    const session = await this.sessions.ensureSessionForProgram({
      programId,
      meetingId,
      topic: zoomPayload.topic ?? program.title,
      sessionType: program.zoomSessionType,
      startTime: zoomPayload.startTime ? new Date(zoomPayload.startTime) : null,
      durationMinutes: zoomPayload.duration ?? null,
      chmProgramId: program.chmProgramId,
      zoomUuid: zoomPayload.uuid,
      totalSizeBytes: zoomPayload.totalSize ?? null,
    });

    const result = await this.pullFiles({
      meetingId,
      programId,
      sessionId: session.id,
      topic: zoomPayload.topic ?? program.title,
      chmProgramId:
        session.chmProgramId?.trim() || program.chmProgramId?.trim() || '',
      files: completed,
      downloadToken: zoomPayload.downloadAccessToken,
      adminUserId: opts.adminUserId,
    });

    if (result.upserted.length === 0) {
      throw new BadRequestException(
        result.errors.length
          ? `Failed to store recordings: ${result.errors.join('; ')}`
          : 'No recording files were stored.',
      );
    }

    return {
      upserted: result.upserted,
      errors: result.errors,
      zoomMeetingId: meetingId,
      topic: zoomPayload.topic,
    };
  }

  async pullForSession(
    sessionId: string,
    opts: { adminUserId?: string; fileTypes?: string[] },
  ) {
    if (!this.zoom.isConfigured()) {
      throw new ServiceUnavailableException('Zoom API is not configured');
    }
    if (!this.storage.isStorageConfigured()) {
      throw new ServiceUnavailableException(
        'Zoom recordings S3 is not configured. Set SESSION_ASSETS_S3_BUCKET.',
      );
    }

    const session = await this.prisma.zoomRecordingSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Zoom recording session not found');

    const zoomPayload = await this.fetchMeetingRecordings(session.zoomMeetingId);
    let completed = this.completedFiles(zoomPayload);
    if (opts.fileTypes?.length) {
      const allowed = new Set(opts.fileTypes.map((t) => t.toUpperCase()));
      completed = completed.filter((f) => allowed.has(f.fileType.toUpperCase()));
    }
    if (completed.length === 0) {
      throw new NotFoundException(
        'Zoom returned no completed recording files for this session.',
      );
    }

    let chmProgramId = session.chmProgramId?.trim() || '';
    if (!chmProgramId && session.programId) {
      const program = await this.prisma.program.findUnique({
        where: { id: session.programId },
        select: { chmProgramId: true },
      });
      chmProgramId = program?.chmProgramId?.trim() || '';
    }

    return this.pullFiles({
      meetingId: session.zoomMeetingId,
      programId: session.programId,
      sessionId: session.id,
      topic: zoomPayload.topic ?? session.topic ?? null,
      chmProgramId,
      files: completed,
      downloadToken: zoomPayload.downloadAccessToken,
      adminUserId: opts.adminUserId,
    }).then((result) => {
      if (result.upserted.length === 0) {
        throw new BadRequestException(
          result.errors.length
            ? `Failed to store recordings: ${result.errors.join('; ')}`
            : 'No recording files were stored.',
        );
      }
      return result;
    });
  }

  private async fetchMeetingRecordings(
    meetingId: string,
  ): Promise<ZoomMeetingRecordings> {
    try {
      return await this.zoom.getMeetingRecordings(meetingId);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { status?: number; data?: { message?: string } };
        message?: string;
      };
      const status = axiosErr.response?.status;
      const zoomMsg = axiosErr.response?.data?.message;
      if (status === 404) {
        throw new NotFoundException(
          zoomMsg ||
            'No cloud recording found for this Zoom id (not ready, deleted, or wrong id).',
        );
      }
      if (status === 401 || status === 403) {
        throw new ServiceUnavailableException(
          zoomMsg ||
            'Zoom rejected the recordings request. Check cloud_recording scopes and mint a fresh token.',
        );
      }
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Zoom getMeetingRecordings failed: ${msg}`);
      throw new BadRequestException(
        `Could not fetch Zoom recordings: ${zoomMsg || msg}`,
      );
    }
  }

  private completedFiles(zoomPayload: ZoomMeetingRecordings): ZoomRecordingFile[] {
    return zoomPayload.recordingFiles.filter(
      (f) =>
        f.downloadUrl &&
        (!f.status || f.status.toLowerCase() === 'completed'),
    );
  }

  private async pullFiles(opts: {
    meetingId: string;
    programId: string | null;
    sessionId: string;
    topic: string | null;
    chmProgramId: string;
    files: ZoomRecordingFile[];
    downloadToken?: string;
    adminUserId?: string;
  }): Promise<{ upserted: string[]; errors: string[] }> {
    const bucket = this.storage.recordingsBucket();
    const streamTypes =
      this.config.get<string[]>('zoomRecordings.streamFileTypes') ??
      ['MP4', 'M4A'];
    const upserted: string[] = [];
    const errors: string[] = [];
    const assetSeqByFormat = new Map<string, number>();

    for (const file of opts.files) {
      try {
        const ext = extForFile(file.fileType, file.fileExtension);
        const key = buildRecordingS3Key({
          programId: opts.programId,
          meetingId: opts.meetingId,
          fileId: file.id,
          ext,
        });

        const useStream = shouldStreamFileType(file.fileType, streamTypes);
        let contentType: string | undefined;
        let fileSizeBytes = file.fileSize ?? null;

        if (useStream) {
          const streamed = await this.zoom.downloadRecordingFileStream(
            file.downloadUrl,
            opts.downloadToken,
          );
          contentType = streamed.contentType;
          const ct = storedContentType(file.fileType, ext, contentType);
          await this.storage.uploadStream({
            key,
            body: streamed.stream,
            contentType: ct,
          });
        } else {
          const downloaded = await this.zoom.downloadRecordingFile(
            file.downloadUrl,
            opts.downloadToken,
          );
          contentType = downloaded.contentType;
          const ct = storedContentType(file.fileType, ext, contentType);
          fileSizeBytes = file.fileSize ?? downloaded.buffer.length;
          await this.storage.uploadBuffer({
            key,
            body: downloaded.buffer,
            contentType: ct,
          });
        }

        const assetFormat = this.chmContentId.zoomFileTypeToAssetFormat(
          file.fileType,
        );
        const assetSequence = (assetSeqByFormat.get(assetFormat) ?? 0) + 1;
        assetSeqByFormat.set(assetFormat, assetSequence);
        const chmAssetFilename = opts.chmProgramId
          ? buildChmAssetFilenameForZoomFile({
              chmProgramId: opts.chmProgramId,
              zoomFileType: file.fileType,
              fileExtension: ext,
              assetSequence,
            })
          : null;

        const row = await this.prisma.zoomRecordingFile.upsert({
          where: {
            zoomMeetingId_zoomRecordingFileId: {
              zoomMeetingId: opts.meetingId,
              zoomRecordingFileId: file.id,
            },
          },
          create: {
            sessionId: opts.sessionId,
            programId: opts.programId,
            zoomMeetingId: opts.meetingId,
            zoomRecordingFileId: file.id,
            fileType: file.fileType,
            recordingType: file.recordingType ?? null,
            fileExtension: ext,
            fileSizeBytes,
            s3Bucket: bucket,
            s3Key: key,
            chmAssetFilename,
            pullStatus: ZoomRecordingPullStatus.COMPLETED,
            pullError: null,
            recordingStart: file.recordingStart
              ? new Date(file.recordingStart)
              : null,
            recordingEnd: file.recordingEnd
              ? new Date(file.recordingEnd)
              : null,
            topic: opts.topic,
            pulledAt: new Date(),
            pulledByUserId: opts.adminUserId ?? null,
          },
          update: {
            sessionId: opts.sessionId,
            programId: opts.programId,
            fileType: file.fileType,
            recordingType: file.recordingType ?? null,
            fileExtension: ext,
            fileSizeBytes,
            s3Bucket: bucket,
            s3Key: key,
            chmAssetFilename,
            pullStatus: ZoomRecordingPullStatus.COMPLETED,
            pullError: null,
            recordingStart: file.recordingStart
              ? new Date(file.recordingStart)
              : null,
            recordingEnd: file.recordingEnd
              ? new Date(file.recordingEnd)
              : null,
            topic: opts.topic,
            pulledAt: new Date(),
            pulledByUserId: opts.adminUserId ?? null,
          },
        });
        upserted.push(row.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Failed to pull Zoom file ${file.id} for meeting ${opts.meetingId}: ${msg}`,
        );
        errors.push(`${file.fileType}/${file.id}: ${msg}`);
        await this.prisma.zoomRecordingFile.updateMany({
          where: {
            zoomMeetingId: opts.meetingId,
            zoomRecordingFileId: file.id,
          },
          data: {
            pullStatus: ZoomRecordingPullStatus.FAILED,
            pullError: msg.slice(0, 500),
          },
        });
      }
    }

    return { upserted, errors };
  }
}
