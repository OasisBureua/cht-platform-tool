import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'stream';
import {
  contentTypeFor,
  downloadFilename,
  inlineContentType,
  type RecordingUrlDisposition,
} from './zoom-recordings-media.util';

const PRESIGN_EXPIRES_SEC = 15 * 60;

@Injectable()
export class ZoomRecordingsStorageService {
  private readonly logger = new Logger(ZoomRecordingsStorageService.name);
  private readonly s3: S3Client;

  constructor(private readonly config: ConfigService) {
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

  recordingsBucket(): string {
    return (
      this.config.get<string>('zoomRecordings.s3Bucket')?.trim() ||
      this.config.get<string>('sessionAssets.s3Bucket')?.trim() ||
      ''
    );
  }

  isStorageConfigured(): boolean {
    return !!this.recordingsBucket();
  }

  get client(): S3Client {
    return this.s3;
  }

  async uploadBuffer(opts: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<void> {
    const bucket = this.recordingsBucket();
    await this.s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: opts.key,
        Body: opts.body,
        ContentType: opts.contentType,
      }),
    );
  }

  /** Multipart upload for large Zoom video/audio streams. */
  async uploadStream(opts: {
    key: string;
    body: Readable;
    contentType: string;
  }): Promise<void> {
    const bucket = this.recordingsBucket();
    const partSizeMb =
      this.config.get<number>('zoomRecordings.multipartPartSizeMb') ?? 10;
    const upload = new Upload({
      client: this.s3,
      params: {
        Bucket: bucket,
        Key: opts.key,
        Body: opts.body,
        ContentType: opts.contentType,
      },
      partSize: partSizeMb * 1024 * 1024,
      leavePartsOnError: false,
    });
    upload.on('httpUploadProgress', (progress) => {
      if (progress.loaded && progress.total) {
        const pct = Math.round((progress.loaded / progress.total) * 100);
        if (pct % 25 === 0) {
          this.logger.debug(`S3 upload ${opts.key}: ${pct}%`);
        }
      }
    });
    await upload.done();
  }

  async createPresignedDownloadUrl(opts: {
    bucket: string;
    key: string;
    fileType: string;
    fileExtension: string | null;
    zoomRecordingFileId: string;
    chmAssetFilename?: string | null;
    disposition?: RecordingUrlDisposition;
  }): Promise<{ url: string; expiresInSeconds: number }> {
    const ext = opts.fileExtension || 'bin';
    const disposition =
      opts.disposition === 'inline' ? 'inline' : 'attachment';
    const contentType =
      disposition === 'inline'
        ? inlineContentType(opts.fileType, ext)
        : contentTypeFor(opts.fileType, ext);

    const command = new GetObjectCommand({
      Bucket: opts.bucket,
      Key: opts.key,
      ResponseContentType: contentType,
      ResponseContentDisposition:
        disposition === 'inline'
          ? 'inline'
          : `attachment; filename="${downloadFilename({
              chmAssetFilename: opts.chmAssetFilename,
              fileType: opts.fileType,
              zoomRecordingFileId: opts.zoomRecordingFileId,
              fileExtension: opts.fileExtension,
            })}"`,
    });
    const url = await getSignedUrl(this.s3, command, {
      expiresIn: PRESIGN_EXPIRES_SEC,
    });
    return { url, expiresInSeconds: PRESIGN_EXPIRES_SEC };
  }

  async createPresignedObjectDownloadUrl(opts: {
    bucket: string;
    key: string;
    contentType: string;
    filename: string;
    disposition?: RecordingUrlDisposition;
  }): Promise<{ url: string; expiresInSeconds: number }> {
    const disposition =
      opts.disposition === 'inline' ? 'inline' : 'attachment';
    const command = new GetObjectCommand({
      Bucket: opts.bucket,
      Key: opts.key,
      ResponseContentType: opts.contentType,
      ResponseContentDisposition:
        disposition === 'inline'
          ? 'inline'
          : `attachment; filename="${opts.filename.replace(/"/g, '')}"`,
    });
    const url = await getSignedUrl(this.s3, command, {
      expiresIn: PRESIGN_EXPIRES_SEC,
    });
    return { url, expiresInSeconds: PRESIGN_EXPIRES_SEC };
  }
}
