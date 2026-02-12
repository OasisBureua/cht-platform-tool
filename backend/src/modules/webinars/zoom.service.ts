import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface ZoomWebinar {
  id: string;
  uuid: string;
  topic: string;
  agenda?: string;
  startTime: string;
  duration: number;
  joinUrl: string;
  startUrl: string;
  timezone: string;
  thumbnail?: string;
}

interface ZoomTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface ZoomWebinarsResponse {
  webinars: Array<{
    id: string;
    uuid: string;
    topic: string;
    agenda?: string;
    start_time: string;
    duration: number;
    join_url: string;
    start_url: string;
    timezone: string;
  }>;
}

@Injectable()
export class ZoomService {
  private readonly logger = new Logger(ZoomService.name);
  private cachedToken: string | null = null;
  private tokenExpiry = 0;

  constructor(
    private config: ConfigService,
    private http: HttpService,
  ) {}

  isConfigured(): boolean {
    const accountId = this.config.get<string>('zoom.accountId');
    const clientId = this.config.get<string>('zoom.clientId');
    const clientSecret = this.config.get<string>('zoom.clientSecret');
    return !!(accountId && clientId && clientSecret);
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiry - 60000) {
      return this.cachedToken;
    }

    const accountId = this.config.get<string>('zoom.accountId');
    const clientId = this.config.get<string>('zoom.clientId');
    const clientSecret = this.config.get<string>('zoom.clientSecret');

    if (!accountId || !clientId || !clientSecret) {
      throw new Error('Zoom credentials not configured');
    }

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const { data } = await firstValueFrom(
      this.http.post<ZoomTokenResponse>(
        `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
        null,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      ),
    );

    this.cachedToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
    return this.cachedToken;
  }

  async listWebinars(): Promise<ZoomWebinar[]> {
    if (!this.isConfigured()) return [];

    try {
      const token = await this.getAccessToken();
      const { data } = await firstValueFrom(
        this.http.get<ZoomWebinarsResponse>('https://api.zoom.us/v2/users/me/webinars', {
          params: { type: 'scheduled', page_size: 50 },
          headers: { Authorization: `Bearer ${token}` },
        }),
      );

      return (data.webinars || []).map((w) => ({
        id: String(w.id),
        uuid: w.uuid,
        topic: w.topic,
        agenda: w.agenda,
        startTime: w.start_time,
        duration: w.duration,
        joinUrl: w.join_url,
        startUrl: w.start_url,
        timezone: w.timezone,
      }));
    } catch (err) {
      this.logger.warn(`Zoom API failed: ${err}`);
      return [];
    }
  }
}
