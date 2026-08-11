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

/** Zoom panelist URLs share the webinar path; uniqueness is in the `tk=` query param. */
function panelistUrlLogLabel(joinUrl: string): string {
  try {
    const u = new URL(joinUrl);
    const tk = u.searchParams.get('tk');
    if (tk) {
      return `${u.origin}${u.pathname} (token …${tk.slice(-12)})`;
    }
    return joinUrl;
  } catch {
    return joinUrl;
  }
}

/**
 * Zoom start_time must be `yyyy-MM-ddTHH:mm:ssZ` (GMT) or `yyyy-MM-ddTHH:mm:ss` (local + timezone).
 * Fractional seconds are unsupported and cause Zoom to mis-read GMT times as local wall-clock
 * (e.g. 4:00 PM EDT → `20:00:00.000Z` → shown as 8:00 PM Eastern).
 */
export function formatZoomStartTime(startTime: string): string {
  const trimmed = startTime.trim();
  const withOffset = trimmed.match(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})$/i,
  );
  if (withOffset) {
    const suffix = withOffset[2].toUpperCase();
    if (suffix === 'Z') return `${withOffset[1]}Z`;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().replace(/\.\d{3}Z$/, 'Z');
    }
  }
  const local = trimmed.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d+)?$/);
  if (local) return local[1];
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  return trimmed;
}

@Injectable()
export class ZoomService implements OnModuleInit {
  private readonly logger = new Logger(ZoomService.name);
  private cachedToken: string | null = null;
  private tokenExpiry = 0;

  onModuleInit() {
    if (this.isConfigured()) {
      this.logger.log(
        'Zoom API: configured (webinars + meetings / office hours)',
      );
    } else {
      this.logger.log(
        'Zoom API: not configured. Add ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET for webinar integration.',
      );
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

  private zoomErrorMessage(err: unknown): string {
    const base = err instanceof Error ? err.message : String(err);
    const body =
      err != null && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: unknown; status?: number } }).response
        : undefined;
    const detail = body?.data ? JSON.stringify(body.data) : '';
    const status = body?.status ? ` HTTP ${body.status}` : '';
    return `${base}${status}${detail ? `: ${detail}` : ''}`;
  }

  /** Upcoming sessions within this many months (inclusive) from today. */
  private upcomingWindowEnd(monthsAhead = 12): Date {
    const now = new Date();
    return new Date(
      now.getFullYear(),
      now.getMonth() + monthsAhead + 1,
      0,
      23,
      59,
      59,
    );
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
    const endWindow = this.upcomingWindowEnd(12);

    try {
      do {
        const token = await this.getAccessToken();
        const params: Record<string, string | number> = {
          type: 'upcoming',
          page_size: 100,
        };
        if (pageToken) params.next_page_token = pageToken;

        const { data } = await firstValueFrom(
          this.http.get<ZoomWebinarsResponse>(
            'https://api.zoom.us/v2/users/me/webinars',
            {
              params,
              headers: { Authorization: `Bearer ${token}` },
            },
          ),
        );

        const batch = (data.webinars || [])
          .filter((w) => {
            if (!w.start_time) return true;
            const t = new Date(w.start_time).getTime();
            return t <= endWindow.getTime();
          })
          .map((w) => ({
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

        const lastItem = data.webinars?.[data.webinars.length - 1];
        const lastTime = lastItem?.start_time
          ? new Date(lastItem.start_time).getTime()
          : 0;
        if (lastTime > endWindow.getTime()) break;

        pageToken = data.next_page_token;
      } while (pageToken);

      this.logger.log(
        `Zoom: fetched ${all.length} upcoming webinar(s) within the next 12 months`,
      );
      return all;
    } catch (err) {
      this.logger.warn(
        `Zoom listWebinars failed: ${this.zoomErrorMessage(err)}`,
      );
      return all;
    }
  }

  async listScheduledMeetings(): Promise<ZoomWebinar[]> {
    if (!this.isConfigured()) return [];

    const all: ZoomWebinar[] = [];
    let pageToken: string | undefined;
    const endWindow = this.upcomingWindowEnd(12);

    try {
      do {
        const token = await this.getAccessToken();
        const params: Record<string, string | number> = {
          type: 'upcoming',
          page_size: 100,
        };
        if (pageToken) params.next_page_token = pageToken;

        const { data } = await firstValueFrom(
          this.http.get<ZoomMeetingsListResponse>(
            'https://api.zoom.us/v2/users/me/meetings',
            {
              params,
              headers: { Authorization: `Bearer ${token}` },
            },
          ),
        );

        const batch = (data.meetings || [])
          .filter((m) => {
            if (!m.start_time) return true;
            const t = new Date(m.start_time).getTime();
            return t <= endWindow.getTime();
          })
          .map((m) => ({
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

        const lastItem = data.meetings?.[data.meetings.length - 1];
        const lastTime = lastItem?.start_time
          ? new Date(lastItem.start_time).getTime()
          : 0;
        if (lastTime > endWindow.getTime()) break;

        pageToken = data.next_page_token;
      } while (pageToken);

      this.logger.log(
        `Zoom: fetched ${all.length} upcoming meeting(s) within the next 12 months`,
      );
      return all;
    } catch (err) {
      this.logger.warn(
        `Zoom listScheduledMeetings failed: ${this.zoomErrorMessage(err)}`,
      );
      return all;
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

    const startTime = formatZoomStartTime(params.startTime);
    this.logger.log(
      `Zoom: creating webinar "${params.topic}" at ${startTime} (${params.timezone ?? 'America/New_York'}, ${params.duration} min)`,
    );

    const token = await this.getAccessToken();
    const { data } = await firstValueFrom(
      this.http.post<ZoomWebinarResponse>(
        'https://api.zoom.us/v2/users/me/webinars',
        {
          topic: params.topic,
          agenda: params.agenda,
          start_time: startTime,
          duration: params.duration,
          timezone: params.timezone || 'America/New_York',
          type: 5, // Webinar type
        },
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    );

    this.logger.log(
      `Zoom: webinar created: id=${data.id} topic="${data.topic}" join_url=${data.join_url} (attendee / silent participant link)`,
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
    if (params.startTime) body.start_time = formatZoomStartTime(params.startTime);
    if (params.duration !== undefined) body.duration = params.duration;
    if (params.timezone) body.timezone = params.timezone;

    await firstValueFrom(
      this.http.patch(`https://api.zoom.us/v2/webinars/${webinarId}`, body, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    this.logger.log(`Zoom: updated webinar ${webinarId}`);
  }

  /**
   * Add panelists to a Zoom Webinar (one POST per panelist so Zoom assigns distinct join URLs).
   * Docs: POST /v2/webinars/{webinarId}/panelists
   */
  async addWebinarPanelists(
    webinarId: string,
    panelists: Array<{ name: string; email: string }>,
  ): Promise<
    Array<{ id: string; name: string; email: string; joinUrl: string }>
  > {
    if (!this.isConfigured()) throw new Error('Zoom not configured');
    if (!panelists.length) return [];

    this.logger.log(
      `Zoom: adding ${panelists.length} panelist(s) to webinar ${webinarId}: ${panelists.map((p) => p.email).join(', ')}`,
    );

    const token = await this.getAccessToken();

    for (const panelist of panelists) {
      try {
        await firstValueFrom(
          this.http.post(
            `https://api.zoom.us/v2/webinars/${webinarId}/panelists`,
            { panelists: [panelist] },
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        );
      } catch (err: unknown) {
        const axiosBody =
          err != null && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: unknown; status?: number } })
                .response
            : undefined;
        const detail = axiosBody?.data ? JSON.stringify(axiosBody.data) : '';
        const status = axiosBody?.status;
        // Panelist may already exist on refresh/retry, continue unless it's a hard failure.
        if (status === 400 && /already/i.test(detail)) {
          this.logger.warn(
            `Zoom: panelist ${panelist.email} already on webinar ${webinarId}, skipping add`,
          );
          continue;
        }
        const base = err instanceof Error ? err.message : String(err);
        throw new Error(
          `${base}${status ? ` (HTTP ${status})` : ''}${detail ? `: Zoom response: ${detail}` : ''}`,
        );
      }
    }

    // Allow Zoom a moment to populate per-panelist join URLs before GET.
    await new Promise((resolve) => setTimeout(resolve, 750));

    let fromZoom: Array<{
      id: string;
      name: string;
      email: string;
      joinUrl: string;
    }> = [];
    try {
      fromZoom = await this.getWebinarPanelists(webinarId);
    } catch (gErr) {
      const gMsg = gErr instanceof Error ? gErr.message : String(gErr);
      this.logger.warn(
        `Zoom: GET panelists failed for webinar ${webinarId}: ${gMsg}`,
      );
    }

    const byEmail = new Map(
      fromZoom.map((p) => [p.email.trim().toLowerCase(), p]),
    );

    const results = panelists.map((requested) => {
      const match = byEmail.get(requested.email.trim().toLowerCase());
      return {
        id: match?.id ?? '',
        name: requested.name,
        email: requested.email,
        joinUrl: match?.joinUrl?.trim() ?? '',
      };
    });

    const joinUrls = results.map((p) => p.joinUrl).filter(Boolean);
    const uniqueJoinUrls = new Set(joinUrls);
    if (joinUrls.length > 0 && uniqueJoinUrls.size < joinUrls.length) {
      this.logger.warn(
        `Zoom: duplicate panelist join URLs detected for webinar ${webinarId}: check Webinar add-on and panelist settings`,
      );
    }

    this.logger.log(
      `Zoom: retrieved ${results.length} panelist(s) for webinar ${webinarId}`,
    );
    results.forEach((p) => {
      if (p.joinUrl) {
        this.logger.log(
          `Zoom: panelist join URL: ${p.name} <${p.email}>: ${panelistUrlLogLabel(p.joinUrl)}`,
        );
      } else {
        this.logger.warn(
          `Zoom: no join_url for panelist ${p.email} on webinar ${webinarId}`,
        );
      }
    });

    return results;
  }

  /**
   * Fetch the current panelist list for a Zoom Webinar (with join URLs).
   * Docs: GET /v2/webinars/{webinarId}/panelists
   */
  async getWebinarPanelists(
    webinarId: string,
  ): Promise<
    Array<{ id: string; name: string; email: string; joinUrl: string }>
  > {
    if (!this.isConfigured()) return [];
    const token = await this.getAccessToken();
    const res = await firstValueFrom(
      this.http.get<{
        panelists: Array<{
          id: string;
          name: string;
          email: string;
          join_url: string;
        }>;
      }>(`https://api.zoom.us/v2/webinars/${webinarId}/panelists`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    return (res.data.panelists ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      joinUrl: p.join_url,
    }));
  }

  /**
   * Update display names for panelists created with zsoccerguy+user{n}@gmail.com emails (see admin webinar create).
   * Docs: PATCH /v2/webinars/{webinarId}/panelists/{panelistId}
   */
  async syncWebinarSpeakerDisplayNames(
    webinarId: string,
    speakerNames: string[],
  ): Promise<void> {
    if (!this.isConfigured() || !speakerNames.length) return;

    const panelists = await this.getWebinarPanelists(webinarId);
    const token = await this.getAccessToken();

    for (let i = 0; i < speakerNames.length; i++) {
      const desiredName = speakerNames[i]?.trim();
      if (!desiredName) continue;

      const expectedEmail = `zsoccerguy+user${i + 1}@gmail.com`.toLowerCase();
      const match = panelists.find(
        (p) => p.email.toLowerCase() === expectedEmail,
      );
      if (!match?.id || match.name === desiredName) continue;

      try {
        await firstValueFrom(
          this.http.patch(
            `https://api.zoom.us/v2/webinars/${webinarId}/panelists/${match.id}`,
            { name: desiredName },
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        );
        this.logger.log(
          `Zoom: updated panelist name for ${expectedEmail} → "${desiredName}" on webinar ${webinarId}`,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Zoom: failed to update panelist name for ${expectedEmail} on webinar ${webinarId}: ${msg}`,
        );
      }
    }
  }

  async deleteWebinar(webinarId: string): Promise<void> {
    if (!this.isConfigured()) return;

    try {
      const token = await this.getAccessToken();
      await firstValueFrom(
        this.http.delete(`https://api.zoom.us/v2/webinars/${webinarId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
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

    const startTime = formatZoomStartTime(params.startTime);
    this.logger.log(
      `Zoom: creating meeting (office hours) "${params.topic}" at ${startTime} (${params.timezone ?? 'America/New_York'}, ${params.duration} min)`,
    );

    const token = await this.getAccessToken();
    const { data } = await firstValueFrom(
      this.http.post<ZoomMeetingApiResponse>(
        'https://api.zoom.us/v2/users/me/meetings',
        {
          topic: params.topic,
          type: 2,
          start_time: startTime,
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

    this.logger.log(
      `Zoom: meeting (office hours) created: id=${data.id} topic="${data.topic}" join_url=${data.join_url}`,
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
  }

  async getMeetingById(meetingId: string): Promise<ZoomWebinar | null> {
    if (!this.isConfigured()) return null;

    try {
      const token = await this.getAccessToken();
      const { data } = await firstValueFrom(
        this.http.get<ZoomMeetingApiResponse>(
          `https://api.zoom.us/v2/meetings/${meetingId}`,
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
    if (params.startTime) body.start_time = formatZoomStartTime(params.startTime);
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
