import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PostEventAttendanceStatus,
  ProgramRegistrationStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  parseContentHubCampaign,
  type ContentHubCampaignRecord,
} from '../content-hub/content-hub-campaign.util';
import { ContentHubCampaignService } from '../content-hub/content-hub-campaign.service';
import {
  accumulateMetricsFromUnknown,
  EMPTY_CAMPAIGN_METRIC_TOTALS,
  mergeMetricTotals,
  metricsFromHubspotSnapshot,
  type CampaignMetricTotals,
  type HubSpotCampaignListItem,
} from '../hubspot/hubspot-campaign-metrics.util';
import {
  HUBSPOT_CAMPAIGNS_DASHBOARD_SCOPES,
} from '../hubspot/hubspot-error.util';
import { HubSpotService } from '../hubspot/hubspot.service';
import {
  FUNNEL_STAGE_KEYS,
  FUNNEL_STAGE_PEOPLE_AVAILABLE,
  type CampaignsFunnelHcpResponse,
  type CampaignsFunnelPeopleQuery,
  type CampaignsFunnelPeopleResponse,
  type CampaignsFunnelQuery,
  type CampaignsFunnelResponse,
  type FunnelFilterOptions,
  type FunnelStageKey,
  isFunnelStageKey,
} from './campaigns-funnel.types';
import {
  buildStagesFromCounts,
  defaultReportingWindow,
  emptyCountsByStage,
  mapPool,
  toIsoDate,
  utcDayBounds,
} from './campaigns-funnel.util';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_PEOPLE_LIMIT = 50;
const MAX_PEOPLE_LIMIT = 200;
const HUBSPOT_LIST_PAGE_SIZE = 100;
const HUBSPOT_METRICS_CONCURRENCY = 4;
/** Soft cap so funnel aggregation stays responsive. */
const MAX_HUBSPOT_CAMPAIGNS_TO_AGGREGATE = 50;
/** Max register/attend/survey events returned on HCP drill-down. */
const MAX_HCP_ACTIVITY_EVENTS = 12;

type FunnelChCampaign = Omit<ContentHubCampaignRecord, 'platformSnapshots'>;

type ResolvedScope = {
  hubspotCampaignIds: string[];
  programIds: string[] | null;
  contentHubCampaignsInScope: FunnelChCampaign[];
  warnings: string[];
};

/**
 * Funnel aggregation, people lists, and HCP drill-down (Chunks 2–5).
 */
@Injectable()
export class CampaignsFunnelService {
  private readonly logger = new Logger(CampaignsFunnelService.name);

  constructor(
    private readonly hubspot: HubSpotService,
    private readonly contentHubCampaigns: ContentHubCampaignService,
    private readonly prisma: PrismaService,
  ) {}

  async getFunnel(
    query: CampaignsFunnelQuery,
  ): Promise<CampaignsFunnelResponse> {
    this.assertOptionalIsoDate('startDate', query.startDate);
    this.assertOptionalIsoDate('endDate', query.endDate);
    this.assertDateOrder(query.startDate, query.endDate);

    const defaults = defaultReportingWindow();
    const reportingPeriodStart =
      toIsoDate(query.startDate) ?? defaults.startDate;
    const reportingPeriodEnd = toIsoDate(query.endDate) ?? defaults.endDate;
    const warnings: string[] = [];

    const account = await this.hubspot.getAccountMetadata();
    const hubspotConnected = this.hubspot.isConfigured() && account.connected;

    const contentHubLoad = await this.loadContentHubCampaigns();
    if (!contentHubLoad.configured) {
      warnings.push(
        'Content Hub is not configured; client/program campaign links unavailable.',
      );
    } else if (!contentHubLoad.reachable) {
      warnings.push(
        `Content Hub unreachable${
          contentHubLoad.error ? `: ${contentHubLoad.error}` : ''
        }. Funnel still uses HubSpot and CHT data when available.`,
      );
    }

    let hubspotCampaigns: HubSpotCampaignListItem[] = [];
    if (hubspotConnected) {
      try {
        hubspotCampaigns = await this.hubspot.listAllCampaigns(
          HUBSPOT_LIST_PAGE_SIZE,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        warnings.push(`Unable to list HubSpot campaigns: ${message}`);
        this.logger.warn(`Funnel HubSpot list failed: ${message}`);
      }
    } else if (!this.hubspot.isConfigured()) {
      warnings.push(
        'HUBSPOT_ACCESS_TOKEN not configured; Aware/Engaged/Captured will be zero.',
      );
    } else if (account.error) {
      warnings.push(`HubSpot connection error: ${account.error}`);
    }

    let marketingScopesGranted = false;
    let missingScopes: string[] = [];
    if (hubspotConnected && hubspotCampaigns.length > 0) {
      const access = await this.hubspot.probeMarketingAccess(
        hubspotCampaigns[0].id,
      );
      marketingScopesGranted =
        access.canReadMetrics || access.canReadCampaignDetails;
      missingScopes = access.missingScopes;
      if (!marketingScopesGranted) {
        warnings.push(
          'HubSpot token lacks Marketing Hub campaign scopes; trying Content Hub cached snapshots for Aware/Engaged/Captured.',
        );
      }
    } else if (hubspotConnected) {
      missingScopes = [...HUBSPOT_CAMPAIGNS_DASHBOARD_SCOPES];
    }

    const scope = this.resolveScope(query, contentHubLoad.campaigns, {
      hubspotCampaignIds: hubspotCampaigns.map((c) => c.id),
    });
    warnings.push(...scope.warnings);

    const hubspotTotals = await this.aggregateHubSpotStageCounts({
      hubspotCampaignIds: scope.hubspotCampaignIds,
      contentHubCampaigns: contentHubLoad.campaigns,
      reportingPeriodStart,
      reportingPeriodEnd,
      hubspotConnected,
      marketingScopesGranted,
    });
    warnings.push(...hubspotTotals.warnings);

    const chtCounts = await this.countChtStages({
      programIds: scope.programIds,
      reportingPeriodStart,
      reportingPeriodEnd,
    });

    const counts = emptyCountsByStage();
    counts.aware = hubspotTotals.metrics.sessions;
    counts.engaged = hubspotTotals.metrics.landingPageViews;
    counts.captured = hubspotTotals.metrics.formSubmissions;
    counts.registered = chtCounts.registered;
    counts.attended = chtCounts.attended;
    counts.converted = chtCounts.converted;

    const filters = await this.buildFilterOptions(
      hubspotCampaigns,
      contentHubLoad.campaigns,
    );

    return {
      syncedAt: new Date().toISOString(),
      reportingPeriodStart,
      reportingPeriodEnd,
      stages: buildStagesFromCounts(counts),
      clientRollup: [],
      filters,
      warnings: [...new Set(warnings.filter((w) => w.trim()))],
      hubspot: {
        connected: hubspotConnected,
        marketingScopesGranted,
        missingScopes,
      },
      contentHub: {
        configured: contentHubLoad.configured,
        reachable: contentHubLoad.reachable,
      },
    };
  }

  async getPeople(
    query: CampaignsFunnelPeopleQuery,
  ): Promise<CampaignsFunnelPeopleResponse> {
    this.assertOptionalIsoDate('startDate', query.startDate);
    this.assertOptionalIsoDate('endDate', query.endDate);
    this.assertDateOrder(query.startDate, query.endDate);

    const stage = query.stage;
    if (!stage || !isFunnelStageKey(stage)) {
      throw new BadRequestException(
        `stage is required and must be one of: ${FUNNEL_STAGE_KEYS.join(', ')}`,
      );
    }

    const limit = this.parseLimit(query.limit);
    const offset = this.parseOffset(query.offset);
    const peopleAvailable = FUNNEL_STAGE_PEOPLE_AVAILABLE[stage];

    if (!peopleAvailable) {
      return {
        stage,
        peopleAvailable: false,
        items: [],
        total: 0,
        limit,
        offset,
        warnings: [
          `Stage "${stage}" is HubSpot aggregate-only in V1; named people are not available.`,
        ],
      };
    }

    const defaults = defaultReportingWindow();
    const reportingPeriodStart =
      toIsoDate(query.startDate) ?? defaults.startDate;
    const reportingPeriodEnd = toIsoDate(query.endDate) ?? defaults.endDate;
    const warnings: string[] = [];

    const contentHubLoad = await this.loadContentHubCampaigns();
    const scope = this.resolveScope(query, contentHubLoad.campaigns, {
      hubspotCampaignIds: [],
    });
    warnings.push(...scope.warnings);

    if (Array.isArray(scope.programIds) && scope.programIds.length === 0) {
      return {
        stage,
        peopleAvailable: true,
        items: [],
        total: 0,
        limit,
        offset,
        warnings: [
          ...warnings,
          'No CHT programs in scope for this filter; people list is empty.',
        ],
      };
    }

    const where = this.chtWhereForStage(
      stage,
      scope.programIds,
      reportingPeriodStart,
      reportingPeriodEnd,
    );
    if (!where) {
      return {
        stage,
        peopleAvailable: true,
        items: [],
        total: 0,
        limit,
        offset,
        warnings: [...warnings, `No people query for stage "${stage}".`],
      };
    }

    const orderBy =
      stage === 'converted'
        ? { postEventSurveyAcknowledgedAt: 'desc' as const }
        : stage === 'attended'
          ? { postEventAttendanceReviewedAt: 'desc' as const }
          : { reviewedAt: 'desc' as const };

    const [total, rows] = await Promise.all([
      this.prisma.programRegistration.count({ where }),
      this.prisma.programRegistration.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              npiNumber: true,
            },
          },
          program: {
            select: { id: true, title: true },
          },
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
    ]);

    const chByProgramId = new Map<string, FunnelChCampaign>();
    for (const ch of contentHubLoad.campaigns) {
      if (ch.surveySourceProgramId && !chByProgramId.has(ch.surveySourceProgramId)) {
        chByProgramId.set(ch.surveySourceProgramId, ch);
      }
    }

    const items = rows.map((row) => {
      const ch = chByProgramId.get(row.programId) ?? null;
      const stageEnteredAt =
        stage === 'converted'
          ? row.postEventSurveyAcknowledgedAt
          : stage === 'attended'
            ? row.postEventAttendanceReviewedAt ?? row.reviewedAt
            : row.reviewedAt ?? row.updatedAt;

      return {
        userId: row.user.id,
        firstName: row.user.firstName,
        lastName: row.user.lastName,
        email: row.user.email,
        npiNumber: row.user.npiNumber,
        programId: row.program.id,
        programTitle: row.program.title,
        campaignId: ch?.hubspotCampaignId ?? (ch ? String(ch.id) : null),
        campaignName: ch?.name ?? null,
        clientSponsor: ch?.clientSponsor ?? null,
        stageEnteredAt: stageEnteredAt
          ? stageEnteredAt.toISOString()
          : null,
      };
    });

    return {
      stage,
      peopleAvailable: true,
      items,
      total,
      limit,
      offset,
      warnings: [...new Set(warnings.filter((w) => w.trim()))],
    };
  }

  async getHcp(userId: string): Promise<CampaignsFunnelHcpResponse> {
    const id = userId?.trim();
    if (!id) {
      throw new BadRequestException('userId is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        npiNumber: true,
      },
    });
    if (!user) {
      throw new NotFoundException(`User "${id}" not found`);
    }

    const warnings: string[] = [];
    const registrations = await this.prisma.programRegistration.findMany({
      where: { userId: id },
      include: {
        program: { select: { id: true, title: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    const lastChtActivity = this.buildHcpActivityTimeline(registrations);

    const contentHubLoad = await this.loadContentHubCampaigns();
    if (!contentHubLoad.configured) {
      warnings.push(
        'Content Hub is not configured; last campaign may be unavailable.',
      );
    } else if (!contentHubLoad.reachable) {
      warnings.push(
        `Content Hub unreachable${
          contentHubLoad.error ? `: ${contentHubLoad.error}` : ''
        }; last campaign may be unavailable.`,
      );
    }

    const lastCampaign = this.resolveLastCampaignForPrograms(
      registrations.map((r) => r.programId),
      contentHubLoad.campaigns,
    );
    if (!lastCampaign && registrations.length > 0) {
      warnings.push(
        'No Content Hub campaign linked to this HCP’s programs; last campaign unavailable.',
      );
    }

    const match = await this.matchHubSpotContact(user, warnings);

    return {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      npiNumber: user.npiNumber,
      match,
      lastCampaign,
      lastChtActivity,
      warnings: [...new Set(warnings.filter((w) => w.trim()))],
    };
  }

  private buildHcpActivityTimeline(
    registrations: Array<{
      status: ProgramRegistrationStatus;
      reviewedAt: Date | null;
      updatedAt: Date;
      createdAt: Date;
      postEventAttendanceStatus: PostEventAttendanceStatus;
      postEventAttendanceReviewedAt: Date | null;
      postEventSurveyAcknowledgedAt: Date | null;
      program: { id: string; title: string };
    }>,
  ): CampaignsFunnelHcpResponse['lastChtActivity'] {
    const events: CampaignsFunnelHcpResponse['lastChtActivity'] = [];

    for (const row of registrations) {
      if (row.status === ProgramRegistrationStatus.APPROVED) {
        const at = row.reviewedAt ?? row.updatedAt ?? row.createdAt;
        events.push({
          type: 'register',
          at: at.toISOString(),
          programId: row.program.id,
          programTitle: row.program.title,
        });
      }
      if (
        row.postEventAttendanceStatus === PostEventAttendanceStatus.VERIFIED
      ) {
        const at =
          row.postEventAttendanceReviewedAt ??
          row.reviewedAt ??
          row.updatedAt;
        events.push({
          type: 'attend',
          at: at.toISOString(),
          programId: row.program.id,
          programTitle: row.program.title,
        });
      }
      if (row.postEventSurveyAcknowledgedAt) {
        events.push({
          type: 'survey',
          at: row.postEventSurveyAcknowledgedAt.toISOString(),
          programId: row.program.id,
          programTitle: row.program.title,
        });
      }
    }

    events.sort((a, b) => {
      const aTime = a.at ? Date.parse(a.at) : 0;
      const bTime = b.at ? Date.parse(b.at) : 0;
      return bTime - aTime;
    });

    return events.slice(0, MAX_HCP_ACTIVITY_EVENTS);
  }

  private resolveLastCampaignForPrograms(
    programIdsInRecencyOrder: string[],
    contentHubCampaigns: FunnelChCampaign[],
  ): CampaignsFunnelHcpResponse['lastCampaign'] {
    if (!programIdsInRecencyOrder.length || !contentHubCampaigns.length) {
      return null;
    }

    const chByProgramId = new Map<string, FunnelChCampaign>();
    for (const ch of contentHubCampaigns) {
      if (
        ch.surveySourceProgramId &&
        !chByProgramId.has(ch.surveySourceProgramId)
      ) {
        chByProgramId.set(ch.surveySourceProgramId, ch);
      }
    }

    for (const programId of programIdsInRecencyOrder) {
      const ch = chByProgramId.get(programId);
      if (!ch) continue;
      return {
        id: ch.hubspotCampaignId ?? String(ch.id),
        name: ch.name,
        clientSponsor: ch.clientSponsor,
      };
    }

    return null;
  }

  private async matchHubSpotContact(
    user: {
      email: string;
      npiNumber: string | null;
    },
    warnings: string[],
  ): Promise<CampaignsFunnelHcpResponse['match']> {
    if (!this.hubspot.isConfigured()) {
      warnings.push(
        'HubSpot is not configured; contact match unavailable.',
      );
      return { matched: false, method: null };
    }

    const byEmail = await this.hubspot.findContactByEmail(user.email);
    if (byEmail) {
      return { matched: true, method: 'email' };
    }

    const npi = (user.npiNumber || '').replace(/\D/g, '');
    if (npi.length === 10) {
      const byNpi = await this.hubspot.findContactByNpi(npi);
      if (byNpi) {
        return { matched: true, method: 'npi' };
      }
    }

    warnings.push(
      'No matching HubSpot contact found by email or NPI.',
    );
    return { matched: false, method: null };
  }

  private resolveScope(
    query: CampaignsFunnelQuery,
    contentHubCampaigns: FunnelChCampaign[],
    hubspotUniverse: { hubspotCampaignIds: string[] },
  ): ResolvedScope {
    const warnings: string[] = [];
    const campaignId = query.campaignId?.trim() || '';
    const clientSponsor = query.clientSponsor?.trim() || '';
    const programId = query.programId?.trim() || '';
    const hasCampaignFilter = !!campaignId;
    const hasClientFilter = !!clientSponsor;
    const hasProgramFilter = !!programId;
    const hasAnyFilter =
      hasCampaignFilter || hasClientFilter || hasProgramFilter;

    // --- HubSpot-only campaign id (not in Content Hub) ---
    if (
      hasCampaignFilter &&
      !hasClientFilter &&
      hubspotUniverse.hubspotCampaignIds.includes(campaignId) &&
      !contentHubCampaigns.some(
        (c) =>
          c.hubspotCampaignId === campaignId ||
          String(c.id) === campaignId,
      )
    ) {
      return {
        hubspotCampaignIds: [campaignId],
        programIds: hasProgramFilter ? [programId] : null,
        contentHubCampaignsInScope: [],
        warnings: hasProgramFilter
          ? []
          : [
              'Campaign is HubSpot-only (not linked in Content Hub); CHT Registered/Attended/Converted use all programs unless programId is set.',
            ],
      };
    }

    let chInScope = [...contentHubCampaigns];

    if (hasClientFilter) {
      const needle = clientSponsor.toLowerCase();
      chInScope = chInScope.filter(
        (c) => (c.clientSponsor ?? '').toLowerCase() === needle,
      );
      if (!chInScope.length) {
        warnings.push(
          `No Content Hub campaigns match clientSponsor "${clientSponsor}".`,
        );
      }
    }

    if (hasCampaignFilter) {
      const asNumber = Number(campaignId);
      const matched = chInScope.filter(
        (c) =>
          c.hubspotCampaignId === campaignId ||
          (Number.isFinite(asNumber) && c.id === asNumber),
      );
      if (matched.length) {
        chInScope = matched;
      } else {
        warnings.push(`No campaign matched campaignId "${campaignId}".`);
        chInScope = [];
      }
    }

    if (hasProgramFilter) {
      const linked = chInScope.filter(
        (c) => c.surveySourceProgramId === programId,
      );
      if (linked.length) {
        chInScope = linked;
      } else if (hasCampaignFilter || hasClientFilter) {
        warnings.push(
          `No Content Hub campaign in scope links surveySourceProgramId to program "${programId}". CHT counts still filter to that program.`,
        );
      } else {
        // Program-only: prefer CH rows linked to this program (may be empty).
        chInScope = contentHubCampaigns.filter(
          (c) => c.surveySourceProgramId === programId,
        );
        if (!chInScope.some((c) => c.hubspotCampaignId)) {
          warnings.push(
            `No Content Hub campaign links program "${programId}" to HubSpot; Aware/Engaged/Captured may be zero.`,
          );
        }
      }
    }

    const hubspotIds = new Set<string>();
    if (!hasAnyFilter) {
      for (const id of hubspotUniverse.hubspotCampaignIds) {
        hubspotIds.add(id);
      }
    } else {
      for (const ch of chInScope) {
        if (ch.hubspotCampaignId) hubspotIds.add(ch.hubspotCampaignId);
      }
      if (
        hasCampaignFilter &&
        hubspotUniverse.hubspotCampaignIds.includes(campaignId)
      ) {
        hubspotIds.add(campaignId);
      }
    }

    let programIds: string[] | null = null;
    if (hasProgramFilter) {
      programIds = [programId];
    } else if (hasCampaignFilter || hasClientFilter) {
      const fromCh = [
        ...new Set(
          chInScope
            .map((c) => c.surveySourceProgramId)
            .filter((id): id is string => !!id),
        ),
      ];
      if (fromCh.length) {
        programIds = fromCh;
      } else {
        warnings.push(
          'No surveySourceProgramId on scoped Content Hub campaign(s); CHT Registered/Attended/Converted counts are zero for this filter.',
        );
        programIds = [];
      }
    }

    return {
      hubspotCampaignIds: [...hubspotIds],
      programIds,
      contentHubCampaignsInScope: chInScope,
      warnings,
    };
  }

  private async aggregateHubSpotStageCounts(input: {
    hubspotCampaignIds: string[];
    contentHubCampaigns: FunnelChCampaign[];
    reportingPeriodStart: string;
    reportingPeriodEnd: string;
    hubspotConnected: boolean;
    marketingScopesGranted: boolean;
  }): Promise<{ metrics: CampaignMetricTotals; warnings: string[] }> {
    const warnings: string[] = [];
    let ids = input.hubspotCampaignIds;
    if (ids.length > MAX_HUBSPOT_CAMPAIGNS_TO_AGGREGATE) {
      warnings.push(
        `Aggregating HubSpot metrics for the first ${MAX_HUBSPOT_CAMPAIGNS_TO_AGGREGATE} of ${ids.length} campaigns.`,
      );
      ids = ids.slice(0, MAX_HUBSPOT_CAMPAIGNS_TO_AGGREGATE);
    }

    if (!ids.length) {
      return { metrics: { ...EMPTY_CAMPAIGN_METRIC_TOTALS }, warnings };
    }

    const cacheByHubspotId = new Map(
      input.contentHubCampaigns
        .filter((c) => c.hubspotCampaignId && c.hubspotRawData != null)
        .map((c) => [c.hubspotCampaignId!, c]),
    );

    const perCampaign = await mapPool(
      ids,
      HUBSPOT_METRICS_CONCURRENCY,
      async (hubspotCampaignId) => {
        if (input.hubspotConnected && input.marketingScopesGranted) {
          try {
            const snapshot = await this.hubspot.getCampaignAnalytics(
              {
                hubspotCampaignId,
                reportingPeriodStart: input.reportingPeriodStart,
                reportingPeriodEnd: input.reportingPeriodEnd,
              },
              { includeEmailStatistics: false },
            );
            return mergeMetricTotals(
              accumulateMetricsFromUnknown(snapshot.metrics),
              accumulateMetricsFromUnknown(snapshot.campaign),
              accumulateMetricsFromUnknown(snapshot.assets),
            );
          } catch (err) {
            this.logger.debug(
              `Funnel live metrics failed for ${hubspotCampaignId}: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          }
        }

        const cached = cacheByHubspotId.get(hubspotCampaignId);
        if (cached?.hubspotRawData) {
          return metricsFromHubspotSnapshot(cached.hubspotRawData).metrics;
        }
        return { ...EMPTY_CAMPAIGN_METRIC_TOTALS };
      },
    );

    const usedCacheOnly =
      !input.marketingScopesGranted &&
      ids.some((id) => cacheByHubspotId.has(id));
    if (usedCacheOnly) {
      warnings.push(
        'Aware/Engaged/Captured include Content Hub cached HubSpot snapshots where live metrics were unavailable.',
      );
    }

    return {
      metrics: mergeMetricTotals(...perCampaign),
      warnings,
    };
  }

  private async countChtStages(input: {
    programIds: string[] | null;
    reportingPeriodStart: string;
    reportingPeriodEnd: string;
  }): Promise<{
    registered: number;
    attended: number;
    converted: number;
  }> {
    if (Array.isArray(input.programIds) && input.programIds.length === 0) {
      return { registered: 0, attended: 0, converted: 0 };
    }

    const [registered, attended, converted] = await Promise.all([
      this.prisma.programRegistration.count({
        where: this.chtWhereForStage(
          'registered',
          input.programIds,
          input.reportingPeriodStart,
          input.reportingPeriodEnd,
        )!,
      }),
      this.prisma.programRegistration.count({
        where: this.chtWhereForStage(
          'attended',
          input.programIds,
          input.reportingPeriodStart,
          input.reportingPeriodEnd,
        )!,
      }),
      this.prisma.programRegistration.count({
        where: this.chtWhereForStage(
          'converted',
          input.programIds,
          input.reportingPeriodStart,
          input.reportingPeriodEnd,
        )!,
      }),
    ]);

    return { registered, attended, converted };
  }

  /** Shared CHT stage filter — must stay aligned with Chunk 0 rules + countChtStages. */
  private chtWhereForStage(
    stage: FunnelStageKey,
    programIds: string[] | null,
    reportingPeriodStart: string,
    reportingPeriodEnd: string,
  ): Record<string, unknown> | null {
    if (stage === 'aware' || stage === 'engaged' || stage === 'captured') {
      return null;
    }

    const bounds = utcDayBounds(reportingPeriodStart, reportingPeriodEnd);
    const programFilter =
      programIds == null ? {} : { programId: { in: programIds } };
    const approvedBase = {
      status: ProgramRegistrationStatus.APPROVED,
      ...programFilter,
    };

    if (stage === 'registered') {
      return {
        ...approvedBase,
        OR: [
          { reviewedAt: { gte: bounds.gte, lte: bounds.lte } },
          {
            reviewedAt: null,
            updatedAt: { gte: bounds.gte, lte: bounds.lte },
          },
        ],
      };
    }

    if (stage === 'attended') {
      return {
        ...approvedBase,
        postEventAttendanceStatus: PostEventAttendanceStatus.VERIFIED,
        OR: [
          {
            postEventAttendanceReviewedAt: {
              gte: bounds.gte,
              lte: bounds.lte,
            },
          },
          {
            postEventAttendanceReviewedAt: null,
            reviewedAt: { gte: bounds.gte, lte: bounds.lte },
          },
        ],
      };
    }

    // converted
    return {
      ...approvedBase,
      postEventAttendanceStatus: PostEventAttendanceStatus.VERIFIED,
      postEventSurveyAcknowledgedAt: {
        not: null,
        gte: bounds.gte,
        lte: bounds.lte,
      },
    };
  }

  private async loadContentHubCampaigns(): Promise<{
    campaigns: FunnelChCampaign[];
    configured: boolean;
    reachable: boolean;
    error?: string;
  }> {
    if (!this.contentHubCampaigns.isConfigured()) {
      return { campaigns: [], configured: false, reachable: false };
    }

    try {
      const response = await this.contentHubCampaigns.listCampaigns();
      const items = Array.isArray(response.items) ? response.items : [];
      const campaigns = items
        .map((raw) => parseContentHubCampaign(raw))
        .filter((item): item is FunnelChCampaign => item != null);
      return { campaigns, configured: true, reachable: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Funnel Content Hub list failed: ${message}`);
      return {
        campaigns: [],
        configured: true,
        reachable: false,
        error: message,
      };
    }
  }

  private async buildFilterOptions(
    hubspotCampaigns: HubSpotCampaignListItem[],
    contentHubCampaigns: FunnelChCampaign[],
  ): Promise<FunnelFilterOptions> {
    const campaigns: Array<{ id: string; name: string }> = [];
    const seen = new Set<string>();

    for (const ch of contentHubCampaigns) {
      const id = ch.hubspotCampaignId ?? `ch:${ch.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      campaigns.push({
        id: ch.hubspotCampaignId ?? String(ch.id),
        name: ch.name,
      });
    }
    for (const hs of hubspotCampaigns) {
      if (seen.has(hs.id)) continue;
      seen.add(hs.id);
      campaigns.push({ id: hs.id, name: hs.name });
    }

    const clients = [
      ...new Set(
        contentHubCampaigns
          .map((c) => c.clientSponsor)
          .filter((v): v is string => !!v),
      ),
    ].sort((a, b) => a.localeCompare(b));

    const programs = await this.prisma.program.findMany({
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
      take: 200,
    });

    return {
      campaigns: campaigns.slice(0, 200),
      clients,
      programs: programs.map((p) => ({ id: p.id, title: p.title })),
    };
  }

  private assertOptionalIsoDate(
    field: string,
    value: string | undefined,
  ): void {
    const raw = value?.trim();
    if (!raw) return;
    if (!ISO_DATE_RE.test(raw)) {
      throw new BadRequestException(
        `${field} must be an ISO date (YYYY-MM-DD)`,
      );
    }
  }

  private assertDateOrder(
    startDate: string | undefined,
    endDate: string | undefined,
  ): void {
    const start = startDate?.trim();
    const end = endDate?.trim();
    if (start && end && start > end) {
      throw new BadRequestException(
        'startDate must be on or before endDate',
      );
    }
  }

  private parseLimit(limit: number | undefined): number {
    if (limit == null || Number.isNaN(limit)) return DEFAULT_PEOPLE_LIMIT;
    if (!Number.isFinite(limit) || limit < 1) {
      throw new BadRequestException('limit must be a positive number');
    }
    return Math.min(Math.floor(limit), MAX_PEOPLE_LIMIT);
  }

  private parseOffset(offset: number | undefined): number {
    if (offset == null || Number.isNaN(offset)) return 0;
    if (!Number.isFinite(offset) || offset < 0) {
      throw new BadRequestException('offset must be a non-negative number');
    }
    return Math.floor(offset);
  }
}
