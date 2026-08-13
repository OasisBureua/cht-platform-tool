import { Injectable, Logger } from '@nestjs/common';
import {
  countAvailablePlatforms,
  parseContentHubCampaign,
  parseContentHubPlatformData,
  type ContentHubCampaignRecord,
  type ContentHubPlatformSnapshot,
} from '../content-hub/content-hub-campaign.util';
import { ContentHubCampaignService } from '../content-hub/content-hub-campaign.service';
import {
  accumulateMetricsFromUnknown,
  campaignNameFromDetail,
  countAssetsByType,
  EMPTY_CAMPAIGN_METRIC_TOTALS,
  hasAnyMetricData,
  mergeMetricTotals,
  metricsFromHubspotSnapshot,
  parseSocialPostsFromAssets,
  type CampaignMetricTotals,
  type HubSpotCampaignListItem,
  type HubSpotSocialPost,
} from '../hubspot/hubspot-campaign-metrics.util';
import {
  dedupeStrings,
  HUBSPOT_CAMPAIGNS_DASHBOARD_SCOPES,
} from '../hubspot/hubspot-error.util';
import { JotformService } from '../jotform/jotform.service';
import { SurveysService } from '../surveys/surveys.service';
import { SurveyType } from '@prisma/client';
import {
  HubSpotService,
  type HubSpotMarketingAccess,
} from '../hubspot/hubspot.service';

export type CampaignsDashboardQuery = {
  startDate?: string;
  endDate?: string;
  limit?: number;
};

export type CampaignDataSource = 'live' | 'cached' | 'content_hub' | 'list_only';

export type CampaignSurveyQuestionSummary = {
  prompt: string;
  kind: string;
  summary: string;
};

export type CampaignSurveySummary = {
  surveyId: string;
  title: string;
  type: string;
  jotformFormId: string | null;
  jotformFormUrl: string | null;
  programId: string | null;
  programTitle: string | null;
  totalResponses: number;
  uniqueRespondents: number;
  completionRate: number | null;
  lastResponseAt: string | null;
  jotformSubmissionCount: number | null;
  questions: CampaignSurveyQuestionSummary[];
};

export type CampaignDashboardRow = {
  hubspotCampaignId: string | null;
  name: string;
  status: string | null;
  contentHubCampaignId: number | null;
  contentHubCampaignName: string | null;
  contentHubClientSponsor: string | null;
  contentHubCampaignStatus: string | null;
  contentHubPlatforms: string[];
  contentHubPlatformSnapshots: ContentHubPlatformSnapshot[];
  reportingPeriodStart: string | null;
  reportingPeriodEnd: string | null;
  hubspotSyncedAt: string | null;
  dataSource: CampaignDataSource;
  metrics: CampaignMetricTotals;
  assetCounts: Record<string, number>;
  socialPosts: HubSpotSocialPost[];
  videos: unknown[];
  transcripts: unknown[];
  survey: CampaignSurveySummary | null;
  warnings: string[];
  errors: string[];
};

export type CampaignsDashboardResponse = {
  syncedAt: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  hubspot: {
    connected: boolean;
    accountName: string | null;
    portalId: string | null;
    marketingScopesGranted: boolean;
    missingScopes: string[];
    scopeSetupUrl: string;
    error?: string;
  };
  contentHub: {
    configured: boolean;
    reachable: boolean;
    error?: string;
    totalCampaigns: number;
    linkedCampaigns: number;
    campaignsWithCachedHubspotData: number;
    platformsAvailable: number;
  };
  summary: CampaignMetricTotals & {
    totalHubSpotCampaigns: number;
    campaignsWithMetricData: number;
    campaignsFromCache: number;
    contentHubCampaignsShown: number;
  };
  campaigns: CampaignDashboardRow[];
  warnings: string[];
  errors: string[];
};

const DEFAULT_CAMPAIGN_LIMIT = 25;
const MAX_CAMPAIGN_LIMIT = 100;
const HUBSPOT_LIST_PAGE_SIZE = 100;
const HUBSPOT_SCOPES_DOC_URL =
  'https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/scopes';

type EnrichTarget = {
  hubspotId: string | null;
  contentHubId: number | null;
  name: string;
  status: string | null;
};

function toIsoDate(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  return match?.[1] ?? null;
}

function defaultReportingWindow(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 90);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items.length) return [];
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await fn(items[index], index);
      }
    },
  );

  await Promise.all(workers);
  return results;
}

@Injectable()
export class CampaignsDashboardService {
  private readonly logger = new Logger(CampaignsDashboardService.name);

  constructor(
    private readonly hubspot: HubSpotService,
    private readonly contentHubCampaigns: ContentHubCampaignService,
    private readonly surveys: SurveysService,
    private readonly jotform: JotformService,
  ) {}

  async getDashboard(
    query: CampaignsDashboardQuery = {},
  ): Promise<CampaignsDashboardResponse> {
    const syncedAt = new Date().toISOString();
    const defaults = defaultReportingWindow();
    const reportingPeriodStart =
      toIsoDate(query.startDate) ?? defaults.startDate;
    const reportingPeriodEnd = toIsoDate(query.endDate) ?? defaults.endDate;
    const enrichLimit = Math.min(
      Math.max(query.limit ?? DEFAULT_CAMPAIGN_LIMIT, 1),
      MAX_CAMPAIGN_LIMIT,
    );

    const warnings: string[] = [];
    const errors: string[] = [];

    const account = await this.hubspot.getAccountMetadata();
    const hubspotConnected = this.hubspot.isConfigured() && account.connected;

    const contentHubLoad = await this.loadContentHubCampaigns();
    if (!contentHubLoad.reachable && contentHubLoad.error) {
      warnings.push(`Content Hub unreachable: ${contentHubLoad.error}`);
    }

    const contentHubCampaigns = contentHubLoad.campaigns;
    const linkedCampaigns = contentHubCampaigns.filter(
      (c) => c.hubspotCampaignId,
    );
    const campaignsWithCachedHubspotData = contentHubCampaigns.filter(
      (c) => c.hubspotRawData != null,
    ).length;
    const platformsAvailable = contentHubCampaigns.reduce(
      (sum, c) => sum + countAvailablePlatforms(c.platformSnapshots),
      0,
    );
    const linkByHubspotId = new Map(
      linkedCampaigns
        .filter((c) => c.hubspotCampaignId)
        .map((c) => [c.hubspotCampaignId!, c]),
    );
    const linkByContentHubId = new Map(
      contentHubCampaigns.map((c) => [c.id, c]),
    );

    let hubspotCampaigns: HubSpotCampaignListItem[] = [];
    if (hubspotConnected) {
      try {
        hubspotCampaigns = await this.hubspot.listAllCampaigns(
          HUBSPOT_LIST_PAGE_SIZE,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Unable to list HubSpot campaigns: ${message}`);
        this.logger.warn(`HubSpot campaign list failed: ${message}`);
      }
    } else if (!this.hubspot.isConfigured()) {
      warnings.push('HUBSPOT_ACCESS_TOKEN not configured; live metrics unavailable.');
    } else if (account.error) {
      warnings.push(`HubSpot connection error: ${account.error}`);
    }

    let marketingAccess: HubSpotMarketingAccess | null = null;
    if (hubspotConnected && hubspotCampaigns.length > 0) {
      marketingAccess = await this.hubspot.probeMarketingAccess(
        hubspotCampaigns[0].id,
      );
    } else if (hubspotConnected && linkedCampaigns.length > 0) {
      marketingAccess = await this.hubspot.probeMarketingAccess(
        linkedCampaigns[0].hubspotCampaignId!,
      );
    }

    const marketingScopesGranted =
      marketingAccess?.canReadMetrics === true ||
      marketingAccess?.canReadCampaignDetails === true;

    if (marketingAccess && !marketingScopesGranted) {
      warnings.push(
        'HubSpot token is connected for CRM sync but lacks Marketing Hub campaign scopes. Live campaign metrics require marketing.campaigns.read plus marketing-email (or content) for email stats on a Marketing Hub Professional or Enterprise account.',
      );
      if (campaignsWithCachedHubspotData > 0) {
        warnings.push(
          `Showing cached HubSpot snapshots from ${campaignsWithCachedHubspotData} Content Hub campaign(s). Run HubSpot sync on each campaign after updating token scopes.`,
        );
      } else if (contentHubCampaigns.length > 0) {
        warnings.push(
          'Content Hub campaigns are loaded, but no cached HubSpot snapshots exist yet. Run HubSpot sync on each linked campaign in Content Hub.',
        );
      }
    }

    const campaignsToEnrich = this.selectCampaignsToEnrich(
      hubspotCampaigns,
      contentHubCampaigns,
      enrichLimit,
    );

    const canFetchLive =
      hubspotConnected && marketingScopesGranted && marketingAccess != null;

    const rows = canFetchLive
      ? await mapPool(campaignsToEnrich, 4, async (target) =>
          this.enrichCampaignRowLive(
            target,
            target.hubspotId ? linkByHubspotId.get(target.hubspotId) ?? null : null,
            target.contentHubId
              ? linkByContentHubId.get(target.contentHubId) ?? null
              : null,
            reportingPeriodStart,
            reportingPeriodEnd,
            marketingAccess!,
          ),
        )
      : campaignsToEnrich.map((target) =>
          this.enrichCampaignRowFromCache(
            target,
            target.hubspotId ? linkByHubspotId.get(target.hubspotId) ?? null : null,
            target.contentHubId
              ? linkByContentHubId.get(target.contentHubId) ?? null
              : null,
            reportingPeriodStart,
            reportingPeriodEnd,
            hubspotConnected,
          ),
        );

    const rowsWithSurveys = await this.attachSurveyResults(
      rows,
      contentHubCampaigns,
    );

    const summaryMetrics = mergeMetricTotals(
      ...rowsWithSurveys.map((r) => r.metrics),
    );

    return {
      syncedAt,
      reportingPeriodStart,
      reportingPeriodEnd,
      hubspot: {
        connected: hubspotConnected,
        accountName: account.accountName,
        portalId: account.portalId,
        marketingScopesGranted,
        missingScopes: marketingAccess?.missingScopes.length
          ? marketingAccess.missingScopes
          : [...HUBSPOT_CAMPAIGNS_DASHBOARD_SCOPES],
        scopeSetupUrl: HUBSPOT_SCOPES_DOC_URL,
        ...(account.error ? { error: account.error } : {}),
      },
      contentHub: {
        configured: this.contentHubCampaigns.isConfigured(),
        reachable: contentHubLoad.reachable,
        ...(contentHubLoad.error ? { error: contentHubLoad.error } : {}),
        totalCampaigns: contentHubCampaigns.length,
        linkedCampaigns: linkedCampaigns.length,
        campaignsWithCachedHubspotData,
        platformsAvailable,
      },
      summary: {
        ...summaryMetrics,
        totalHubSpotCampaigns: hubspotCampaigns.length,
        campaignsWithMetricData: rowsWithSurveys.filter((row) =>
          hasAnyMetricData(row.metrics),
        ).length,
        campaignsFromCache: rowsWithSurveys.filter((row) => row.dataSource === 'cached')
          .length,
        contentHubCampaignsShown: rowsWithSurveys.filter((r) => r.contentHubCampaignId)
          .length,
      },
      campaigns: rowsWithSurveys,
      warnings: dedupeStrings(warnings),
      errors: dedupeStrings(errors),
    };
  }

  private async loadContentHubCampaigns(): Promise<{
    campaigns: ContentHubCampaignRecord[];
    reachable: boolean;
    error?: string;
  }> {
    if (!this.contentHubCampaigns.isConfigured()) {
      return { campaigns: [], reachable: false };
    }

    try {
      const response = await this.contentHubCampaigns.listCampaigns();
      const items = Array.isArray(response.items) ? response.items : [];
      const parsed = items
        .map((raw) => parseContentHubCampaign(raw))
        .filter(
          (item): item is Omit<ContentHubCampaignRecord, 'platformSnapshots'> =>
            item != null,
        );

      const withPlatformData = await mapPool(parsed, 4, async (campaign) => {
        let platformSnapshots: ContentHubPlatformSnapshot[] = [];
        try {
          const platformData = await this.contentHubCampaigns.getPlatformData(
            campaign.id,
          );
          platformSnapshots = parseContentHubPlatformData(platformData);
        } catch (err) {
          this.logger.debug(
            `Content Hub platform-data for campaign ${campaign.id} failed: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
        return { ...campaign, platformSnapshots };
      });

      return { campaigns: withPlatformData, reachable: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const target = this.contentHubCampaigns.getAdminBaseUrl() || 'unconfigured';
      this.logger.warn(
        `Content Hub campaign list failed (${target}): ${message}`,
      );
      return {
        campaigns: [],
        reachable: false,
        error: `${message} [${target}]`,
      };
    }
  }

  private selectCampaignsToEnrich(
    hubspotCampaigns: HubSpotCampaignListItem[],
    contentHubCampaigns: ContentHubCampaignRecord[],
    limit: number,
  ): EnrichTarget[] {
    const byHubspotId = new Map(hubspotCampaigns.map((c) => [c.id, c]));
    const seen = new Set<string>();
    const targets: EnrichTarget[] = [];

    const push = (target: EnrichTarget) => {
      const key = target.contentHubId
        ? `ch:${target.contentHubId}`
        : `hs:${target.hubspotId}`;
      if (seen.has(key)) return;
      seen.add(key);
      targets.push(target);
    };

    for (const ch of contentHubCampaigns) {
      const hs = ch.hubspotCampaignId
        ? byHubspotId.get(ch.hubspotCampaignId)
        : null;
      push({
        hubspotId: ch.hubspotCampaignId,
        contentHubId: ch.id,
        name: ch.name,
        status: ch.campaignStatus ?? hs?.status ?? null,
      });
    }

    for (const hs of hubspotCampaigns) {
      if (!contentHubCampaigns.some((c) => c.hubspotCampaignId === hs.id)) {
        push({
          hubspotId: hs.id,
          contentHubId: null,
          name: hs.name,
          status: hs.status,
        });
      }
    }

    return targets.slice(0, limit);
  }

  private contentHubFields(ch: ContentHubCampaignRecord | null) {
    return {
      contentHubCampaignId: ch?.id ?? null,
      contentHubCampaignName: ch?.name ?? null,
      contentHubClientSponsor: ch?.clientSponsor ?? null,
      contentHubCampaignStatus: ch?.campaignStatus ?? null,
      contentHubPlatforms: ch?.platforms ?? [],
      contentHubPlatformSnapshots: ch?.platformSnapshots ?? [],
    };
  }

  private enrichCampaignRowFromCache(
    target: EnrichTarget,
    link: ContentHubCampaignRecord | null,
    chRecord: ContentHubCampaignRecord | null,
    defaultStart: string,
    defaultEnd: string,
    hubspotConnected: boolean,
  ): CampaignDashboardRow {
    const ch = chRecord ?? link;
    const periodStart = ch?.reportingPeriodStart ?? defaultStart;
    const periodEnd = ch?.reportingPeriodEnd ?? defaultEnd;
    const hubFields = this.contentHubFields(ch);

    if (ch?.hubspotRawData) {
      const parsed = metricsFromHubspotSnapshot(ch.hubspotRawData);
      return {
        hubspotCampaignId: target.hubspotId,
        name: target.name || ch.name,
        status: target.status,
        ...hubFields,
        reportingPeriodStart: periodStart,
        reportingPeriodEnd: periodEnd,
        hubspotSyncedAt: ch.hubspotSyncedAt,
        dataSource: 'cached',
        metrics: parsed.metrics,
        assetCounts: parsed.assetCounts,
        socialPosts: parsed.socialPosts,
        videos: [],
        transcripts: [],
        survey: null,
        warnings: [],
        errors: [],
      };
    }

    if (ch && !target.hubspotId) {
      return {
        hubspotCampaignId: null,
        name: ch.name,
        status: ch.campaignStatus,
        ...hubFields,
        reportingPeriodStart: periodStart,
        reportingPeriodEnd: periodEnd,
        hubspotSyncedAt: null,
        dataSource: 'content_hub',
        metrics: { ...EMPTY_CAMPAIGN_METRIC_TOTALS },
        assetCounts: {},
        socialPosts: [],
        videos: [],
        transcripts: [],
        survey: null,
        warnings: [],
        errors: [],
      };
    }

    return {
      hubspotCampaignId: target.hubspotId,
      name: target.name,
      status: target.status,
      ...hubFields,
      reportingPeriodStart: periodStart,
      reportingPeriodEnd: periodEnd,
      hubspotSyncedAt: ch?.hubspotSyncedAt ?? null,
      dataSource: 'list_only',
      metrics: { ...EMPTY_CAMPAIGN_METRIC_TOTALS },
      assetCounts: {},
      socialPosts: [],
      videos: [],
      transcripts: [],
      survey: null,
      warnings: hubspotConnected
        ? []
        : ['HubSpot not connected; showing campaign list only.'],
      errors: [],
    };
  }

  private async enrichCampaignRowLive(
    target: EnrichTarget,
    link: ContentHubCampaignRecord | null,
    chRecord: ContentHubCampaignRecord | null,
    defaultStart: string,
    defaultEnd: string,
    marketingAccess: HubSpotMarketingAccess,
  ): Promise<CampaignDashboardRow> {
    const ch = chRecord ?? link;
    const hubFields = this.contentHubFields(ch);

    if (!target.hubspotId) {
      return this.enrichCampaignRowFromCache(
        target,
        link,
        chRecord,
        defaultStart,
        defaultEnd,
        true,
      );
    }

    const periodStart = ch?.reportingPeriodStart ?? defaultStart;
    const periodEnd = ch?.reportingPeriodEnd ?? defaultEnd;

    const snapshot = await this.hubspot.getCampaignAnalytics(
      {
        hubspotCampaignId: target.hubspotId,
        reportingPeriodStart: periodStart,
        reportingPeriodEnd: periodEnd,
      },
      { includeEmailStatistics: marketingAccess.canReadEmailStats },
    );

    const metrics = mergeMetricTotals(
      accumulateMetricsFromUnknown(snapshot.metrics),
      accumulateMetricsFromUnknown(snapshot.campaign),
      accumulateMetricsFromUnknown(snapshot.assets),
      accumulateMetricsFromUnknown(snapshot.emailStatistics),
    );

    const assetsByType: Record<string, unknown | null> = {};
    if (snapshot.assets && typeof snapshot.assets === 'object') {
      assetsByType.MARKETING_EMAIL = snapshot.assets;
    }

    if (marketingAccess.canReadCampaignDetails) {
      const extraAssets = await this.hubspot.getCampaignAssetsBundle(
        target.hubspotId,
        { startDate: periodStart, endDate: periodEnd },
      );
      for (const [assetType, payload] of Object.entries(extraAssets)) {
        assetsByType[assetType] = payload;
        accumulateMetricsFromUnknown(payload, metrics);
      }
    }

    const socialPosts = parseSocialPostsFromAssets(
      assetsByType.SOCIAL_BROADCAST ?? null,
    );

    const liveHasData = hasAnyMetricData(metrics);
    if (!liveHasData && ch?.hubspotRawData) {
      const cached = metricsFromHubspotSnapshot(ch.hubspotRawData);
      if (hasAnyMetricData(cached.metrics)) {
        return {
          hubspotCampaignId: target.hubspotId,
          name: target.name || ch.name,
          status: target.status,
          ...hubFields,
          reportingPeriodStart: periodStart,
          reportingPeriodEnd: periodEnd,
          hubspotSyncedAt: ch.hubspotSyncedAt,
          dataSource: 'cached',
          metrics: cached.metrics,
          assetCounts: cached.assetCounts,
          socialPosts: cached.socialPosts.length ? cached.socialPosts : socialPosts,
          videos: [],
          transcripts: [],
          survey: null,
          warnings: [
            'Live HubSpot metrics unavailable; showing last synced snapshot.',
          ],
          errors: [],
        };
      }
    }

    const name = campaignNameFromDetail(snapshot.campaign, target.hubspotId);

    return {
      hubspotCampaignId: target.hubspotId,
      name: target.name || name,
      status: target.status,
      ...hubFields,
      reportingPeriodStart: periodStart,
      reportingPeriodEnd: periodEnd,
      hubspotSyncedAt: ch?.hubspotSyncedAt ?? snapshot.syncedAt,
      dataSource: liveHasData ? 'live' : 'list_only',
      metrics,
      assetCounts: countAssetsByType(assetsByType),
      socialPosts,
      videos: [],
      transcripts: [],
      survey: null,
      warnings: [],
      errors: [],
    };
  }

  private async attachSurveyResults(
    rows: CampaignDashboardRow[],
    contentHubCampaigns: ContentHubCampaignRecord[],
  ): Promise<CampaignDashboardRow[]> {
    if (!rows.length) return rows;

    let catalog: Awaited<
      ReturnType<SurveysService['listSurveysForCampaignDashboard']>
    > = [];
    try {
      catalog = await this.surveys.listSurveysForCampaignDashboard();
    } catch (err) {
      this.logger.warn(
        `Survey catalog for campaigns dashboard failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return rows;
    }

    const byId = new Map(catalog.map((s) => [s.id, s]));
    const byProgramTitle = new Map<string, typeof catalog>();
    for (const survey of catalog) {
      const key = survey.programTitle.trim().toLowerCase();
      const list = byProgramTitle.get(key) ?? [];
      list.push(survey);
      byProgramTitle.set(key, list);
    }

    const pick = (candidates: typeof catalog) => {
      if (!candidates.length) return null;
      return (
        candidates.find(
          (s) => s.type === SurveyType.FEEDBACK && s.jotformFormId,
        ) ||
        candidates.find((s) => s.type === SurveyType.FEEDBACK) ||
        candidates.find((s) => s.jotformFormId) ||
        candidates[0]
      );
    };

    const chById = new Map(contentHubCampaigns.map((c) => [c.id, c]));

    return mapPool(rows, 4, async (row) => {
      const ch =
        row.contentHubCampaignId != null
          ? chById.get(row.contentHubCampaignId) ?? null
          : null;

      let match = ch?.surveySourceId
        ? byId.get(ch.surveySourceId) ?? null
        : null;
      if (!match && ch?.programName) {
        match = pick(
          byProgramTitle.get(ch.programName.trim().toLowerCase()) ?? [],
        );
      }
      if (!match) {
        match = pick(byProgramTitle.get(row.name.trim().toLowerCase()) ?? []);
      }
      if (!match) return row;

      try {
        const payload = await this.surveys.getResponseAnalyticsForAdmin(
          match.id,
        );
        let jotformSubmissionCount: number | null = null;
        if (match.jotformFormId) {
          try {
            jotformSubmissionCount = await this.jotform.getFormSubmissionCount(
              match.jotformFormId,
            );
          } catch (err) {
            this.logger.debug(
              `Jotform count for ${match.jotformFormId} failed: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          }
        }

        const totals = payload.analytics.totals;
        return {
          ...row,
          survey: {
            surveyId: match.id,
            title: payload.survey.title,
            type: String(payload.survey.type),
            jotformFormId: match.jotformFormId,
            jotformFormUrl: match.jotformFormId
              ? `https://communityhealthmedia.jotform.com/${match.jotformFormId}`
              : null,
            programId: payload.survey.program?.id ?? match.programId,
            programTitle: payload.survey.program?.title ?? match.programTitle,
            totalResponses: totals.totalResponses,
            uniqueRespondents: totals.uniqueRespondents,
            completionRate: totals.completionRate?.rate ?? null,
            lastResponseAt: totals.lastResponseAt,
            jotformSubmissionCount,
            questions: payload.analytics.questions
              .slice(0, 8)
              .map((q) => summarizeSurveyQuestion(q)),
          },
        };
      } catch (err) {
        this.logger.debug(
          `Survey analytics for ${match.id} failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        return row;
      }
    });
  }
}

function summarizeSurveyQuestion(question: {
  prompt: string;
  kind: string;
  totalAnswered?: number;
  options?: Array<{ label: string; count: number }>;
  average?: number | null;
  responseCount?: number;
}): CampaignSurveyQuestionSummary {
  if (question.kind === 'choice' && Array.isArray(question.options)) {
    const total = question.options.reduce((sum, o) => sum + o.count, 0);
    const top = [...question.options].sort((a, b) => b.count - a.count)[0];
    const pct =
      top && total > 0 ? Math.round((top.count / total) * 100) : null;
    return {
      prompt: question.prompt,
      kind: question.kind,
      summary:
        top && pct != null
          ? `${top.label} ${pct}% (${top.count}/${total})`
          : `${total} answers`,
    };
  }
  if (question.kind === 'rating' && question.average != null) {
    return {
      prompt: question.prompt,
      kind: question.kind,
      summary: `Average ${question.average.toFixed(1)}`,
    };
  }
  return {
    prompt: question.prompt,
    kind: question.kind,
    summary: `${question.responseCount ?? question.totalAnswered ?? 0} responses`,
  };
}
