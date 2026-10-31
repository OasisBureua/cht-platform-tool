import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import {
  GetTranscriptionJobCommand,
  StartTranscriptionJobCommand,
  TranscribeClient,
  type LanguageCode,
  type MediaFormat,
} from '@aws-sdk/client-transcribe';
import { Prisma, type PostProductionTranscript } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ZoomRecordingsStorageService } from '../zoom-recordings/zoom-recordings-storage.service';
import {
  cleanCues,
  cuesFromTranscribe,
  type TranscribeOutput,
  type TranscriptCue,
} from './transcribe-output.util';

/** Everything post-production writes lives under the prefix the task role can already read and write. */
const PREFIX = 'zoom-recordings/post-production';
const FORMATS: Record<string, MediaFormat> = {
  m4a: 'm4a',
  mp4: 'mp4',
  mp3: 'mp3',
  wav: 'wav',
  flac: 'flac',
  ogg: 'ogg',
  webm: 'webm',
};

export type TranscriptView = {
  id: string;
  sourceKey: string;
  title: string;
  status: PostProductionTranscript['status'];
  error: string | null;
  cues: TranscriptCue[] | null;
  edited: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Transcripts for the clipper, written by AWS Transcribe with speaker
 * labels. Jobs start from a Zoom recording already in S3, or from a small
 * audio track the browser pulled out of a local or Dropbox file. Status is
 * refreshed when the clipper polls; corrections replace the cues.
 */
@Injectable()
export class PostProductionTranscriptsService {
  private readonly logger = new Logger(PostProductionTranscriptsService.name);
  private readonly transcribe: TranscribeClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly storage: ZoomRecordingsStorageService,
  ) {
    const region = this.config.get<string>('aws.region') || 'us-east-1';
    const accessKeyId = this.config.get<string>('aws.accessKeyId');
    const secretAccessKey = this.config.get<string>('aws.secretAccessKey');
    this.transcribe = new TranscribeClient({
      region,
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
  }

  enabled(): boolean {
    return (
      !!this.config.get<boolean>('postProduction.transcribeEnabled') &&
      this.storage.isStorageConfigured()
    );
  }

  private assertEnabled() {
    if (!this.enabled()) {
      throw new ServiceUnavailableException(
        'Transcripts from audio are not switched on for this environment.',
      );
    }
  }

  private view(t: PostProductionTranscript): TranscriptView {
    return {
      id: t.id,
      sourceKey: t.sourceKey,
      title: t.title,
      status: t.status,
      error: t.error,
      cues: (t.cues as TranscriptCue[] | null) ?? null,
      edited: t.edited,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  async findLatest(sourceKey: string): Promise<TranscriptView | null> {
    if (!sourceKey) throw new BadRequestException('sourceKey is required');
    const t = await this.prisma.postProductionTranscript.findFirst({
      where: { sourceKey },
      orderBy: { createdAt: 'desc' },
    });
    return t ? this.view(await this.refresh(t)) : null;
  }

  async get(id: string): Promise<TranscriptView> {
    const t = await this.prisma.postProductionTranscript.findUnique({
      where: { id },
    });
    if (!t) throw new NotFoundException('Transcript not found');
    return this.view(await this.refresh(t));
  }

  /** From an audio track uploaded by the clipper. */
  async startFromAudio(opts: {
    audio: Buffer;
    fileName: string;
    contentType: string;
    sourceKey: string;
    title: string;
    userId?: string;
  }): Promise<TranscriptView> {
    this.assertEnabled();
    if (!opts.audio?.length) throw new BadRequestException('No audio');
    const ext = (
      /\.([a-z0-9]+)$/i.exec(opts.fileName)?.[1] ?? 'm4a'
    ).toLowerCase();
    const format = FORMATS[ext];
    if (!format)
      throw new BadRequestException(`Unsupported audio type .${ext}`);
    const t = await this.prisma.postProductionTranscript.create({
      data: {
        sourceKey: opts.sourceKey,
        title: opts.title.slice(0, 300),
        createdByUserId: opts.userId,
      },
    });
    const key = `${PREFIX}/audio/${t.id}.${ext}`;
    await this.storage.uploadBuffer({
      key,
      body: opts.audio,
      contentType: opts.contentType || 'audio/mp4',
    });
    return this.view(
      await this.startJob(
        t,
        `s3://${this.storage.recordingsBucket()}/${key}`,
        format,
      ),
    );
  }

  /** Straight from a Zoom recording file already pulled into S3. */
  async startFromZoom(opts: {
    sessionId: string;
    fileId: string;
    sourceKey: string;
    title: string;
    userId?: string;
  }): Promise<TranscriptView> {
    this.assertEnabled();
    const file = await this.prisma.zoomRecordingFile.findFirst({
      where: { id: opts.fileId, sessionId: opts.sessionId },
    });
    if (!file?.s3Key) {
      throw new NotFoundException('That recording file is not in storage yet.');
    }
    const ext = (file.fileExtension || 'mp4').toLowerCase();
    const format = FORMATS[ext] ?? 'mp4';
    const bucket = file.s3Bucket || this.storage.recordingsBucket();
    const t = await this.prisma.postProductionTranscript.create({
      data: {
        sourceKey: opts.sourceKey,
        title: opts.title.slice(0, 300),
        createdByUserId: opts.userId,
      },
    });
    return this.view(
      await this.startJob(t, `s3://${bucket}/${file.s3Key}`, format),
    );
  }

  private async startJob(
    t: PostProductionTranscript,
    mediaUri: string,
    format: MediaFormat,
  ): Promise<PostProductionTranscript> {
    const jobName = `chm-pp-${t.id}`;
    const outputKey = `${PREFIX}/transcripts/${t.id}.json`;
    try {
      await this.transcribe.send(
        new StartTranscriptionJobCommand({
          TranscriptionJobName: jobName,
          LanguageCode: (this.config.get<string>(
            'postProduction.languageCode',
          ) || 'en-US') as LanguageCode,
          MediaFormat: format,
          Media: { MediaFileUri: mediaUri },
          OutputBucketName: this.storage.recordingsBucket(),
          OutputKey: outputKey,
          Settings: { ShowSpeakerLabels: true, MaxSpeakerLabels: 6 },
        }),
      );
      return this.prisma.postProductionTranscript.update({
        where: { id: t.id },
        data: {
          status: 'IN_PROGRESS',
          jobName,
          mediaS3Uri: mediaUri,
          outputS3Key: outputKey,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Transcribe job ${jobName} failed to start: ${message}`,
      );
      return this.prisma.postProductionTranscript.update({
        where: { id: t.id },
        data: {
          status: 'FAILED',
          error: `Couldn't start: ${message}`.slice(0, 1000),
        },
      });
    }
  }

  /** Checks a running job; when it's done, reads the result and stores the cues. */
  private async refresh(
    t: PostProductionTranscript,
  ): Promise<PostProductionTranscript> {
    if ((t.status !== 'IN_PROGRESS' && t.status !== 'QUEUED') || !t.jobName)
      return t;
    try {
      const { TranscriptionJob: job } = await this.transcribe.send(
        new GetTranscriptionJobCommand({ TranscriptionJobName: t.jobName }),
      );
      const state = job?.TranscriptionJobStatus;
      if (state === 'FAILED') {
        return this.prisma.postProductionTranscript.update({
          where: { id: t.id },
          data: {
            status: 'FAILED',
            error: (job?.FailureReason || 'Transcribe failed').slice(0, 1000),
          },
        });
      }
      if (state !== 'COMPLETED' || !t.outputS3Key) return t;
      const obj = await this.storage.client.send(
        new GetObjectCommand({
          Bucket: this.storage.recordingsBucket(),
          Key: t.outputS3Key,
        }),
      );
      const text = await obj.Body?.transformToString();
      if (!text) throw new Error('Empty Transcribe output');
      const cues = cuesFromTranscribe(JSON.parse(text) as TranscribeOutput);
      return this.prisma.postProductionTranscript.update({
        where: { id: t.id },
        data: {
          status: 'COMPLETED',
          cues: cues as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      // leave it running; the next poll tries again
      this.logger.warn(
        `Transcript ${t.id} refresh failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return t;
    }
  }

  async saveCorrections(id: string, input: unknown): Promise<TranscriptView> {
    const cues = cleanCues(input);
    if (!cues.length)
      throw new BadRequestException('No transcript lines to save');
    const t = await this.prisma.postProductionTranscript.findUnique({
      where: { id },
    });
    if (!t) throw new NotFoundException('Transcript not found');
    if (t.status !== 'COMPLETED') {
      throw new BadRequestException('The transcript is still being written');
    }
    const saved = await this.prisma.postProductionTranscript.update({
      where: { id },
      data: { cues: cues as unknown as Prisma.InputJsonValue, edited: true },
    });
    return this.view(saved);
  }
}
