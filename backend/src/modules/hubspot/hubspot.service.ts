import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const HUBSPOT_API_BASE = 'https://api.hubapi.com';
const ACCOUNT_META_TTL_MS = 5 * 60 * 1000;

export interface HubSpotContactProperties {
  email: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  company?: string;
  city?: string;
  state?: string;
  zip?: string;
  jobtitle?: string;
  npi_number?: string;
  [key: string]: string | undefined;
}

export interface HubSpotAccountMetadata {
  connected: boolean;
  accountName: string | null;
  portalId: string | null;
  hubDomain: string | null;
  scopes: string[];
  error?: string;
}

export interface HubSpotCampaignAnalyticsInput {
  hubspotCampaignId?: string | null;
  reportingPeriodStart?: string | null;
  reportingPeriodEnd?: string | null;
}

export interface HubSpotCampaignAnalyticsSnapshot {
  hubspotCampaignId: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  syncedAt: string;
  source: 'cht-hubspot-sync';
  phase: 'campaign-analytics';
  portalId: string | null;
  accountName: string | null;
  campaign: unknown | null;
  metrics: unknown | null;
  assets: unknown | null;
  emailStatistics: unknown | null;
  warnings: string[];
  errors: string[];
}

/** Reject blank / placeholder secrets that would only produce HubSpot 401 noise. */
function normalizeHubSpotToken(raw: string | undefined | null): string | null {
  const token = raw?.trim() ?? '';
  if (!token) return null;
  // Common placeholders from tfvars / Secrets Manager when HubSpot is "disabled"
  if (token === '"' || token === "'") return null;
  if (/^["']?\s*["']?$/.test(token)) return null;
  // HubSpot private app tokens are typically long and start with pat-
  if (token.length < 20) return null;
  return token;
}

function toIsoDate(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  // Accept YYYY-MM-DD or full ISO; normalize to YYYY-MM-DD for campaign metrics.
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  return match?.[1] ?? null;
}

function dayBoundsMs(startYmd: string | null, endYmd: string | null): {
  startTimestamp: number | null;
  endTimestamp: number | null;
} {
  const startTimestamp = startYmd
    ? Date.parse(`${startYmd}T00:00:00.000Z`)
    : null;
  const endTimestamp = endYmd
    ? Date.parse(`${endYmd}T23:59:59.999Z`)
    : null;
  return {
    startTimestamp:
      startTimestamp != null && !Number.isNaN(startTimestamp)
        ? startTimestamp
        : null,
    endTimestamp:
      endTimestamp != null && !Number.isNaN(endTimestamp)
        ? endTimestamp
        : null,
  };
}

@Injectable()
export class HubSpotService {
  private readonly logger = new Logger(HubSpotService.name);
  private accessToken: string | null;
  /** After INVALID_AUTHENTICATION, stop calling HubSpot for this process. */
  private authDisabled = false;
  private authFailureLogged = false;
  private accountMetaCache: {
    expiresAt: number;
    value: HubSpotAccountMetadata;
  } | null = null;

  constructor(private readonly config: ConfigService) {
    this.accessToken = normalizeHubSpotToken(
      this.config.get<string>('hubspot.accessToken'),
    );
    if (!this.accessToken) {
      this.logger.warn(
        'HUBSPOT_ACCESS_TOKEN not configured (or placeholder) - contact sync disabled',
      );
    }
  }

  isConfigured(): boolean {
    return !!this.accessToken && !this.authDisabled;
  }

  /**
   * Create or update a contact in HubSpot by email.
   * No-op when token is not configured or HubSpot rejected auth (401).
   */
  async createOrUpdateContact(
    properties: HubSpotContactProperties,
  ): Promise<void> {
    if (!this.isConfigured() || !this.accessToken) return;

    const email = properties.email?.trim()?.toLowerCase();
    if (!email) {
      this.logger.warn('[HubSpot] Skipping sync: missing email');
      return;
    }

    const contactProperties: Record<string, string> = {
      email,
      ...(properties.firstname && { firstname: properties.firstname.trim() }),
      ...(properties.lastname && { lastname: properties.lastname.trim() }),
      ...(properties.phone && { phone: properties.phone.trim() }),
      ...(properties.company && { company: properties.company.trim() }),
      ...(properties.city && { city: properties.city.trim() }),
      ...(properties.state && { state: properties.state.trim() }),
      ...(properties.zip && { zip: properties.zip.trim() }),
      ...(properties.jobtitle && { jobtitle: properties.jobtitle.trim() }),
      ...(properties.npi_number && {
        npi_number: String(properties.npi_number).trim(),
      }),
    };

    const body = {
      inputs: [
        { id: email, idProperty: 'email', properties: contactProperties },
      ],
    };

    try {
      await this.requestJson(
        '/crm/v3/objects/contacts/batch/upsert',
        {
          method: 'POST',
          body,
        },
        { swallowAuth: true },
      );
      this.logger.debug(`[HubSpot] Contact synced: ${email}`);
    } catch (err) {
      // Auth failures are handled inside requestJson (disable + warn once).
      if (this.authDisabled) return;
      this.logger.error(`[HubSpot] Sync error for ${email}:`, err);
    }
  }

  /**
   * Upsert contact fields and attach a timeline note for a CHT program event
   * (survey submitted / pending / approved / rejected). Soft-fails on notes.
   */
  async recordProgramActivity(input: {
    contact: HubSpotContactProperties;
    programId: string;
    programTitle: string;
    registrationStatus: string;
    event:
      | 'survey_submitted'
      | 'registration_pending'
      | 'registration_approved'
      | 'registration_rejected'
      | 'registration_updated';
  }): Promise<void> {
    if (!this.isConfigured() || !this.accessToken) return;

    const email = input.contact.email?.trim()?.toLowerCase();
    if (!email) return;

    const identityProps: Record<string, string> = {
      email,
      ...(input.contact.firstname && {
        firstname: input.contact.firstname.trim(),
      }),
      ...(input.contact.lastname && {
        lastname: input.contact.lastname.trim(),
      }),
      ...(input.contact.phone && { phone: input.contact.phone.trim() }),
      ...(input.contact.company && { company: input.contact.company.trim() }),
      ...(input.contact.city && { city: input.contact.city.trim() }),
      ...(input.contact.state && { state: input.contact.state.trim() }),
      ...(input.contact.zip && { zip: input.contact.zip.trim() }),
      ...(input.contact.jobtitle && {
        jobtitle: input.contact.jobtitle.trim(),
      }),
      ...(input.contact.npi_number && {
        npi_number: String(input.contact.npi_number).trim(),
      }),
    };

    const withStatusProps = {
      ...identityProps,
      cht_registration_status: input.registrationStatus,
      cht_last_program_id: input.programId,
      cht_last_program_title: input.programTitle.slice(0, 250),
      cht_last_program_event: input.event,
    };

    const upsert = async (properties: Record<string, string>) => {
      await this.requestJson(
        '/crm/v3/objects/contacts/batch/upsert',
        {
          method: 'POST',
          body: {
            inputs: [
              { id: email, idProperty: 'email', properties },
            ],
          },
        },
        { swallowAuth: true },
      );
    };

    try {
      await upsert(withStatusProps);
    } catch (err) {
      if (this.authDisabled) return;
      this.logger.warn(
        `[HubSpot] Contact upsert with status props failed; retrying identity only: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      try {
        await upsert(identityProps);
      } catch (err2) {
        if (this.authDisabled) return;
        this.logger.error(`[HubSpot] Contact upsert failed for ${email}:`, err2);
        return;
      }
    }

    const statusLabel = input.registrationStatus.replace(/_/g, ' ');
    const eventLabel = input.event.replace(/_/g, ' ');
    const noteBody = [
      `CHT Platform: ${eventLabel}`,
      `Program: ${input.programTitle} (${input.programId})`,
      `Registration status: ${statusLabel}`,
    ].join('\n');

    try {
      const contact = await this.requestJson<{ id?: string }>(
        `/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email`,
        { method: 'GET' },
        { swallowAuth: true },
      );
      const contactId = contact?.id;
      if (!contactId) return;

      await this.requestJson(
        '/crm/v3/objects/notes',
        {
          method: 'POST',
          body: {
            properties: {
              hs_timestamp: String(Date.now()),
              hs_note_body: noteBody,
            },
            associations: [
              {
                to: { id: contactId },
                types: [
                  {
                    associationCategory: 'HUBSPOT_DEFINED',
                    associationTypeId: 202,
                  },
                ],
              },
            ],
          },
        },
        { swallowAuth: true },
      );
      this.logger.debug(
        `[HubSpot] Program activity note for ${email}: ${input.event}`,
      );
    } catch (err) {
      if (this.authDisabled) return;
      this.logger.warn(
        `[HubSpot] Program activity note failed for ${email}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * Resolve portal metadata for the configured private-app token.
   * Uses GET /integrations/v1/me — OAuth token introspection
   * (`/oauth/v1/access-tokens/{token}`) rejects private-app `pat-…` tokens
   * with "must have the correct format" even when the token is valid.
   * Cached briefly so Integrations / status polls stay cheap.
   */
  async getAccountMetadata(forceRefresh = false): Promise<HubSpotAccountMetadata> {
    if (!this.isConfigured() || !this.accessToken) {
      return {
        connected: false,
        accountName: null,
        portalId: null,
        hubDomain: null,
        scopes: [],
        error:
          'HUBSPOT_ACCESS_TOKEN not configured in platform secrets.',
      };
    }

    const now = Date.now();
    if (
      !forceRefresh &&
      this.accountMetaCache &&
      this.accountMetaCache.expiresAt > now
    ) {
      return this.accountMetaCache.value;
    }

    try {
      const data = await this.requestJson<{
        portalId?: number | string;
        timeZone?: string;
        accountType?: string;
        currency?: string;
        uiDomain?: string;
        hubDomain?: string;
      }>('/integrations/v1/me', { method: 'GET' });

      const portalId =
        data.portalId != null && String(data.portalId).trim()
          ? String(data.portalId)
          : null;
      const hubDomain =
        (typeof data.uiDomain === 'string' && data.uiDomain.trim()
          ? data.uiDomain.trim()
          : null) ||
        (typeof data.hubDomain === 'string' && data.hubDomain.trim()
          ? data.hubDomain.trim()
          : null);
      const accountName =
        hubDomain ||
        (portalId ? `HubSpot portal ${portalId}` : 'HubSpot');

      const value: HubSpotAccountMetadata = {
        connected: true,
        accountName,
        portalId,
        hubDomain,
        scopes: [],
      };
      this.accountMetaCache = {
        expiresAt: now + ACCOUNT_META_TTL_MS,
        value,
      };
      return value;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'HubSpot account lookup failed';
      this.logger.warn(`[HubSpot] Account metadata failed: ${message}`);
      const value: HubSpotAccountMetadata = {
        // Token present is not enough — HubSpot rejected the call.
        connected: false,
        accountName: null,
        portalId: null,
        hubDomain: null,
        scopes: [],
        error: message,
      };
      // Short-cache failures so a bad token does not hammer HubSpot.
      this.accountMetaCache = {
        expiresAt: now + 30_000,
        value,
      };
      return value;
    }
  }

  /**
   * Pull campaign-scoped marketing analytics (+ period email stats) for Content Hub.
   * Partial failures are recorded in `errors` / `warnings`; caller still PATCHes Hub.
   */
  async getCampaignAnalytics(
    input: HubSpotCampaignAnalyticsInput,
  ): Promise<HubSpotCampaignAnalyticsSnapshot> {
    const syncedAt = new Date().toISOString();
    const hubspotCampaignId = input.hubspotCampaignId?.trim() ?? '';
    const reportingPeriodStart =
      toIsoDate(input.reportingPeriodStart) ?? '';
    const reportingPeriodEnd = toIsoDate(input.reportingPeriodEnd) ?? '';
    const warnings: string[] = [];
    const errors: string[] = [];

    const account = await this.getAccountMetadata();

    let campaign: unknown | null = null;
    let metrics: unknown | null = null;
    let assets: unknown | null = null;
    let emailStatistics: unknown | null = null;

    if (!hubspotCampaignId) {
      warnings.push(
        'No hubspotCampaignId on campaign; campaign-scoped metrics skipped.',
      );
    } else {
      try {
        campaign = await this.requestJson(
          `/marketing/v3/campaigns/${encodeURIComponent(hubspotCampaignId)}`,
          { method: 'GET' },
        );
      } catch (err) {
        errors.push(
          `campaign: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      const qs = new URLSearchParams();
      if (reportingPeriodStart) qs.set('startDate', reportingPeriodStart);
      if (reportingPeriodEnd) qs.set('endDate', reportingPeriodEnd);
      const metricsPath =
        `/marketing/v3/campaigns/${encodeURIComponent(hubspotCampaignId)}/reports/metrics` +
        (qs.toString() ? `?${qs}` : '');
      try {
        metrics = await this.requestJson(metricsPath, { method: 'GET' });
      } catch (err) {
        errors.push(
          `metrics: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      try {
        assets = await this.requestJson(
          `/marketing/v3/campaigns/${encodeURIComponent(hubspotCampaignId)}/assets/MARKETING_EMAIL?limit=50`,
          { method: 'GET' },
        );
      } catch (err) {
        // Assets endpoint may 404 or lack scope depending on portal; soft-fail.
        warnings.push(
          `assets: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const { startTimestamp, endTimestamp } = dayBoundsMs(
      reportingPeriodStart || null,
      reportingPeriodEnd || null,
    );
    if (startTimestamp != null && endTimestamp != null) {
      const statsQs = new URLSearchParams({
        startTimestamp: String(startTimestamp),
        endTimestamp: String(endTimestamp),
      });
      try {
        emailStatistics = await this.requestJson(
          `/marketing/v3/emails/statistics/list?${statsQs}`,
          { method: 'GET' },
        );
      } catch (err) {
        warnings.push(
          `emailStatistics: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      warnings.push(
        'Reporting period start/end missing or invalid; email statistics skipped.',
      );
    }

    return {
      hubspotCampaignId,
      reportingPeriodStart,
      reportingPeriodEnd,
      syncedAt,
      source: 'cht-hubspot-sync',
      phase: 'campaign-analytics',
      portalId: account.portalId,
      accountName: account.accountName,
      campaign,
      metrics,
      assets,
      emailStatistics,
      warnings,
      errors,
    };
  }

  private async requestJson<T = unknown>(
    path: string,
    init: {
      method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
      body?: unknown;
    },
    opts: { swallowAuth?: boolean } = {},
  ): Promise<T> {
    if (!this.isConfigured() || !this.accessToken) {
      throw new Error('HUBSPOT_ACCESS_TOKEN not configured');
    }

    const res = await fetch(`${HUBSPOT_API_BASE}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 401) {
        this.authDisabled = true;
        this.accountMetaCache = null;
        if (!this.authFailureLogged) {
          this.authFailureLogged = true;
          this.logger.warn(
            `[HubSpot] Auth failed (401): disabling HubSpot calls for this process. Set a valid private-app token in Secrets Manager (hubspot_access_token), or clear it to silence sync. Detail: ${errText}`,
          );
        }
        if (opts.swallowAuth) {
          throw new Error(`HubSpot auth failed (401)`);
        }
        throw new Error(`HubSpot auth failed (401): ${errText}`);
      }
      throw new Error(`HubSpot ${res.status} ${res.statusText}: ${errText}`);
    }

    if (res.status === 204) {
      return undefined as T;
    }
    return (await res.json()) as T;
  }
}
