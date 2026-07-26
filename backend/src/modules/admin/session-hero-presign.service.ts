import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

const EXT_BY_MIME: Record<(typeof ALLOWED_CONTENT_TYPES)[number], string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const MAX_BYTES = 5 * 1024 * 1024;
const PRESIGN_EXPIRES_SEC = 120;

function safeFileStem(raw: string): string {
  const base = raw.replace(/^.*[/\\]/, '').slice(0, 120);
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'image';
}

@Injectable()
export class SessionHeroPresignService {
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

  isEnabled(): boolean {
    const bucket =
      this.config.get<string>('sessionAssets.s3Bucket')?.trim() || '';
    const base =
      this.config.get<string>('sessionAssets.publicUrlBase')?.trim() || '';
    return !!(bucket && base);
  }

  async createPresignedPut(params: {
    contentType: string;
    contentLength: number;
    fileName?: string;
  }): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
    const bucket =
      this.config.get<string>('sessionAssets.s3Bucket')?.trim() || '';
    const publicUrlBase =
      this.config.get<string>('sessionAssets.publicUrlBase')?.trim() || '';
    if (!bucket || !publicUrlBase) {
      throw new ServiceUnavailableException(
        'Session hero uploads are not configured.',
      );
    }

    const ct = params.contentType.trim().toLowerCase();
    if (
      !ALLOWED_CONTENT_TYPES.includes(
        ct as (typeof ALLOWED_CONTENT_TYPES)[number],
      )
    ) {
      throw new BadRequestException(
        `Unsupported content type. Allowed: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
      );
    }
    const len = params.contentLength;
    if (!Number.isInteger(len) || len < 1 || len > MAX_BYTES) {
      throw new BadRequestException(
        `File size must be between 1 and ${MAX_BYTES} bytes.`,
      );
    }

    const ext = EXT_BY_MIME[ct as (typeof ALLOWED_CONTENT_TYPES)[number]];
    let stem = params.fileName ? safeFileStem(params.fileName) : 'hero';
    const lowerStem = stem.toLowerCase();
    const hasKnownExt = ALLOWED_CONTENT_TYPES.some((mime) => {
      const e = EXT_BY_MIME[mime];
      return lowerStem.endsWith(e);
    });
    if (!hasKnownExt) {
      stem = `${stem}${ext}`;
    }

    const key = `session-heroes/${randomUUID()}-${stem}`;
    const normalizedBase = publicUrlBase.replace(/\/$/, '');
    const publicUrl = `${normalizedBase}/${key}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: ct,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn: PRESIGN_EXPIRES_SEC,
    });

    return { uploadUrl, publicUrl, key };
  }
}
