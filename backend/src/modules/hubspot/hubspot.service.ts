import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  parseHubSpotCampaignList,
  type HubSpotCampaignListItem,
} from './hubspot-campaign-metrics.util';
import {
  dedupeStrings,
  HUBSPOT_CAMPAIGNS_DASHBOARD_SCOPES,
  humanizeHubSpotPermissionError,
  parseHubSpotApiError,
} from './hubspot-error.util';

const HUBSPOT_API_BASE = 'https://api.hubapi.com';
const ACCOUNT_META_TTL_MS = 5 * 60 * 1000;
const MARKETING_ACCESS_TTL_MS = 5 * 60 * 1000;

/** Asset types with meaningful metrics in HubSpot campaign reporting. */
export const HUBSPOT_CAMPAIGN_ASSET_TYPES = [
  'MARKETING_EMAIL',
  'LANDING_PAGE',
  'FORM',
  'SOCIAL_BROADCAST',
  'SITE_PAGE',
  'BLOG_POST',
  'MARKETING_EVENT',
  'WEB_INTERACTIVE',
] as const;

export type HubSpotCampaignAssetType =
  (typeof HUBSPOT_CAMPAIGN_ASSET_TYPES)[number];

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

/** Soft-read contact match used by funnel HCP drill-down. */
export type HubSpotContactMatch = {
  id: string;
  email: string | null;
  npiNumber: string | null;
  firstName: string | null;
  lastName: string | null;
};

/**
 * Logical HubSpot campaign contact cohorts (MetricsCounters / attribution).
 * Path contactType strings vary; listCampaignContactIds tries aliases.
 */
export type HubSpotCampaignContactReportType =
  | 'influencedContacts'
  | 'newContactsFirstTouch'
  | 'newContactsLastTouch';

const HUBSPOT_CONTACT_TYPE_CANDIDATES: Record<
  HubSpotCampaignContactReportType,
  string[]
> = {
  influencedContacts: [
    'influencedContacts',
    'CONTACTS_INFLUENCED',
    'influenced',
    'CONTACT_INFLUENCED',
  ],
  newContactsFirstTouch: [
    'newContactsFirstTouch',
    'CONTACTS_FIRST_TOUCH',
    'contactFirstTouch',
    'firstTouch',
  ],
  newContactsLastTouch: [
    'newContactsLastTouch',
    'CONTACTS_LAST_TOUCH',
    'contactLastTouch',
    'lastTouch',
  ],
};

/** Prefer dated campaigns reports path; fall back to v3 / beta. */
const HUBSPOT_CAMPAIGN_CONTACT_PATH_PREFIXES = [
  '/marketing/campaigns/2026-03/',
  '/marketing/v3/campaigns/',
  '/marketing/campaigns/2026-09-beta/',
] as const;

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
  campaign: unknown;
  metrics: unknown;
  assets: unknown;
  emailStatistics: unknown;
  warnings: string[];
  errors: string[];
}

export type HubSpotMarketingAccess = {
  canListCampaigns: boolean;
  canReadCampaignDetails: boolean;
  canReadMetrics: boolean;
  canReadEmailStats: boolean;
  missingScopes: string[];
  messages: string[];
};

export type HubSpotCampaignAnalyticsOptions = {
  includeEmailStatistics?: boolean;
  /**
   * Prefetched account-period email statistics. When set, skips the HubSpot
   * email statistics request so callers can reuse one fetch across campaigns.
   */
  emailStatisticsPrefetch?: {
    data: unknown;
    warning?: string;
  };
};

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

function dayBoundsMs(
  startYmd: string | null,
  endYmd: string | null,
): {
  startTimestamp: number | null;
  endTimestamp: number | null;
} {
  const startTimestamp = startYmd
    ? Date.parse(`${startYmd}T00:00:00.000Z`)
    : null;
  const endTimestamp = endYmd ? Date.parse(`${endYmd}T23:59:59.999Z`) : null;
  return {
    startTimestamp:
      startTimestamp != null && !Number.isNaN(startTimestamp)
        ? startTimestamp
        : null,
    endTimestamp:
      endTimestamp != null && !Number.isNaN(endTimestamp) ? endTimestamp : null,
  };
}

@Injectable()
export class HubSpotService {
  private readonly logger = new Logger(HubSpotService.name);
  /** Remember which path+contactType worked per campaign/cohort. */
  private readonly campaignContactRouteCache = new Map<
    string,
    { prefix: string; type: string }
  >();
  private accessToken: string | null;
  /** After INVALID_AUTHENTICATION, stop calling HubSpot for this process. */
  private authDisabled = false;
  private authFailureLogged = false;
  private accountMetaCache: {
    expiresAt: number;
    value: HubSpotAccountMetadata;
  } | null = null;
  private marketingAccessCache: {
    expiresAt: number;
    value: HubSpotMarketingAccess;
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
            inputs: [{ id: email, idProperty: 'email', properties }],
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
        this.logger.error(
          `[HubSpot] Contact upsert failed for ${email}:`,
          err2,
        );
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
   * Look up a HubSpot contact by email (soft-fail). Used by funnel HCP drill-down.
   */
  async findContactByEmail(email: string): Promise<HubSpotContactMatch | null> {
    const normalized = email?.trim()?.toLowerCase();
    if (!normalized || !this.isConfigured() || !this.accessToken) return null;

    try {
      const contact = await this.requestJson<{
        id?: string;
        properties?: Record<string, string | null | undefined>;
      }>(
        `/crm/v3/objects/contacts/${encodeURIComponent(normalized)}?idProperty=email&properties=email,firstname,lastname,npi_number`,
        { method: 'GET' },
        { swallowAuth: true },
      );
      if (!contact?.id) return null;
      return {
        id: contact.id,
        email: contact.properties?.email?.trim()?.toLowerCase() || normalized,
        npiNumber: contact.properties?.npi_number?.trim() || null,
        firstName: contact.properties?.firstname?.trim() || null,
        lastName: contact.properties?.lastname?.trim() || null,
      };
    } catch (err) {
      if (this.authDisabled) return null;
      const message = err instanceof Error ? err.message : String(err);
      if (/HubSpot 404\b/.test(message)) return null;
      this.logger.warn(
        `[HubSpot] findContactByEmail failed for ${normalized}: ${message}`,
      );
      return null;
    }
  }

  /**
   * Look up a HubSpot contact by custom property `npi_number` (soft-fail).
   * Secondary match after email for funnel HCP drill-down.
   */
  async findContactByNpi(npiNumber: string): Promise<HubSpotContactMatch | null> {
    const digits = (npiNumber || '').replace(/\D/g, '');
    if (digits.length !== 10 || !this.isConfigured() || !this.accessToken) {
      return null;
    }

    try {
      const result = await this.requestJson<{
        results?: Array<{
          id?: string;
          properties?: Record<string, string | null | undefined>;
        }>;
      }>(
        '/crm/v3/objects/contacts/search',
        {
          method: 'POST',
          body: {
            filterGroups: [
              {
                filters: [
                  {
                    propertyName: 'npi_number',
                    operator: 'EQ',
                    value: digits,
                  },
                ],
              },
            ],
            properties: ['email', 'firstname', 'lastname', 'npi_number'],
            limit: 1,
          },
        },
        { swallowAuth: true },
      );

      const contact = result?.results?.[0];
      if (!contact?.id) return null;
      return {
        id: contact.id,
        email: contact.properties?.email?.trim()?.toLowerCase() || null,
        npiNumber: contact.properties?.npi_number?.trim() || digits,
        firstName: contact.properties?.firstname?.trim() || null,
        lastName: contact.properties?.lastname?.trim() || null,
      };
    } catch (err) {
      if (this.authDisabled) return null;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[HubSpot] findContactByNpi failed for ${digits}: ${message}`,
      );
      return null;
    }
  }

  /**
   * Resolve portal metadata for the configured private-app token.
   * Uses GET /integrations/v1/me — OAuth token introspection
   * (`/oauth/v1/access-tokens/{token}`) rejects private-app `pat-…` tokens
   * with "must have the correct format" even when the token is valid.
   * Cached briefly so Integrations / status polls stay cheap.
   */
  async getAccountMetadata(
    forceRefresh = false,
  ): Promise<HubSpotAccountMetadata> {
    if (!this.isConfigured() || !this.accessToken) {
      return {
        connected: false,
        accountName: null,
        portalId: null,
        hubDomain: null,
        scopes: [],
        error: 'HUBSPOT_ACCESS_TOKEN not configured in platform secrets.',
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
        hubDomain || (portalId ? `HubSpot portal ${portalId}` : 'HubSpot');

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
   * Probe which Marketing Hub endpoints the configured token can access.
   * Cached briefly to avoid repeated 403 noise on dashboard refresh.
   */
  async probeMarketingAccess(
    sampleCampaignId: string,
  ): Promise<HubSpotMarketingAccess> {
    const now = Date.now();
    if (
      this.marketingAccessCache &&
      this.marketingAccessCache.expiresAt > now
    ) {
      return this.marketingAccessCache.value;
    }

    const missingScopes = new Set<string>();
    const messages: string[] = [];
    let canReadCampaignDetails = false;
    let canReadMetrics = false;
    let canReadEmailStats = false;

    const recordFailure = (err: unknown) => {
      const parsed = parseHubSpotApiError(err);
      for (const scope of parsed.missingScopes) missingScopes.add(scope);
      messages.push(humanizeHubSpotPermissionError(parsed));
    };

    const id = encodeURIComponent(sampleCampaignId);

    try {
      await this.requestJson(`/marketing/v3/campaigns/${id}`, {
        method: 'GET',
      });
      canReadCampaignDetails = true;
    } catch (err) {
      recordFailure(err);
    }

    try {
      await this.requestJson(`/marketing/v3/campaigns/${id}/reports/metrics`, {
        method: 'GET',
      });
      canReadMetrics = true;
    } catch (err) {
      recordFailure(err);
    }

    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 7);
    const statsQs = new URLSearchParams({
      startTimestamp: String(start.getTime()),
      endTimestamp: String(end.getTime()),
    });
    try {
      await this.requestJson(
        `/marketing/v3/emails/statistics/list?${statsQs}`,
        { method: 'GET' },
      );
      canReadEmailStats = true;
    } catch (err) {
      recordFailure(err);
    }

    if (!canReadMetrics && !canReadCampaignDetails) {
      for (const scope of HUBSPOT_CAMPAIGNS_DASHBOARD_SCOPES) {
        missingScopes.add(scope);
      }
    }

    const value: HubSpotMarketingAccess = {
      canListCampaigns: true,
      canReadCampaignDetails,
      canReadMetrics,
      canReadEmailStats,
      missingScopes: [...missingScopes],
      messages: dedupeStrings(messages),
    };

    this.marketingAccessCache = {
      expiresAt: now + MARKETING_ACCESS_TTL_MS,
      value,
    };
    return value;
  }

  /**
   * Account-wide marketing email statistics for a reporting window.
   * Callers that enrich many campaigns for the same window should fetch once
   * and pass `emailStatisticsPrefetch` into getCampaignAnalytics.
   */
  async getEmailStatisticsForPeriod(
    reportingPeriodStart: string | null | undefined,
    reportingPeriodEnd: string | null | undefined,
  ): Promise<{ data: unknown; warning?: string }> {
    const start = toIsoDate(reportingPeriodStart) ?? '';
    const end = toIsoDate(reportingPeriodEnd) ?? '';
    const { startTimestamp, endTimestamp } = dayBoundsMs(
      start || null,
      end || null,
    );
    if (startTimestamp == null || endTimestamp == null) {
      return {
        data: null,
        warning:
          'Reporting period start/end missing or invalid; email statistics skipped.',
      };
    }

    const statsQs = new URLSearchParams({
      startTimestamp: String(startTimestamp),
      endTimestamp: String(endTimestamp),
    });
    try {
      const data = await this.requestJson(
        `/marketing/v3/emails/statistics/list?${statsQs}`,
        { method: 'GET' },
      );
      return { data };
    } catch (err) {
      return {
        data: null,
        warning: `emailStatistics: ${
          err instanceof Error ? err.message : String(err)
        }`,
      };
    }
  }

  /**
   * Pull campaign-scoped marketing analytics (+ period email stats) for Content Hub.
   * Partial failures are recorded in `errors` / `warnings`; caller still PATCHes Hub.
   */
  async getCampaignAnalytics(
    input: HubSpotCampaignAnalyticsInput,
    options: HubSpotCampaignAnalyticsOptions = {},
  ): Promise<HubSpotCampaignAnalyticsSnapshot> {
    const syncedAt = new Date().toISOString();
    const hubspotCampaignId = input.hubspotCampaignId?.trim() ?? '';
    const reportingPeriodStart = toIsoDate(input.reportingPeriodStart) ?? '';
    const reportingPeriodEnd = toIsoDate(input.reportingPeriodEnd) ?? '';
    const warnings: string[] = [];
    const errors: string[] = [];
    const includeEmailStatistics = options.includeEmailStatistics !== false;
    const emailPrefetch = options.emailStatisticsPrefetch;

    const account = await this.getAccountMetadata();

    let campaign: unknown = null;
    let metrics: unknown = null;
    let assets: unknown = null;
    let emailStatistics: unknown = null;

    if (!hubspotCampaignId) {
      warnings.push(
        'No hubspotCampaignId on campaign; campaign-scoped metrics skipped.',
      );
    } else {
      const campaignQs = new URLSearchParams();
      campaignQs.set(
        'properties',
        [
          'hs_name',
          'hs_campaign_status',
          'hs_start_date',
          'hs_end_date',
          'hs_notes',
        ].join(','),
      );
      if (reportingPeriodStart)
        campaignQs.set('startDate', reportingPeriodStart);
      if (reportingPeriodEnd) campaignQs.set('endDate', reportingPeriodEnd);
      const campaignPath =
        `/marketing/v3/campaigns/${encodeURIComponent(hubspotCampaignId)}` +
        `?${campaignQs}`;

      const metricsQs = new URLSearchParams();
      if (reportingPeriodStart)
        metricsQs.set('startDate', reportingPeriodStart);
      if (reportingPeriodEnd) metricsQs.set('endDate', reportingPeriodEnd);
      const metricsPath =
        `/marketing/v3/campaigns/${encodeURIComponent(hubspotCampaignId)}/reports/metrics` +
        (metricsQs.toString() ? `?${metricsQs}` : '');

      const [campaignResult, metricsResult, assetsResult] = await Promise.all([
        this.requestJson(campaignPath, { method: 'GET' })
          .then((value) => ({ ok: true as const, value }))
          .catch((err: unknown) => ({ ok: false as const, err })),
        this.requestJson(metricsPath, { method: 'GET' })
          .then((value) => ({ ok: true as const, value }))
          .catch((err: unknown) => ({ ok: false as const, err })),
        this.getCampaignAssets(hubspotCampaignId, 'MARKETING_EMAIL', {
          startDate: reportingPeriodStart || undefined,
          endDate: reportingPeriodEnd || undefined,
        })
          .then((value) => ({ ok: true as const, value }))
          .catch((err: unknown) => ({ ok: false as const, err })),
      ]);

      if (campaignResult.ok) {
        campaign = campaignResult.value;
      } else {
        errors.push(
          `campaign: ${
            campaignResult.err instanceof Error
              ? campaignResult.err.message
              : String(campaignResult.err)
          }`,
        );
      }

      if (metricsResult.ok) {
        metrics = metricsResult.value;
      } else {
        errors.push(
          `metrics: ${
            metricsResult.err instanceof Error
              ? metricsResult.err.message
              : String(metricsResult.err)
          }`,
        );
      }

      if (assetsResult.ok) {
        assets = assetsResult.value;
      } else {
        warnings.push(
          `assets: ${
            assetsResult.err instanceof Error
              ? assetsResult.err.message
              : String(assetsResult.err)
          }`,
        );
      }
    }

    if (emailPrefetch) {
      emailStatistics = emailPrefetch.data;
      if (emailPrefetch.warning) {
        warnings.push(emailPrefetch.warning);
      }
    } else if (includeEmailStatistics) {
      const emailStats = await this.getEmailStatisticsForPeriod(
        reportingPeriodStart,
        reportingPeriodEnd,
      );
      emailStatistics = emailStats.data;
      if (emailStats.warning) warnings.push(emailStats.warning);
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

  /**
   * List HubSpot marketing campaigns (paginated). Returns one page.
   * Must request `properties` — HubSpot returns an empty properties map otherwise,
   * which forces our fallback name `Campaign {id.slice(0,8)}`.
   */
  async listCampaignsPage(
    options: {
      limit?: number;
      after?: string | null;
    } = {},
  ): Promise<{ items: HubSpotCampaignListItem[]; after: string | null }> {
    const limit = Math.min(Math.max(options.limit ?? 100, 1), 100);
    const qs = new URLSearchParams({
      limit: String(limit),
      // Comma-separated; HubSpot docs: empty properties → empty properties map
      properties: [
        'hs_name',
        'hs_campaign_status',
        'hs_start_date',
        'hs_end_date',
        'hs_notes',
      ].join(','),
    });
    if (options.after?.trim()) qs.set('after', options.after.trim());

    const raw = await this.requestJson(`/marketing/v3/campaigns?${qs}`, {
      method: 'GET',
    });
    return parseHubSpotCampaignList(raw);
  }

  /**
   * List all HubSpot campaigns up to `maxItems` (default 200).
   */
  async listAllCampaigns(maxItems = 200): Promise<HubSpotCampaignListItem[]> {
    const items: HubSpotCampaignListItem[] = [];
    let after: string | null = null;

    while (items.length < maxItems) {
      const page = await this.listCampaignsPage({
        limit: Math.min(100, maxItems - items.length),
        after,
      });
      items.push(...page.items);
      after = page.after;
      if (!after || !page.items.length) break;
    }

    return items;
  }

  /**
   * List HubSpot contact IDs attributed to a campaign for a contact cohort.
   * Tries dated + v3 path prefixes and several contactType aliases until one works
   * (HubSpot docs leave the enum loosely specified). Soft-fails to empty.
   */
  async listCampaignContactIds(
    campaignGuid: string,
    contactType: HubSpotCampaignContactReportType,
    options: {
      startDate?: string;
      endDate?: string;
      maxItems?: number;
    } = {},
  ): Promise<{ ids: string[]; contactTypeUsed: string | null; warnings: string[] }> {
    const warnings: string[] = [];
    const guid = campaignGuid?.trim();
    if (!guid || !this.isConfigured() || !this.accessToken) {
      return { ids: [], contactTypeUsed: null, warnings };
    }

    const maxItems = Math.min(Math.max(options.maxItems ?? 200, 1), 500);
    const candidates =
      HUBSPOT_CONTACT_TYPE_CANDIDATES[contactType] ?? [contactType];
    const cacheKey = `${guid}:${contactType}`;
    const cached = this.campaignContactRouteCache.get(cacheKey);

    const tryFetchPage = async (
      pathPrefix: string,
      type: string,
      after: string | null,
      pageLimit: number,
    ): Promise<{
      ids: string[];
      after: string | null;
    }> => {
      const qs = new URLSearchParams({ limit: String(pageLimit) });
      if (options.startDate) qs.set('startDate', options.startDate);
      if (options.endDate) qs.set('endDate', options.endDate);
      if (after) qs.set('after', after);
      const path =
        `${pathPrefix}${encodeURIComponent(guid)}/reports/contacts/${encodeURIComponent(type)}` +
        `?${qs}`;
      const raw = await this.requestJson<{
        results?: Array<{ id?: string }>;
        paging?: { next?: { after?: string } };
      }>(path, { method: 'GET' }, { swallowAuth: true });
      const ids = (raw?.results ?? [])
        .map((r) => (typeof r?.id === 'string' ? r.id.trim() : ''))
        .filter(Boolean);
      return {
        ids,
        after: raw?.paging?.next?.after?.trim() || null,
      };
    };

    const routeAttempts: Array<{ prefix: string; type: string }> = [];
    if (cached) {
      routeAttempts.push(cached);
    } else {
      for (const type of candidates) {
        for (const prefix of HUBSPOT_CAMPAIGN_CONTACT_PATH_PREFIXES) {
          routeAttempts.push({ prefix, type });
        }
      }
    }

    let contactTypeUsed: string | null = null;
    let pathPrefixUsed: string | null = null;
    let lastError: string | null = null;

    for (const attempt of routeAttempts) {
      try {
        const first = await tryFetchPage(
          attempt.prefix,
          attempt.type,
          null,
          Math.min(100, maxItems),
        );
        contactTypeUsed = attempt.type;
        pathPrefixUsed = attempt.prefix;
        this.campaignContactRouteCache.set(cacheKey, attempt);

        const ids: string[] = [...first.ids];
        let after = first.after;
        while (after && ids.length < maxItems) {
          const page = await tryFetchPage(
            attempt.prefix,
            attempt.type,
            after,
            Math.min(100, maxItems - ids.length),
          );
          ids.push(...page.ids);
          after = page.after;
          if (!page.ids.length) break;
        }

        return {
          ids: ids.slice(0, maxItems),
          contactTypeUsed,
          warnings,
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (this.authDisabled) {
          warnings.push('HubSpot auth failed while listing campaign contacts.');
          return { ids: [], contactTypeUsed: null, warnings };
        }
        // Try next path/type combination.
      }
    }

    if (lastError) {
      this.logger.warn(
        `[HubSpot] listCampaignContactIds failed for ${guid}/${contactType}: ${lastError}`,
      );
      warnings.push(
        `Could not load HubSpot contacts for campaign (${contactType}): ${lastError}`,
      );
    }
    return {
      ids: [],
      contactTypeUsed: pathPrefixUsed ? contactTypeUsed : null,
      warnings,
    };
  }

  /**
   * Batch-read CRM contacts by id (chunks of 100). Soft-fails per chunk.
   */
  async batchReadContacts(
    contactIds: string[],
    properties: string[] = [
      'email',
      'firstname',
      'lastname',
      'npi_number',
    ],
  ): Promise<HubSpotContactMatch[]> {
    const ids = [
      ...new Set(
        contactIds.map((id) => id?.trim()).filter((id): id is string => !!id),
      ),
    ];
    if (!ids.length || !this.isConfigured() || !this.accessToken) return [];

    const out: HubSpotContactMatch[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      try {
        const raw = await this.requestJson<{
          results?: Array<{
            id?: string;
            properties?: Record<string, string | null | undefined>;
          }>;
        }>(
          '/crm/v3/objects/contacts/batch/read',
          {
            method: 'POST',
            body: {
              properties,
              inputs: chunk.map((id) => ({ id })),
            },
          },
          { swallowAuth: true },
        );
        for (const row of raw?.results ?? []) {
          if (!row?.id) continue;
          out.push({
            id: row.id,
            email: row.properties?.email?.trim()?.toLowerCase() || null,
            npiNumber: row.properties?.npi_number?.trim() || null,
            firstName: row.properties?.firstname?.trim() || null,
            lastName: row.properties?.lastname?.trim() || null,
          });
        }
      } catch (err) {
        if (this.authDisabled) break;
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `[HubSpot] batchReadContacts failed for ${chunk.length} ids: ${message}`,
        );
      }
    }
    return out;
  }

  /** Fetch assets for a single campaign asset type. */
  async getCampaignAssets(
    hubspotCampaignId: string,
    assetType: HubSpotCampaignAssetType,
    options: { limit?: number; startDate?: string; endDate?: string } = {},
  ): Promise<unknown> {
    const limit = options.limit ?? 50;
    const qs = new URLSearchParams({ limit: String(limit) });
    if (options.startDate) qs.set('startDate', options.startDate);
    if (options.endDate) qs.set('endDate', options.endDate);
    return this.requestJson(
      `/marketing/v3/campaigns/${encodeURIComponent(hubspotCampaignId)}/assets/${assetType}?${qs}`,
      { method: 'GET' },
    );
  }

  /**
   * Pull additional asset buckets for dashboard enrichment.
   * Failures are soft — returns null per asset type.
   */
  async getCampaignAssetsBundle(
    hubspotCampaignId: string,
    options: { startDate?: string; endDate?: string } = {},
  ): Promise<Record<HubSpotCampaignAssetType, unknown>> {
    const entries = await Promise.all(
      HUBSPOT_CAMPAIGN_ASSET_TYPES.filter((t) => t !== 'MARKETING_EMAIL').map(
        async (assetType) => {
          try {
            const payload = await this.getCampaignAssets(
              hubspotCampaignId,
              assetType,
              options,
            );
            return [assetType, payload] as const;
          } catch {
            return [assetType, null] as const;
          }
        },
      ),
    );

    return Object.fromEntries(entries) as Record<
      HubSpotCampaignAssetType,
      unknown
    >;
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
