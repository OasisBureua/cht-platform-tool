import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Server-side JWT for Zoom Meeting SDK (Web) join.
 * Use the General app (Meeting SDK) **Client ID** + **Client Secret** as ZOOM_SDK_KEY / ZOOM_SDK_SECRET — not S2S OAuth.
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
    const clientId = this.getSdkKey();
    const clientSecret = this.config.get<string>('zoom.sdkSecret');
    if (!clientSecret) throw new Error('ZOOM_SDK_SECRET not configured');

    // Match https://developers.zoom.us/docs/meeting-sdk/auth/ (Meeting SDK / General app Client ID + Secret).
    // iat slightly in the past avoids "Signature is invalid" when server clock lags Zoom.
    const iat = Math.floor(Date.now() / 1000) - 30;
    const exp = iat + 60 * 60 * 2;
    const mn = String(meetingNumber).replace(/\s/g, '');
    const payload = {
      appKey: clientId,
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
    const sig = crypto.createHmac('sha256', clientSecret).update(data).digest('base64');
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
