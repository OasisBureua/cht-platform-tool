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

interface ZoomMeetingsListResponse {
  meetings: Array<{
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

/** Zoom scheduled meeting API response (same shape as webinar for our mapping). */
interface ZoomMeetingApiResponse {
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
      this.logger.log('Zoom API: configured (webinars + meetings / office hours)');
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

  async listScheduledMeetings(): Promise<ZoomWebinar[]> {
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
        if (pageToken) params.next_page_token = pageToken;

        const { data } = await firstValueFrom(
          this.http.get<ZoomMeetingsListResponse>('https://api.zoom.us/v2/users/me/meetings', {
            params,
            headers: { Authorization: `Bearer ${token}` },
          }),
        );

        const batch = (data.meetings || []).map((m) => ({
          id: String(m.id),
          uuid: m.uuid,
          topic: m.topic,
          agenda: m.agenda,
          startTime: m.start_time,
          duration: m.duration,
          joinUrl: m.join_url,
          startUrl: m.start_url,
          timezone: m.timezone,
        }));
        all.push(...batch);
        pageToken = data.next_page_token;
      } while (pageToken);

      this.logger.log(`Zoom: fetched ${all.length} scheduled meetings`);
      return all;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Zoom listScheduledMeetings failed: ${msg}`);
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

  async createWebinar(params: {
    topic: string;
    agenda?: string;
    startTime: string;
    duration: number;
    timezone?: string;
  }): Promise<ZoomWebinar> {
    if (!this.isConfigured()) throw new Error('Zoom not configured');

    const token = await this.getAccessToken();
    const { data } = await firstValueFrom(
      this.http.post<ZoomWebinarResponse>(
        'https://api.zoom.us/v2/users/me/webinars',
        {
          topic: params.topic,
          agenda: params.agenda,
          start_time: params.startTime,
          duration: params.duration,
          timezone: params.timezone || 'America/New_York',
          type: 5, // Webinar type
        },
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    );

    this.logger.log(`Zoom: created webinar ${data.id} - ${data.topic}`);
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
  }

  async updateWebinar(
    webinarId: string,
    params: {
      topic?: string;
      agenda?: string;
      startTime?: string;
      duration?: number;
      timezone?: string;
    },
  ): Promise<void> {
    if (!this.isConfigured()) return;

    const token = await this.getAccessToken();
    const body: Record<string, unknown> = {};
    if (params.topic) body.topic = params.topic;
    if (params.agenda !== undefined) body.agenda = params.agenda;
    if (params.startTime) body.start_time = params.startTime;
    if (params.duration !== undefined) body.duration = params.duration;
    if (params.timezone) body.timezone = params.timezone;

    await firstValueFrom(
      this.http.patch(
        `https://api.zoom.us/v2/webinars/${webinarId}`,
        body,
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    );
    this.logger.log(`Zoom: updated webinar ${webinarId}`);
  }

  async deleteWebinar(webinarId: string): Promise<void> {
    if (!this.isConfigured()) return;

    try {
      const token = await this.getAccessToken();
      await firstValueFrom(
        this.http.delete(
          `https://api.zoom.us/v2/webinars/${webinarId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
      this.logger.log(`Zoom: deleted webinar ${webinarId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Zoom deleteWebinar ${webinarId} failed: ${msg}`);
    }
  }

  /**
   * Scheduled Zoom Meeting (type 2) tuned for real-world office hours:
   * - Join before host: attendees can open the link early; with waiting room on they wait until the host admits them
   * - Waiting room: set here via API (see settings.waiting_room); account-level Zoom settings can still enforce stricter rules
   * - Mic/camera not forced off on entry (conversational Q&A)
   * - VoIP + phone; multiple devices allowed
   */
  async createMeetingForOfficeHours(params: {
    topic: string;
    agenda?: string;
    startTime: string;
    duration: number;
    timezone?: string;
  }): Promise<ZoomWebinar> {
    if (!this.isConfigured()) throw new Error('Zoom not configured');

    const token = await this.getAccessToken();
    const { data } = await firstValueFrom(
      this.http.post<ZoomMeetingApiResponse>(
        'https://api.zoom.us/v2/users/me/meetings',
        {
          topic: params.topic,
          type: 2,
          start_time: params.startTime,
          duration: params.duration,
          timezone: params.timezone || 'America/New_York',
          agenda: params.agenda,
          settings: {
            join_before_host: true,
            jbh_time: 0,
            waiting_room: true,
            mute_upon_entry: false,
            participant_video: true,
            audio: 'both',
            allow_multiple_devices: true,
            auto_recording: 'none',
          },
        },
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    );

    this.logger.log(`Zoom: created meeting (office hours) ${data.id} - ${data.topic}`);
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
  }

  async getMeetingById(meetingId: string): Promise<ZoomWebinar | null> {
    if (!this.isConfigured()) return null;

    try {
      const token = await this.getAccessToken();
      const { data } = await firstValueFrom(
        this.http.get<ZoomMeetingApiResponse>(`https://api.zoom.us/v2/meetings/${meetingId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
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
      this.logger.warn(`Zoom getMeeting ${meetingId} failed: ${msg}`);
      return null;
    }
  }

  async updateMeeting(
    meetingId: string,
    params: {
      topic?: string;
      agenda?: string;
      startTime?: string;
      duration?: number;
      timezone?: string;
    },
  ): Promise<void> {
    if (!this.isConfigured()) return;

    const token = await this.getAccessToken();
    const body: Record<string, unknown> = {};
    if (params.topic) body.topic = params.topic;
    if (params.agenda !== undefined) body.agenda = params.agenda;
    if (params.startTime) body.start_time = params.startTime;
    if (params.duration !== undefined) body.duration = params.duration;
    if (params.timezone) body.timezone = params.timezone;

    await firstValueFrom(
      this.http.patch(`https://api.zoom.us/v2/meetings/${meetingId}`, body, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    this.logger.log(`Zoom: updated meeting ${meetingId}`);
  }

  async deleteMeeting(meetingId: string): Promise<void> {
    if (!this.isConfigured()) return;

    try {
      const token = await this.getAccessToken();
      await firstValueFrom(
        this.http.delete(`https://api.zoom.us/v2/meetings/${meetingId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      this.logger.log(`Zoom: deleted meeting ${meetingId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Zoom deleteMeeting ${meetingId} failed: ${msg}`);
    }
  }
}
