import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Server-side JWT for Zoom Meeting SDK (Web) join.
 * Credentials: Marketplace Meeting SDK app (legacy SDK Key/Secret) OR a General App
 * with Embed → Meeting SDK enabled (Client ID/Secret).
 * @see https://developers.zoom.us/docs/meeting-sdk/auth/
 */
@Injectable()
export class ZoomMeetingSdkService {
  private readonly logger = new Logger(ZoomMeetingSdkService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.getSdkKeyOrNull() && !!this.getSdkSecretOrNull();
  }

  getSdkKey(): string {
    const key = this.getSdkKeyOrNull();
    if (!key) throw new Error('ZOOM_SDK_KEY not configured');
    return key;
  }

  /** role 0 = participant, 1 = host (use 0 for HCP join) */
  generateSignature(meetingNumber: string, role: 0 | 1): string {
    const sdkKey = this.getSdkKey();
    const sdkSecret = this.getSdkSecretOrNull();
    if (!sdkSecret) throw new Error('ZOOM_SDK_SECRET not configured');

    const mn = String(meetingNumber).replace(/\D/g, '');
    if (!mn) {
      throw new Error('Zoom meeting/webinar number is missing or invalid');
    }

    // Match Zoom's jsrsasign sample: iat 30s in the past; exp = iat + 2h.
    const iat = Math.round(Date.now() / 1000) - 30;
    const exp = iat + 60 * 60 * 2;
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      appKey: sdkKey,
      sdkKey,
      mn,
      role,
      iat,
      exp,
      tokenExp: exp,
    };

    this.logger.log(
      `Meeting SDK JWT mn=${mn} role=${role} key=${sdkKey.slice(0, 6)}…`,
    );

    const encHeader = base64UrlJson(header);
    const encPayload = base64UrlJson(payload);
    const data = `${encHeader}.${encPayload}`;
    const signature = crypto
      .createHmac('sha256', sdkSecret)
      .update(data)
      .digest('base64url');
    return `${data}.${signature}`;
  }

  private getSdkKeyOrNull(): string | null {
    return (
      trimSecret(this.config.get<string>('zoom.sdkKey')) ||
      trimSecret(this.config.get<string>('zoom.clientId')) ||
      null
    );
  }

  private getSdkSecretOrNull(): string | null {
    const sdkSecret = trimSecret(this.config.get<string>('zoom.sdkSecret'));
    const sdkKey = trimSecret(this.config.get<string>('zoom.sdkKey'));
    if (sdkKey && sdkSecret) return sdkSecret;
    if (sdkSecret) return sdkSecret;
    return trimSecret(this.config.get<string>('zoom.clientSecret'));
  }
}

function trimSecret(value: string | undefined | null): string {
  if (!value) return '';
  return value.trim().replace(/^["']|["']$/g, '');
}

function base64UrlJson(value: object): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}
