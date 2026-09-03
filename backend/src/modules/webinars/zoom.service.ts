import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { Readable } from 'stream';
import {
  DEFAULT_ZOOM_WEBINAR_SETTINGS,
  fromZoomWebinarSettingsApi,
  isZoomAccountLockedSettingsError,
  omitAccountLockedWebinarSettings,
  toZoomWebinarSettingsApi,
  type ZoomWebinarSettings,
  type ZoomWebinarSettingsApiPayload,
} from './zoom-webinar-settings';

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
  /** Attendee/meeting passcode when Zoom returns one (needed for Meeting SDK join). */
  password?: string;
  thumbnail?: string;
  /** Webinar-only Zoom settings (Q&A, Backstage, HD, recording). */
  settings?: ZoomWebinarSettings;
  /** Zoom user id of the host (for Meeting SDK host ZAK). */
  hostId?: string;
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
  password?: string;
  host_id?: string;
  settings?: {
    practice_session?: boolean;
    hd_video?: boolean;
    send_1080p_video_to_attendees?: boolean;
    email_in_attendee_report?: boolean;
    auto_recording?: string;
    question_and_answer?: { enable?: boolean };
  };
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
  password?: string;
  host_id?: string;
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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private axiosStatus(err: unknown): number | undefined {
    if (err == null || typeof err !== 'object' || !('response' in err)) {
      return undefined;
    }
    return (err as { response?: { status?: number } }).response?.status;
  }

  private retryAfterMs(err: unknown, attempt: number): number {
    const header =
      err != null && typeof err === 'object' && 'response' in err
        ? (err as { response?: { headers?: Record<string, string> } }).response
            ?.headers?.['retry-after']
        : undefined;
    const fromHeader = header ? Number.parseInt(String(header), 10) : NaN;
    if (Number.isFinite(fromHeader) && fromHeader > 0) {
      return Math.min(fromHeader * 1000, 30_000);
    }
    return Math.min(1000 * 2 ** attempt, 16_000);
  }

  /** GET with retries on HTTP 429 (Zoom rate limits during Sync). */
  private async zoomGetWithRetry<T>(
    url: string,
    config: { params?: Record<string, string | number>; headers?: Record<string, string> },
  ): Promise<T> {
    const maxAttempts = 4;
    let lastErr: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const { data } = await firstValueFrom(
          this.http.get<T>(url, {
            ...config,
            headers: { Authorization: config.headers?.Authorization ?? '' },
          }),
        );
        return data;
      } catch (err) {
        lastErr = err;
        if (this.axiosStatus(err) === 429 && attempt < maxAttempts - 1) {
          const wait = this.retryAfterMs(err, attempt);
          this.logger.warn(
            `Zoom GET ${url} rate-limited (429); retry in ${wait}ms (attempt ${attempt + 1}/${maxAttempts})`,
          );
          await this.sleep(wait);
          continue;
        }
        throw err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  /**
   * Create/update webinars with settings. If Zoom rejects HD / 1080p / cloud
   * recording (account-locked), retry without those fields so the rest of the
   * write still succeeds and the admin UI does not show Zoom's error.
   * Every Zoom rejection is logged at error with HTTP status + response body.
   */
  private async requestWithSettingsFallback<T>(
    send: (body: Record<string, unknown>) => Promise<{ data: T }>,
    body: Record<string, unknown>,
    context: string,
  ): Promise<{ data: T }> {
    try {
      return await send(body);
    } catch (err) {
      this.logger.error(
        `Zoom ${context}: request failed: ${this.zoomErrorMessage(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      if (!body.settings || !isZoomAccountLockedSettingsError(err)) {
        throw err;
      }
      this.logger.error(
        `Zoom ${context}: treating as account-locked HD/1080p/cloud recording; retrying without those fields`,
      );
      try {
        return await send({
          ...body,
          settings: omitAccountLockedWebinarSettings(
            body.settings as ZoomWebinarSettingsApiPayload,
          ),
        });
      } catch (err2) {
        this.logger.error(
          `Zoom ${context}: retry without HD/recording failed: ${this.zoomErrorMessage(err2)}`,
          err2 instanceof Error ? err2.stack : undefined,
        );
        if (!isZoomAccountLockedSettingsError(err2)) throw err2;
        this.logger.error(
          `Zoom ${context}: treating as account-locked settings; retrying without any settings object`,
        );
        const { settings: _omit, ...withoutSettings } = body;
        if (Object.keys(withoutSettings).length === 0) {
          this.logger.error(
            `Zoom ${context}: settings-only write skipped after Zoom rejected all setting payloads`,
          );
          return { data: undefined as T };
        }
        try {
          return await send(withoutSettings);
        } catch (err3) {
          this.logger.error(
            `Zoom ${context}: retry without settings failed: ${this.zoomErrorMessage(err3)}`,
            err3 instanceof Error ? err3.stack : undefined,
          );
          throw err3;
        }
      }
    }
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
        password: data.password?.trim() || undefined,
        hostId: data.host_id?.trim() || undefined,
        settings: fromZoomWebinarSettingsApi(data.settings),
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
    settings?: ZoomWebinarSettings;
  }): Promise<ZoomWebinar> {
    if (!this.isConfigured()) throw new Error('Zoom not configured');

    const startTime = formatZoomStartTime(params.startTime);
    this.logger.log(
      `Zoom: creating webinar "${params.topic}" at ${startTime} (${params.timezone ?? 'America/New_York'}, ${params.duration} min)`,
    );

    const token = await this.getAccessToken();
    const { data } = await this.requestWithSettingsFallback<ZoomWebinarResponse>(
      (payload) =>
        firstValueFrom(
          this.http.post<ZoomWebinarResponse>(
            'https://api.zoom.us/v2/users/me/webinars',
            payload,
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        ),
      {
        topic: params.topic,
        agenda: params.agenda,
        start_time: startTime,
        duration: params.duration,
        timezone: params.timezone || 'America/New_York',
        type: 5,
        settings: toZoomWebinarSettingsApi(
          params.settings ?? DEFAULT_ZOOM_WEBINAR_SETTINGS,
        ),
      },
      `create webinar "${params.topic}"`,
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
      password: data.password?.trim() || undefined,
      settings: fromZoomWebinarSettingsApi(data.settings),
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
      settings?: ZoomWebinarSettings;
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
    if (params.settings) {
      body.settings = toZoomWebinarSettingsApi(params.settings);
    }
    if (Object.keys(body).length === 0) return;

    await this.requestWithSettingsFallback(
      (payload) =>
        firstValueFrom(
          this.http.patch(`https://api.zoom.us/v2/webinars/${webinarId}`, payload, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ),
      body,
      `update webinar ${webinarId}`,
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
      password: data.password?.trim() || undefined,
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
        password: data.password?.trim() || undefined,
        hostId: data.host_id?.trim() || undefined,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Zoom getMeeting ${meetingId} failed: ${msg}`);
      return null;
    }
  }

  /**
   * Zoom Access Key for hosting via Meeting SDK (role=1).
   * Requires Server-to-Server OAuth scope user:read:token:admin (or equivalent).
   */
  async getZakToken(zoomUserId: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Zoom not configured');
    }
    const uid = zoomUserId?.trim();
    if (!uid) {
      throw new Error('Zoom host user id is required for ZAK');
    }
    const token = await this.getAccessToken();
    const { data } = await firstValueFrom(
      this.http.get<{ token?: string }>(
        `https://api.zoom.us/v2/users/${encodeURIComponent(uid)}/token`,
        {
          params: { type: 'zak' },
          headers: { Authorization: `Bearer ${token}` },
        },
      ),
    );
    const zak = data?.token?.trim();
    if (!zak) {
      throw new Error('Zoom did not return a ZAK token for the host user');
    }
    return zak;
  }

  /** Resolve host Zoom user id for a webinar or meeting (for Meeting SDK host start). */
  async getSessionHostId(
    sessionType: 'WEBINAR' | 'MEETING',
    meetingNumber: string,
  ): Promise<string | null> {
    const remote =
      sessionType === 'WEBINAR'
        ? await this.getWebinarById(meetingNumber)
        : await this.getMeetingById(meetingNumber);
    return remote?.hostId?.trim() || null;
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

  /**
   * Encode meeting/webinar id for Zoom path. UUIDs with `/` need double-encoding.
   */
  encodeMeetingIdForPath(meetingId: string): string {
    const id = meetingId.trim();
    if (id.includes('/') || id.startsWith('/')) {
      return encodeURIComponent(encodeURIComponent(id));
    }
    return encodeURIComponent(id);
  }

  /**
   * Cloud recording file list for a meeting or webinar (same Zoom endpoint).
   * Requires cloud_recording:read:list_recording_files:admin (or equivalent).
   */
  async getMeetingRecordings(meetingId: string): Promise<ZoomMeetingRecordings> {
    if (!this.isConfigured()) {
      throw new Error('Zoom API is not configured');
    }
    const token = await this.getAccessToken();
    const pathId = this.encodeMeetingIdForPath(meetingId);
    const { data } = await firstValueFrom(
      this.http.get<ZoomMeetingRecordingsApiResponse>(
        `https://api.zoom.us/v2/meetings/${pathId}/recordings`,
        {
          params: { include_fields: 'download_access_token' },
          headers: { Authorization: `Bearer ${token}` },
        },
      ),
    );

    return {
      uuid: data.uuid,
      id: data.id != null ? String(data.id) : meetingId,
      topic: data.topic,
      startTime: data.start_time,
      duration: data.duration,
      totalSize: data.total_size,
      downloadAccessToken: data.download_access_token,
      recordingFiles: (data.recording_files || []).map((f) => ({
        id: f.id,
        meetingId: f.meeting_id,
        fileType: f.file_type,
        fileExtension: f.file_extension,
        fileSize: f.file_size,
        downloadUrl: f.download_url,
        playUrl: f.play_url,
        status: f.status,
        recordingType: f.recording_type,
        recordingStart: f.recording_start,
        recordingEnd: f.recording_end,
      })),
    };
  }

  /** Download a Zoom recording file (follows redirects). MP4s need a long timeout. */
  async downloadRecordingFile(
    downloadUrl: string,
    bearerToken?: string,
  ): Promise<{ buffer: Buffer; contentType?: string }> {
    if (!this.isConfigured()) {
      throw new Error('Zoom API is not configured');
    }
    const token = bearerToken || (await this.getAccessToken());
    const { data, headers } = await firstValueFrom(
      this.http.get<ArrayBuffer>(downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 5 * 60 * 1000,
        maxContentLength: 1024 * 1024 * 1024,
        maxBodyLength: 1024 * 1024 * 1024,
        headers: { Authorization: `Bearer ${token}` },
        maxRedirects: 5,
      }),
    );
    const contentType =
      typeof headers?.['content-type'] === 'string'
        ? headers['content-type']
        : undefined;
    return { buffer: Buffer.from(data), contentType };
  }

  /**
   * Stream a Zoom recording download (for large MP4 multipart upload to S3).
   * Prefer this over {@link downloadRecordingFile} when files may exceed ALB timeouts.
   */
  async downloadRecordingFileStream(
    downloadUrl: string,
    bearerToken?: string,
  ): Promise<{ stream: Readable; contentType?: string }> {
    if (!this.isConfigured()) {
      throw new Error('Zoom API is not configured');
    }
    const token = bearerToken || (await this.getAccessToken());
    const response = await firstValueFrom(
      this.http.get<Readable>(downloadUrl, {
        responseType: 'stream',
        timeout: 60 * 60 * 1000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: { Authorization: `Bearer ${token}` },
        maxRedirects: 5,
      }),
    );
    const contentType =
      typeof response.headers?.['content-type'] === 'string'
        ? response.headers['content-type']
        : undefined;
    return { stream: response.data, contentType };
  }

  /**
   * One page of Zoom account users (S2S).
   * Requires user:read:list_users:admin (or equivalent list-users scope).
   */
  async listAccountUsersPage(opts?: {
    status?: 'active' | 'inactive' | 'pending';
    pageSize?: number;
    nextPageToken?: string;
  }): Promise<ZoomAccountUsersPage> {
    if (!this.isConfigured()) {
      throw new Error('Zoom API is not configured');
    }
    const token = await this.getAccessToken();
    const params: Record<string, string | number> = {
      page_size: opts?.pageSize ?? 300,
      status: opts?.status ?? 'active',
    };
    if (opts?.nextPageToken?.trim()) {
      params.next_page_token = opts.nextPageToken.trim();
    }

    const data = await this.zoomGetWithRetry<ZoomUsersApiResponse>(
      'https://api.zoom.us/v2/users',
      {
        params,
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    return {
      nextPageToken: data.next_page_token?.trim() || undefined,
      totalRecords: data.total_records,
      users: (data.users || [])
        .map((u) => ({
          id: typeof u.id === 'string' ? u.id.trim() : String(u.id ?? '').trim(),
          email: typeof u.email === 'string' ? u.email.trim() : '',
          status: typeof u.status === 'string' ? u.status : undefined,
        }))
        .filter((u) => u.id.length > 0),
    };
  }

  /** All account users matching status (paginated). Dedupes by user id. */
  async listAllAccountUsers(opts?: {
    status?: 'active' | 'inactive' | 'pending';
    pageSize?: number;
  }): Promise<ZoomAccountUser[]> {
    const users: ZoomAccountUser[] = [];
    const seen = new Set<string>();
    let nextPageToken: string | undefined;
    do {
      const page = await this.listAccountUsersPage({
        status: opts?.status,
        pageSize: opts?.pageSize,
        nextPageToken,
      });
      for (const user of page.users) {
        if (seen.has(user.id)) continue;
        seen.add(user.id);
        users.push(user);
      }
      nextPageToken = page.nextPageToken;
    } while (nextPageToken);
    return users;
  }

  /**
   * One page of a host's cloud recordings for a date window (max ~1 month).
   * Requires cloud_recording:read:list_user_recordings:admin.
   * This is the Sync inventory path (account-wide GET /accounts/{id}/recordings
   * needs a Zoom Master Account plan and returns 4711 without it).
   */
  async listUserRecordingsPage(opts: {
    userId: string;
    from: string;
    to: string;
    pageSize?: number;
    nextPageToken?: string;
  }): Promise<ZoomAccountRecordingsPage> {
    if (!this.isConfigured()) {
      throw new Error('Zoom API is not configured');
    }
    const userId = opts.userId.trim();
    if (!userId) {
      throw new Error('Zoom user id is required');
    }

    const token = await this.getAccessToken();
    const params: Record<string, string | number> = {
      from: opts.from,
      to: opts.to,
      page_size: opts.pageSize ?? 300,
    };
    if (opts.nextPageToken?.trim()) {
      params.next_page_token = opts.nextPageToken.trim();
    }

    const data = await this.zoomGetWithRetry<ZoomAccountRecordingsApiResponse>(
      `https://api.zoom.us/v2/users/${encodeURIComponent(userId)}/recordings`,
      {
        params,
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    return {
      from: data.from ?? opts.from,
      to: data.to ?? opts.to,
      nextPageToken: data.next_page_token?.trim() || undefined,
      totalRecords: data.total_records,
      sessions: (data.meetings || []).map((m) => this.mapAccountRecordingSession(m)),
    };
  }

  /**
   * Fetch all cloud recording sessions for one host in a date window.
   */
  async listUserRecordingsInRange(opts: {
    userId: string;
    from: string;
    to: string;
    pageSize?: number;
  }): Promise<ZoomAccountRecordingSessionSummary[]> {
    const sessions: ZoomAccountRecordingSessionSummary[] = [];
    let nextPageToken: string | undefined;

    do {
      const page = await this.listUserRecordingsPage({
        userId: opts.userId,
        from: opts.from,
        to: opts.to,
        pageSize: opts.pageSize,
        nextPageToken,
      });
      sessions.push(...page.sessions);
      nextPageToken = page.nextPageToken;
    } while (nextPageToken);

    return sessions;
  }

  /**
   * One page of account cloud recordings for a date window (max ~1 month).
   * Requires cloud_recording:read:list_account_recordings:admin **and** a Zoom
   * Master Account plan. Unused by Sync (see {@link listUserRecordingsPage}).
   */
  async listAccountRecordingsPage(opts: {
    from: string;
    to: string;
    pageSize?: number;
    nextPageToken?: string;
  }): Promise<ZoomAccountRecordingsPage> {
    if (!this.isConfigured()) {
      throw new Error('Zoom API is not configured');
    }
    const accountId = this.config.get<string>('zoom.accountId')?.trim();
    if (!accountId) {
      throw new Error('Zoom account ID is not configured');
    }

    const token = await this.getAccessToken();
    const params: Record<string, string | number> = {
      from: opts.from,
      to: opts.to,
      page_size: opts.pageSize ?? 300,
    };
    if (opts.nextPageToken?.trim()) {
      params.next_page_token = opts.nextPageToken.trim();
    }

    const { data } = await firstValueFrom(
      this.http.get<ZoomAccountRecordingsApiResponse>(
        `https://api.zoom.us/v2/accounts/${encodeURIComponent(accountId)}/recordings`,
        {
          params,
          headers: { Authorization: `Bearer ${token}` },
        },
      ),
    );

    return {
      from: data.from ?? opts.from,
      to: data.to ?? opts.to,
      nextPageToken: data.next_page_token?.trim() || undefined,
      totalRecords: data.total_records,
      sessions: (data.meetings || []).map((m) => this.mapAccountRecordingSession(m)),
    };
  }

  /**
   * Fetch all account recording sessions in a date window (handles pagination).
   */
  async listAccountRecordingsInRange(opts: {
    from: string;
    to: string;
    pageSize?: number;
  }): Promise<ZoomAccountRecordingSessionSummary[]> {
    const sessions: ZoomAccountRecordingSessionSummary[] = [];
    let nextPageToken: string | undefined;

    do {
      const page = await this.listAccountRecordingsPage({
        from: opts.from,
        to: opts.to,
        pageSize: opts.pageSize,
        nextPageToken,
      });
      sessions.push(...page.sessions);
      nextPageToken = page.nextPageToken;
    } while (nextPageToken);

    return sessions;
  }

  /**
   * One page of past webinar participants from Zoom Report API.
   * Requires report:read:list_webinar_participants:admin (or master).
   */
  async listWebinarReportParticipantsPage(opts: {
    webinarId: string;
    pageSize?: number;
    nextPageToken?: string;
  }): Promise<ZoomReportParticipantsPage> {
    if (!this.isConfigured()) {
      throw new Error('Zoom API is not configured');
    }
    const token = await this.getAccessToken();
    const pathId = this.encodeMeetingIdForPath(opts.webinarId);
    const params: Record<string, string | number> = {
      page_size: opts.pageSize ?? 300,
    };
    if (opts.nextPageToken?.trim()) {
      params.next_page_token = opts.nextPageToken.trim();
    }

    const { data } = await firstValueFrom(
      this.http.get<ZoomReportParticipantsApiResponse>(
        `https://api.zoom.us/v2/report/webinars/${pathId}/participants`,
        {
          params,
          headers: { Authorization: `Bearer ${token}` },
        },
      ),
    );

    return this.mapReportParticipantsPage(data);
  }

  /**
   * One page of past meeting participants from Zoom Report API.
   * Requires report:read:list_meeting_participants:admin (or master).
   */
  async listMeetingReportParticipantsPage(opts: {
    meetingId: string;
    pageSize?: number;
    nextPageToken?: string;
  }): Promise<ZoomReportParticipantsPage> {
    if (!this.isConfigured()) {
      throw new Error('Zoom API is not configured');
    }
    const token = await this.getAccessToken();
    const pathId = this.encodeMeetingIdForPath(opts.meetingId);
    const params: Record<string, string | number> = {
      page_size: opts.pageSize ?? 300,
    };
    if (opts.nextPageToken?.trim()) {
      params.next_page_token = opts.nextPageToken.trim();
    }

    const { data } = await firstValueFrom(
      this.http.get<ZoomReportParticipantsApiResponse>(
        `https://api.zoom.us/v2/report/meetings/${pathId}/participants`,
        {
          params,
          headers: { Authorization: `Bearer ${token}` },
        },
      ),
    );

    return this.mapReportParticipantsPage(data);
  }

  /** Fetch all report participants for one session; retries with UUID on 404. */
  async listReportParticipantsForSession(opts: {
    sessionType: 'WEBINAR' | 'MEETING';
    meetingId: string;
    zoomUuid?: string | null;
    pageSize?: number;
  }): Promise<ZoomReportParticipant[]> {
    const fetchAll = async (id: string) => {
      const participants: ZoomReportParticipant[] = [];
      let nextPageToken: string | undefined;
      do {
        const page =
          opts.sessionType === 'WEBINAR'
            ? await this.listWebinarReportParticipantsPage({
                webinarId: id,
                pageSize: opts.pageSize,
                nextPageToken,
              })
            : await this.listMeetingReportParticipantsPage({
                meetingId: id,
                pageSize: opts.pageSize,
                nextPageToken,
              });
        participants.push(...page.participants);
        nextPageToken = page.nextPageToken;
      } while (nextPageToken);
      return participants;
    };

    try {
      return await fetchAll(opts.meetingId);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      const altId = opts.zoomUuid?.trim();
      if (status === 404 && altId && altId !== opts.meetingId) {
        return fetchAll(altId);
      }
      throw err;
    }
  }

  private mapReportParticipantsPage(
    data: ZoomReportParticipantsApiResponse,
  ): ZoomReportParticipantsPage {
    return {
      nextPageToken: data.next_page_token?.trim() || undefined,
      totalRecords: data.total_records,
      participants: (data.participants || []).map((p) => ({
        id: p.id?.trim() || null,
        userId: p.user_id,
        name: p.name ?? p.user_name,
        userEmail: p.user_email,
        joinTime: p.join_time,
        leaveTime: p.leave_time,
        durationSeconds: p.duration,
        internalUser: p.internal_user,
      })),
    };
  }

  private mapAccountRecordingSession(
    meeting: ZoomAccountRecordingsApiMeeting,
  ): ZoomAccountRecordingSessionSummary {
    return {
      uuid: meeting.uuid,
      id: meeting.id != null ? String(meeting.id) : '',
      hostId: meeting.host_id,
      hostEmail: meeting.host_email,
      topic: meeting.topic,
      startTime: meeting.start_time,
      duration: meeting.duration,
      totalSize: meeting.total_size,
      recordingCount: meeting.recording_count,
      meetingType: meeting.type,
      recordingFiles: (meeting.recording_files || []).map((f) => ({
        id: f.id,
        meetingId: f.meeting_id != null ? String(f.meeting_id) : undefined,
        fileType: f.file_type,
        fileExtension: f.file_extension,
        fileSize: f.file_size,
        downloadUrl: f.download_url ?? '',
        playUrl: f.play_url,
        status: f.status,
        recordingType: f.recording_type,
        recordingStart: f.recording_start,
        recordingEnd: f.recording_end,
      })),
    };
  }
}

export type ZoomRecordingFile = {
  id: string;
  meetingId?: string;
  fileType: string;
  fileExtension?: string;
  fileSize?: number;
  downloadUrl: string;
  playUrl?: string;
  status?: string;
  recordingType?: string;
  recordingStart?: string;
  recordingEnd?: string;
};

export type ZoomMeetingRecordings = {
  uuid?: string;
  id: string;
  topic?: string;
  startTime?: string;
  duration?: number;
  totalSize?: number;
  downloadAccessToken?: string;
  recordingFiles: ZoomRecordingFile[];
};

/** One meeting/webinar entry from account cloud recordings inventory. */
export type ZoomAccountRecordingSessionSummary = {
  uuid?: string;
  id: string;
  hostId?: string;
  hostEmail?: string;
  topic?: string;
  startTime?: string;
  duration?: number;
  totalSize?: number;
  recordingCount?: number;
  /** Zoom meeting type integer when returned by API. */
  meetingType?: number;
  recordingFiles: ZoomRecordingFile[];
};

export type ZoomAccountRecordingsPage = {
  from: string;
  to: string;
  nextPageToken?: string;
  totalRecords?: number;
  sessions: ZoomAccountRecordingSessionSummary[];
};

export type ZoomAccountUser = {
  id: string;
  email: string;
  status?: string;
};

export type ZoomAccountUsersPage = {
  nextPageToken?: string;
  totalRecords?: number;
  users: ZoomAccountUser[];
};

export type ZoomReportParticipant = {
  id: string | null;
  userId?: string;
  name?: string;
  userEmail?: string;
  joinTime?: string;
  leaveTime?: string;
  durationSeconds?: number;
  internalUser?: boolean;
};

export type ZoomReportParticipantsPage = {
  nextPageToken?: string;
  totalRecords?: number;
  participants: ZoomReportParticipant[];
};

type ZoomReportParticipantsApiResponse = {
  next_page_token?: string;
  total_records?: number;
  participants?: Array<{
    id?: string;
    user_id?: string;
    name?: string;
    user_name?: string;
    user_email?: string;
    join_time?: string;
    leave_time?: string;
    duration?: number;
    internal_user?: boolean;
  }>;
};

type ZoomMeetingRecordingsApiResponse = {
  uuid?: string;
  id?: string | number;
  topic?: string;
  start_time?: string;
  duration?: number;
  total_size?: number;
  download_access_token?: string;
  recording_files?: Array<{
    id: string;
    meeting_id?: string;
    file_type: string;
    file_extension?: string;
    file_size?: number;
    download_url: string;
    play_url?: string;
    status?: string;
    recording_type?: string;
    recording_start?: string;
    recording_end?: string;
  }>;
};

type ZoomAccountRecordingsApiMeeting = {
  uuid?: string;
  id?: string | number;
  host_id?: string;
  host_email?: string;
  topic?: string;
  start_time?: string;
  duration?: number;
  total_size?: number;
  recording_count?: number;
  type?: number;
  recording_files?: Array<{
    id: string;
    meeting_id?: string | number;
    file_type: string;
    file_extension?: string;
    file_size?: number;
    download_url?: string;
    play_url?: string;
    status?: string;
    recording_type?: string;
    recording_start?: string;
    recording_end?: string;
  }>;
};

type ZoomAccountRecordingsApiResponse = {
  from?: string;
  to?: string;
  page_count?: number;
  page_size?: number;
  total_records?: number;
  next_page_token?: string;
  meetings?: ZoomAccountRecordingsApiMeeting[];
};

type ZoomUsersApiResponse = {
  next_page_token?: string;
  total_records?: number;
  users?: Array<{
    id?: string;
    email?: string;
    status?: string;
  }>;
};
