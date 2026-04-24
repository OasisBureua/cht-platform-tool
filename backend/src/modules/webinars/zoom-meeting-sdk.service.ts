import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Server-side JWT for Zoom Meeting SDK (Web) join.
 * Credentials come from a Meeting SDK app on Zoom Marketplace - not the Server-to-Server OAuth app.
 * @see https://developers.zoom.us/docs/meeting-sdk/auth/
 */
@Injectable()
export class ZoomMeetingSdkService {
  private readonly logger = new Logger(ZoomMeetingSdkService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const key = this.config.get<string>('zoom.sdkKey');
    const secret = this.config.get<string>('zoom.sdkSecret');
    return !!key && !!secret;
  }

  getSdkKey(): string {
    const key = this.config.get<string>('zoom.sdkKey');
    if (!key) throw new Error('ZOOM_SDK_KEY not configured');
    return key;
  }

  /** role 0 = participant, 1 = host (use 0 for HCP join) */
  generateSignature(meetingNumber: string, role: 0 | 1): string {
    const sdkKey = this.getSdkKey();
    const sdkSecret = this.config.get<string>('zoom.sdkSecret');
    if (!sdkSecret) throw new Error('ZOOM_SDK_SECRET not configured');

    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 60 * 60 * 2;
    const mn = String(meetingNumber).replace(/\s/g, '');
    const payload = {
      sdkKey,
      appKey: sdkKey,
      mn,
      role,
      iat,
      exp,
      tokenExp: exp,
    };
    const header = { alg: 'HS256' as const, typ: 'JWT' };
    const encHeader = this.b64url(JSON.stringify(header));
    const encPayload = this.b64url(JSON.stringify(payload));
    const data = `${encHeader}.${encPayload}`;
    const sig = crypto.createHmac('sha256', sdkSecret).update(data).digest('base64');
    const encSig = sig.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${data}.${encSig}`;
  }

  private b64url(str: string): string {
    return Buffer.from(str, 'utf8')
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }
}
