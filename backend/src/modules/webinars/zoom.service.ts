import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
    id: string | number;
    uuid: string;
    topic: string;
    agenda?: string;
    start_time: string;
    duration: number;
    join_url: string;
    start_url: string;
    timezone: string;
  }>;
  next_page_token?: string;
}

interface ZoomWebinarResponse {
  id: number;
  uuid: string;
  topic: string;
  agenda?: string;
  start_time: string;
  duration: number;
  join_url: string;
  start_url: string;
  timezone: string;
}

@Injectable()
export class ZoomService implements OnModuleInit {
  private readonly logger = new Logger(ZoomService.name);
  private cachedToken: string | null = null;
  private tokenExpiry = 0;

  onModuleInit() {
    if (this.isConfigured()) {
      this.logger.log('Zoom API: configured (webinars)');
    } else {
      this.logger.log('Zoom API: not configured. Add ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET for webinar integration.');
    }
  }

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

    const all: ZoomWebinar[] = [];
    let pageToken: string | undefined;

    try {
      do {
        const token = await this.getAccessToken();
        const params: Record<string, string | number> = {
          type: 'scheduled',
          page_size: 100,
        };
        if (pageToken) params.page_token = pageToken;

        const { data } = await firstValueFrom(
          this.http.get<ZoomWebinarsResponse>(
            'https://api.zoom.us/v2/users/me/webinars',
            {
              params,
              headers: { Authorization: `Bearer ${token}` },
            },
          ),
        );

        const batch = (data.webinars || []).map((w) => ({
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
        all.push(...batch);
        pageToken = data.next_page_token;
      } while (pageToken);

      this.logger.log(`Zoom: fetched ${all.length} scheduled webinars`);
      return all;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Zoom listWebinars failed: ${msg}`);
      return [];
    }
  }

  /**
   * Get a single webinar by ID (more efficient than listing all).
   */
  async getWebinarById(webinarId: string): Promise<ZoomWebinar | null> {
    if (!this.isConfigured()) return null;

    try {
      const token = await this.getAccessToken();
      const { data } = await firstValueFrom(
        this.http.get<ZoomWebinarResponse>(
          `https://api.zoom.us/v2/webinars/${webinarId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        ),
      );

      return {
        id: String(data.id),
        uuid: data.uuid,
        topic: data.topic,
        agenda: data.agenda,
        startTime: data.start_time,
        duration: data.duration,
        joinUrl: data.join_url,
        startUrl: data.start_url,
        timezone: data.timezone,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Zoom getWebinar ${webinarId} failed: ${msg}`);
      return null;
    }
  }
}
