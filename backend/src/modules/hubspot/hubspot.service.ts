import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isTestAccountEmail } from '../../common/test-accounts';
import {
  defaultReportingWindow,
  mapPool,
} from '../campaigns/campaigns-funnel.util';

import {
  parseHubSpotCampaignList,
  parseSocialPostsFromAssets,
  slimCampaignAssetPayload,
  type HubSpotCampaignListItem,
  type HubSpotSocialPost,
} from './hubspot-campaign-metrics.util';
import {
  dedupeStrings,
  HUBSPOT_CAMPAIGNS_DASHBOARD_SCOPES,
  humanizeHubSpotPermissionError,
  parseHubSpotApiError,
} from './hubspot-error.util';
import {
  applyBroadcastEnrichment,
  HUBSPOT_SOCIAL_BROADCAST_SCOPE,
  parseBroadcastEnrichment,
} from './hubspot-social-broadcast.util';

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

/** HubSpot assets page size (API allows 1–100). */
const CAMPAIGN_ASSET_PAGE_LIMIT = 100;
/** Safety cap: 10 pages × 100 = 1000 assets per type. */
const CAMPAIGN_ASSET_MAX_PAGES = 10;

export type HubSpotCampaignAssetsResult = {
  results: unknown[];
  /**
   * True when the result set is incomplete: more pages existed beyond
   * CAMPAIGN_ASSET_MAX_PAGES, or a later page failed after earlier pages
   * were already fetched.
   */
  truncated?: boolean;
};

function assetsPagingAfter(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const paging = (raw as Record<string, unknown>).paging;
  if (!paging || typeof paging !== 'object') return null;
  const next = (paging as Record<string, unknown>).next;
  if (!next || typeof next !== 'object') return null;
  const after = (next as Record<string, unknown>).after;
  return typeof after === 'string' && after.trim() ? after.trim() : null;
}

function isTruncatedAssetsPayload(raw: unknown): boolean {
  return Boolean(
    raw &&
      typeof raw === 'object' &&
      (raw as HubSpotCampaignAssetsResult).truncated === true,
  );
}

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
  /** Legacy MARKETING_EMAIL asset list (unchanged for older Hub readers). */
  assets: unknown;
  /**
   * Extra campaign asset buckets (SOCIAL_BROADCAST, LANDING_PAGE, …).
   * MARKETING_EMAIL stays in `assets` only — not duplicated here.
   */
  assetsByType?: Record<string, unknown>;
  /** Normalized SOCIAL_BROADCAST posts (clicks per network; enrich fills URL/time). */
  socialPosts?: HubSpotSocialPost[];
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
  /**
   * Fetch non-email asset types (incl. SOCIAL_BROADCAST) into `assetsByType`.
   * Defaults to true so Content Hub sync stores social posts. Dashboard / funnel
   * live paths that already call `getCampaignAssetsBundle` should pass false.
   */
  includeAssetBundle?: boolean;
  /**
   * Soft-enrich `socialPosts` via legacy GET /broadcast/v1/broadcasts/{id}
   * (channel, URL, publishedAt on each post). Requires private-app scope `social`.
   * Raw broadcast bodies are not stored on the snapshot (report prompt size).
   * Defaults to true when the asset bundle is included; failures are warnings only.
   */
  includeSocialBroadcastDetails?: boolean;
};

const SOCIAL_BROADCAST_ENRICH_CONCURRENCY = 4;
/** HubSpot ~100–190 req / 10s — brief backoff before giving up on 429. */
const HUBSPOT_429_MAX_ATTEMPTS = 4;
const HUBSPOT_429_BASE_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(res: Response, attempt: number): number {
  const header = res.headers.get('Retry-After');
  if (header) {
    const asSeconds = Number(header);
    if (Number.isFinite(asSeconds) && asSeconds >= 0) {
      return Math.min(asSeconds * 1000, 10_000);
    }
  }
  return Math.min(HUBSPOT_429_BASE_DELAY_MS * 2 ** attempt, 8_000);
}

/** Skip broadcast lookup when channel/URL/time already present (e.g. re-sync). */
function isSocialPostAlreadyEnriched(post: HubSpotSocialPost): boolean {
  return Boolean(post.contentUrl || post.publishedAt || post.channelKey);
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
    if (isTestAccountEmail(email)) {
      this.logger.debug(`[HubSpot] Skipping sync for test account ${email}`);
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
    if (isTestAccountEmail(email)) {
      this.logger.debug(
        `[HubSpot] Skipping activity for test account ${email}`,
      );
      return;
    }

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
  async findContactByNpi(
    npiNumber: string,
  ): Promise<HubSpotContactMatch | null> {
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
    const warnings: string[] = [];
    const errors: string[] = [];
    const includeEmailStatistics = options.includeEmailStatistics !== false;
    const includeAssetBundle = options.includeAssetBundle !== false;
    const includeSocialBroadcastDetails =
      options.includeSocialBroadcastDetails ?? includeAssetBundle;
    const emailPrefetch = options.emailStatisticsPrefetch;

    // Campaign-declared dates (email + campaign/metrics; never invent one side).
    const campaignPeriodStart = toIsoDate(input.reportingPeriodStart) ?? '';
    const campaignPeriodEnd = toIsoDate(input.reportingPeriodEnd) ?? '';

    // Asset calls need both dates for SOCIAL_BROADCAST clicks. Fallback only when
    // *both* are missing — never fill one side alone (avoids startDate > endDate)
    // and never apply the fallback to campaign/metrics (preserves all-time).
    let assetPeriodStart = '';
    let assetPeriodEnd = '';
    let fetchDatedAssets = false;
    if (campaignPeriodStart && campaignPeriodEnd) {
      assetPeriodStart = campaignPeriodStart;
      assetPeriodEnd = campaignPeriodEnd;
      fetchDatedAssets = true;
    } else if (!campaignPeriodStart && !campaignPeriodEnd) {
      const fallback = defaultReportingWindow();
      assetPeriodStart = fallback.startDate;
      assetPeriodEnd = fallback.endDate;
      fetchDatedAssets = true;
      warnings.push(
        'Reporting period missing; using last-90-days window for dated asset metrics (SOCIAL_BROADCAST) only. Campaign/metrics requests stay undated (all-time).',
      );
    } else {
      warnings.push(
        'Reporting period incomplete (only one of start/end set); dated asset metrics skipped to avoid an inverted HubSpot date range.',
      );
    }

    // Snapshot dates: campaign's own when present; else the asset window used.
    const reportingPeriodStart =
      campaignPeriodStart || (fetchDatedAssets ? assetPeriodStart : '');
    const reportingPeriodEnd =
      campaignPeriodEnd || (fetchDatedAssets ? assetPeriodEnd : '');

    const account = await this.getAccountMetadata();

    let campaign: unknown = null;
    let metrics: unknown = null;
    let assets: unknown = null;
    let assetsByType: Record<string, unknown> | undefined;
    let socialPosts: HubSpotSocialPost[] | undefined;
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
      // Only pass dates the campaign actually declared (omit = all-time).
      if (campaignPeriodStart) campaignQs.set('startDate', campaignPeriodStart);
      if (campaignPeriodEnd) campaignQs.set('endDate', campaignPeriodEnd);
      const campaignPath =
        `/marketing/v3/campaigns/${encodeURIComponent(hubspotCampaignId)}` +
        `?${campaignQs}`;

      const metricsQs = new URLSearchParams();
      if (campaignPeriodStart) metricsQs.set('startDate', campaignPeriodStart);
      if (campaignPeriodEnd) metricsQs.set('endDate', campaignPeriodEnd);
      const metricsQsString = metricsQs.toString();
      const metricsPath =
        `/marketing/v3/campaigns/${encodeURIComponent(hubspotCampaignId)}/reports/metrics` +
        (metricsQsString ? `?${metricsQsString}` : '');

      const emailAssetOpts = fetchDatedAssets
        ? { startDate: assetPeriodStart, endDate: assetPeriodEnd }
        : {};

      const [campaignResult, metricsResult, assetsResult] = await Promise.all([
        this.requestJson(campaignPath, { method: 'GET' })
          .then((value) => ({ ok: true as const, value }))
          .catch((err: unknown) => ({ ok: false as const, err })),
        this.requestJson(metricsPath, { method: 'GET' })
          .then((value) => ({ ok: true as const, value }))
          .catch((err: unknown) => ({ ok: false as const, err })),
        this.getCampaignAssets(hubspotCampaignId, 'MARKETING_EMAIL', emailAssetOpts)
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
        if (isTruncatedAssetsPayload(assets)) {
          warnings.push(
            `assets: MARKETING_EMAIL truncated at ${CAMPAIGN_ASSET_MAX_PAGES} pages (${CAMPAIGN_ASSET_PAGE_LIMIT}/page).`,
          );
        }
      } else {
        warnings.push(
          `assets: ${
            assetsResult.err instanceof Error
              ? assetsResult.err.message
              : String(assetsResult.err)
          }`,
        );
      }

      if (includeAssetBundle && fetchDatedAssets) {
        const bundle = await this.getCampaignAssetsBundle(hubspotCampaignId, {
          startDate: assetPeriodStart,
          endDate: assetPeriodEnd,
        });
        assetsByType = {};
        let softFails = 0;
        const truncatedTypes: string[] = [];
        for (const [assetType, payload] of Object.entries(bundle)) {
          if (payload == null) {
            softFails += 1;
            continue;
          }
          // Store only id/name/metrics — full HubSpot rows bloat report prompts.
          assetsByType[assetType] = slimCampaignAssetPayload(payload);
          if (isTruncatedAssetsPayload(payload)) {
            truncatedTypes.push(assetType);
          }
        }
        if (softFails > 0) {
          warnings.push(
            `assetsByType: ${softFails} asset type(s) unavailable (soft-fail).`,
          );
        }
        if (truncatedTypes.length > 0) {
          warnings.push(
            `assetsByType truncated (max ${CAMPAIGN_ASSET_MAX_PAGES} pages): ${truncatedTypes.join(', ')}.`,
          );
        }
        socialPosts = parseSocialPostsFromAssets(
          assetsByType.SOCIAL_BROADCAST ?? null,
        );

        if (
          includeSocialBroadcastDetails &&
          socialPosts.length > 0 &&
          !this.authDisabled
        ) {
          const enrich = await this.enrichSocialPostsWithBroadcasts(socialPosts);
          socialPosts = enrich.posts;
          if (enrich.warning) warnings.push(enrich.warning);
        }
      }
    }

    if (emailPrefetch) {
      emailStatistics = emailPrefetch.data;
      if (emailPrefetch.warning) {
        warnings.push(emailPrefetch.warning);
      }
    } else if (includeEmailStatistics) {
      // Do not pass the asset-metrics fallback window — portal-wide email
      // stats for "last 90 days" would inflate the campaign with other traffic.
      const emailStats = await this.getEmailStatisticsForPeriod(
        campaignPeriodStart,
        campaignPeriodEnd,
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
      ...(assetsByType ? { assetsByType } : {}),
      ...(socialPosts ? { socialPosts } : {}),
      emailStatistics,
      warnings,
      errors,
    };
  }

  /**
   * Legacy Social Media API — one broadcast (soft; caller handles errors).
   * Requires private-app scope `social`.
   */
  async getBroadcastById(broadcastGuid: string): Promise<unknown> {
    const id = broadcastGuid.trim();
    if (!id) throw new Error('broadcastGuid is required');
    return this.requestJson(
      `/broadcast/v1/broadcasts/${encodeURIComponent(id)}`,
      { method: 'GET' },
    );
  }

  /**
   * Soft-enrich SOCIAL_BROADCAST posts with channel / URL / publish time.
   * Missing `social` scope or per-id failures never throw — warning only.
   */
  async enrichSocialPostsWithBroadcasts(
    posts: HubSpotSocialPost[],
  ): Promise<{
    posts: HubSpotSocialPost[];
    warning?: string;
  }> {
    if (!posts.length) {
      return { posts };
    }

    const enriched = posts.map((p) => ({ ...p }));
    let scopeMissing = false;
    let hardFailures = 0;
    let enrichedCount = 0;
    let skippedAlreadyEnriched = 0;

    await mapPool(
      posts,
      SOCIAL_BROADCAST_ENRICH_CONCURRENCY,
      async (post, index) => {
        if (scopeMissing || this.authDisabled) {
          return;
        }
        if (isSocialPostAlreadyEnriched(post)) {
          skippedAlreadyEnriched += 1;
          return;
        }
        try {
          const raw = await this.getBroadcastById(post.id);
          const parsed = parseBroadcastEnrichment(raw);
          if (parsed) {
            enriched[index] = applyBroadcastEnrichment(post, parsed);
            enrichedCount += 1;
          }
        } catch (err: unknown) {
          const parsedErr = parseHubSpotApiError(err);
          const msg = err instanceof Error ? err.message : String(err);
          // Abort the whole enrich only on explicit scope signals — not every
          // 403 / not a loose "social" match in the error text (per-post otherwise).
          const missingSocialScope =
            parsedErr.missingScopes.includes(HUBSPOT_SOCIAL_BROADCAST_SCOPE) ||
            parsedErr.category === 'MISSING_SCOPES';

          if (missingSocialScope) {
            scopeMissing = true;
            return;
          }
          hardFailures += 1;
          this.logger.debug(
            `[HubSpot] broadcast enrich failed for ${post.id}: ${msg}`,
          );
        }
      },
    );

    let warning: string | undefined;
    if (scopeMissing) {
      warning =
        `socialPostEnrich: HubSpot token missing \`${HUBSPOT_SOCIAL_BROADCAST_SCOPE}\` scope ` +
        `(or Social API forbidden). Add it to the private app for channel/URL/publish time; sync continues without enrich.`;
    } else if (hardFailures > 0 && enrichedCount === 0 && skippedAlreadyEnriched === 0) {
      warning = `socialPostEnrich: all ${hardFailures} broadcast lookup(s) failed (soft-fail).`;
    } else if (hardFailures > 0) {
      warning = `socialPostEnrich: ${hardFailures} broadcast lookup(s) failed (soft-fail).`;
    }

    return { posts: enriched, warning };
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
  ): Promise<{
    ids: string[];
    contactTypeUsed: string | null;
    warnings: string[];
  }> {
    const warnings: string[] = [];
    const guid = campaignGuid?.trim();
    if (!guid || !this.isConfigured() || !this.accessToken) {
      return { ids: [], contactTypeUsed: null, warnings };
    }

    const maxItems = Math.min(Math.max(options.maxItems ?? 200, 1), 500);
    const candidates = HUBSPOT_CONTACT_TYPE_CANDIDATES[contactType] ?? [
      contactType,
    ];
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
    properties: string[] = ['email', 'firstname', 'lastname', 'npi_number'],
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

  /**
   * Fetch all assets for a campaign asset type (paginated).
   * Follows `paging.next.after` until exhausted or the safety page cap.
   */
  async getCampaignAssets(
    hubspotCampaignId: string,
    assetType: HubSpotCampaignAssetType,
    options: {
      limit?: number;
      startDate?: string;
      endDate?: string;
      maxPages?: number;
    } = {},
  ): Promise<HubSpotCampaignAssetsResult> {
    const pageLimit = Math.min(
      Math.max(options.limit ?? CAMPAIGN_ASSET_PAGE_LIMIT, 1),
      CAMPAIGN_ASSET_PAGE_LIMIT,
    );
    const maxPages = Math.min(
      Math.max(options.maxPages ?? CAMPAIGN_ASSET_MAX_PAGES, 1),
      CAMPAIGN_ASSET_MAX_PAGES,
    );

    const results: unknown[] = [];
    let after: string | null = null;
    let truncated = false;

    for (let page = 0; page < maxPages; page += 1) {
      const qs = new URLSearchParams({ limit: String(pageLimit) });
      if (options.startDate) qs.set('startDate', options.startDate);
      if (options.endDate) qs.set('endDate', options.endDate);
      if (after) qs.set('after', after);

      let raw: Record<string, unknown>;
      try {
        raw = await this.requestJson<Record<string, unknown>>(
          `/marketing/v3/campaigns/${encodeURIComponent(hubspotCampaignId)}/assets/${assetType}?${qs}`,
          { method: 'GET' },
        );
      } catch (err) {
        // Keep pages already fetched; mark truncated so callers don't treat
        // this as a total miss (bundle used to store null and drop them).
        if (results.length > 0) {
          this.logger.debug(
            `[HubSpot] assets ${assetType} page ${page + 1} failed after ` +
              `${results.length} item(s); returning partial: ${
                err instanceof Error ? err.message : String(err)
              }`,
          );
          return { results, truncated: true };
        }
        throw err;
      }

      const pageResults = Array.isArray(raw?.results) ? raw.results : [];
      results.push(...pageResults);

      after = assetsPagingAfter(raw);
      if (!after || pageResults.length === 0) {
        after = null;
        break;
      }

      // More pages remain but we are about to hit the cap on the next loop.
      if (page + 1 >= maxPages) {
        truncated = true;
        break;
      }
    }

    return truncated ? { results, truncated: true } : { results };
  }

  /**
   * Pull additional asset buckets for dashboard enrichment.
   * Total failures are soft (null per type). Partial page failures return
   * the fetched rows with `truncated: true` from `getCampaignAssets`.
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

    for (let attempt = 0; attempt < HUBSPOT_429_MAX_ATTEMPTS; attempt += 1) {
      const res = await fetch(`${HUBSPOT_API_BASE}${path}`, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      });

      if (res.status === 429 && attempt < HUBSPOT_429_MAX_ATTEMPTS - 1) {
        const delay = retryAfterMs(res, attempt);
        this.logger.debug(
          `[HubSpot] 429 on ${init.method} ${path}; retry ${attempt + 1}/${HUBSPOT_429_MAX_ATTEMPTS - 1} in ${delay}ms`,
        );
        await sleep(delay);
        continue;
      }

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

    throw new Error(`HubSpot request failed after retries: ${init.method} ${path}`);
  }
}
