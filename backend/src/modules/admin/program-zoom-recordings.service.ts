import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../../prisma/prisma.service';
import { ZoomService } from '../webinars/zoom.service';

const PRESIGN_EXPIRES_SEC = 15 * 60;

function extForFile(fileType: string, fileExtension?: string | null): string {
  if (fileExtension?.trim()) {
    const e = fileExtension.trim().replace(/^\./, '').toLowerCase();
    return e || 'bin';
  }
  const t = fileType.toUpperCase();
  if (t === 'MP4') return 'mp4';
  if (t === 'M4A') return 'm4a';
  if (t === 'TIMELINE') return 'json';
  if (t === 'TRANSCRIPT' || t === 'CC') return 'vtt';
  if (t === 'CHAT') return 'txt';
  if (t === 'CSV') return 'csv';
  return 'bin';
}

function contentTypeFor(fileType: string, ext: string): string {
  const t = fileType.toUpperCase();
  if (t === 'MP4' || ext === 'mp4') return 'video/mp4';
  if (t === 'M4A' || ext === 'm4a') return 'audio/mp4';
  if (ext === 'vtt') return 'text/vtt';
  if (ext === 'txt') return 'text/plain';
  if (ext === 'json') return 'application/json';
  if (ext === 'csv') return 'text/csv';
  return 'application/octet-stream';
}

@Injectable()
export class ProgramZoomRecordingsService {
  private readonly logger = new Logger(ProgramZoomRecordingsService.name);
  private readonly s3: S3Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly zoom: ZoomService,
  ) {
    const region = this.config.get<string>('aws.region') || 'us-east-1';
    const accessKeyId = this.config.get<string>('aws.accessKeyId');
    const secretAccessKey = this.config.get<string>('aws.secretAccessKey');
    this.s3 = new S3Client({
      region,
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
  }

  private recordingsBucket(): string {
    return (
      this.config.get<string>('zoomRecordings.s3Bucket')?.trim() ||
      this.config.get<string>('sessionAssets.s3Bucket')?.trim() ||
      ''
    );
  }

  isStorageConfigured(): boolean {
    return !!this.recordingsBucket();
  }

  async list(programId: string) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: { id: true },
    });
    if (!program) throw new NotFoundException('Program not found');

    const rows = await this.prisma.programZoomRecording.findMany({
      where: { programId },
      orderBy: [{ recordingStart: 'desc' }, { pulledAt: 'desc' }],
    });

    return {
      storageConfigured: this.isStorageConfigured(),
      zoomConfigured: this.zoom.isConfigured(),
      recordings: rows.map((r) => this.toDto(r)),
    };
  }

  async pull(
    programId: string,
    opts: { zoomMeetingId?: string; adminUserId?: string },
  ) {
    if (!this.zoom.isConfigured()) {
      throw new ServiceUnavailableException('Zoom API is not configured');
    }
    const bucket = this.recordingsBucket();
    if (!bucket) {
      throw new ServiceUnavailableException(
        'Zoom recordings S3 is not configured. Set SESSION_ASSETS_S3_BUCKET (files go under zoom-recordings/).',
      );
    }

    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: { id: true, zoomMeetingId: true, title: true },
    });
    if (!program) throw new NotFoundException('Program not found');

    const meetingId =
      opts.zoomMeetingId?.trim() || program.zoomMeetingId?.trim() || '';
    if (!meetingId) {
      throw new BadRequestException(
        'No Zoom meeting/webinar id on this program. Pass zoomMeetingId or set it on the program first.',
      );
    }

    let zoomPayload;
    try {
      zoomPayload = await this.zoom.getMeetingRecordings(meetingId);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { status?: number; data?: { message?: string; code?: number } };
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

    const completed = zoomPayload.recordingFiles.filter(
      (f) =>
        f.downloadUrl &&
        (!f.status || f.status.toLowerCase() === 'completed'),
    );
    if (completed.length === 0) {
      throw new NotFoundException(
        'Zoom returned no completed recording files yet. Wait for cloud processing and try again.',
      );
    }

    const downloadToken =
      zoomPayload.downloadAccessToken || undefined;
    const upserted: string[] = [];
    const errors: string[] = [];

    for (const file of completed) {
      try {
        const { buffer, contentType } = await this.zoom.downloadRecordingFile(
          file.downloadUrl,
          downloadToken,
        );
        const ext = extForFile(file.fileType, file.fileExtension);
        const key = `zoom-recordings/${programId}/${meetingId}/${file.id}.${ext}`;
        const ct =
          contentType?.split(';')[0]?.trim() ||
          contentTypeFor(file.fileType, ext);

        await this.s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: ct,
          }),
        );

        const row = await this.prisma.programZoomRecording.upsert({
          where: {
            programId_zoomRecordingFileId: {
              programId,
              zoomRecordingFileId: file.id,
            },
          },
          create: {
            programId,
            zoomMeetingId: meetingId,
            zoomRecordingFileId: file.id,
            fileType: file.fileType,
            recordingType: file.recordingType ?? null,
            fileExtension: ext,
            fileSizeBytes: file.fileSize ?? buffer.length,
            s3Bucket: bucket,
            s3Key: key,
            recordingStart: file.recordingStart
              ? new Date(file.recordingStart)
              : null,
            recordingEnd: file.recordingEnd
              ? new Date(file.recordingEnd)
              : null,
            topic: zoomPayload.topic ?? program.title,
            pulledByUserId: opts.adminUserId ?? null,
          },
          update: {
            zoomMeetingId: meetingId,
            fileType: file.fileType,
            recordingType: file.recordingType ?? null,
            fileExtension: ext,
            fileSizeBytes: file.fileSize ?? buffer.length,
            s3Bucket: bucket,
            s3Key: key,
            recordingStart: file.recordingStart
              ? new Date(file.recordingStart)
              : null,
            recordingEnd: file.recordingEnd
              ? new Date(file.recordingEnd)
              : null,
            topic: zoomPayload.topic ?? program.title,
            pulledAt: new Date(),
            pulledByUserId: opts.adminUserId ?? null,
          },
        });
        upserted.push(row.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Failed to pull Zoom file ${file.id} for program ${programId}: ${msg}`,
        );
        errors.push(`${file.fileType}/${file.id}: ${msg}`);
      }
    }

    if (upserted.length === 0) {
      throw new BadRequestException(
        errors.length
          ? `Failed to store recordings: ${errors.join('; ')}`
          : 'No recording files were stored.',
      );
    }

    const list = await this.list(programId);
    return {
      ...list,
      pulledCount: upserted.length,
      zoomMeetingId: meetingId,
      topic: zoomPayload.topic,
      errors: errors.length ? errors : undefined,
    };
  }

  async createDownloadUrl(programId: string, recordingId: string) {
    const row = await this.prisma.programZoomRecording.findFirst({
      where: { id: recordingId, programId },
    });
    if (!row) throw new NotFoundException('Recording not found');

    const command = new GetObjectCommand({
      Bucket: row.s3Bucket,
      Key: row.s3Key,
    });
    const url = await getSignedUrl(this.s3, command, {
      expiresIn: PRESIGN_EXPIRES_SEC,
    });

    return {
      url,
      expiresInSeconds: PRESIGN_EXPIRES_SEC,
      recording: this.toDto(row),
    };
  }

  private toDto(r: {
    id: string;
    programId: string;
    zoomMeetingId: string;
    zoomRecordingFileId: string;
    fileType: string;
    recordingType: string | null;
    fileExtension: string | null;
    fileSizeBytes: number | null;
    s3Bucket: string;
    s3Key: string;
    recordingStart: Date | null;
    recordingEnd: Date | null;
    topic: string | null;
    pulledAt: Date;
    pulledByUserId: string | null;
  }) {
    return {
      id: r.id,
      programId: r.programId,
      zoomMeetingId: r.zoomMeetingId,
      zoomRecordingFileId: r.zoomRecordingFileId,
      fileType: r.fileType,
      recordingType: r.recordingType,
      fileExtension: r.fileExtension,
      fileSizeBytes: r.fileSizeBytes,
      topic: r.topic,
      recordingStart: r.recordingStart?.toISOString() ?? null,
      recordingEnd: r.recordingEnd?.toISOString() ?? null,
      pulledAt: r.pulledAt.toISOString(),
      pulledByUserId: r.pulledByUserId,
    };
  }
}
