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
  HUBSPOT_FUNNEL_PEOPLE_STAGES,
  type CampaignsFunnelHcpResponse,
  type CampaignsFunnelPeopleQuery,
  type CampaignsFunnelPeopleResponse,
  type CampaignsFunnelQuery,
  type CampaignsFunnelResponse,
  type FunnelClientRollupRow,
  type FunnelFilterOptions,
  type FunnelPersonRow,
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
import type { HubSpotCampaignContactReportType } from '../hubspot/hubspot.service';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_PEOPLE_LIMIT = 50;
const MAX_PEOPLE_LIMIT = 200;
const HUBSPOT_LIST_PAGE_SIZE = 200;
const HUBSPOT_METRICS_CONCURRENCY = 4;
/** Soft cap so funnel aggregation stays responsive. */
const MAX_HUBSPOT_CAMPAIGNS_TO_AGGREGATE = 100;
/** Max HubSpot contacts collected across campaigns for a people list. */
const MAX_HUBSPOT_CONTACTS_FOR_PEOPLE = 200;
/** Max register/attend/survey events returned on HCP drill-down. */
const MAX_HCP_ACTIVITY_EVENTS = 12;

const HUBSPOT_STAGE_CONTACT_TYPE: Record<
  'aware' | 'engaged' | 'captured',
  HubSpotCampaignContactReportType
> = {
  // Sessions / LP views are not person-level; closest named HubSpot cohorts:
  aware: 'influencedContacts',
  engaged: 'newContactsFirstTouch',
  captured: 'newContactsLastTouch',
};

const HUBSPOT_STAGE_PEOPLE_BASIS: Record<
  'aware' | 'engaged' | 'captured',
  string
> = {
  aware:
    'Aware people use HubSpot influenced contacts (sessions are not person-level).',
  engaged:
    'Engaged people use HubSpot first-touch new contacts (landing page views are not person-level).',
  captured:
    'Captured people use HubSpot last-touch new contacts (closest named cohort to form submissions).',
};

type FunnelChCampaign = Omit<ContentHubCampaignRecord, 'platformSnapshots'>;

type ResolvedScope = {
  hubspotCampaignIds: string[];
  programIds: string[] | null;
  contentHubCampaignsInScope: FunnelChCampaign[];
  warnings: string[];
};

/**
 * Funnel aggregation, people lists, HCP drill-down, and client rollup (Chunks 2–6).
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

    warnings.push(
      ...this.buildProductionLinkWarnings(
        contentHubLoad.campaigns,
        scope,
        hubspotCampaigns.length,
      ),
    );

    const clientRollup = await this.buildClientRollup({
      query,
      hubspotCampaigns,
      contentHubCampaigns: contentHubLoad.campaigns,
      metricsByCampaignId: hubspotTotals.byCampaignId,
      reportingPeriodStart,
      reportingPeriodEnd,
      scopedHubspotIds: new Set(scope.hubspotCampaignIds),
    });

    const filters = await this.buildFilterOptions(
      hubspotCampaigns,
      contentHubLoad.campaigns,
    );

    if (
      !contentHubLoad.campaigns.some((c) => c.clientSponsor?.trim()) &&
      contentHubLoad.configured
    ) {
      warnings.push(
        'No Content Hub clientSponsor values found; client filter/rollup will show Not linked until sponsors are set on linked campaigns.',
      );
    }

    return {
      syncedAt: new Date().toISOString(),
      reportingPeriodStart,
      reportingPeriodEnd,
      stages: buildStagesFromCounts(counts),
      clientRollup,
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
          `Stage "${stage}" is HubSpot count-only; named people are not available (sessions / landing page views / form submissions are not person-level lists).`,
        ],
      };
    }

    const defaults = defaultReportingWindow();
    const reportingPeriodStart =
      toIsoDate(query.startDate) ?? defaults.startDate;
    const reportingPeriodEnd = toIsoDate(query.endDate) ?? defaults.endDate;
    const warnings: string[] = [];

    const contentHubLoad = await this.loadContentHubCampaigns();
    // Need HubSpot campaign ids so HubSpot-only campaign filters resolve like getFunnel.
    let hubspotCampaigns: HubSpotCampaignListItem[] = [];
    if (this.hubspot.isConfigured()) {
      try {
        hubspotCampaigns = await this.hubspot.listAllCampaigns(
          HUBSPOT_LIST_PAGE_SIZE,
        );
      } catch (err) {
        this.logger.debug(
          `Funnel people HubSpot list failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    const hubspotCampaignIds = hubspotCampaigns.map((c) => c.id);
    const scope = this.resolveScope(query, contentHubLoad.campaigns, {
      hubspotCampaignIds,
    });
    warnings.push(...scope.warnings);

    if (HUBSPOT_FUNNEL_PEOPLE_STAGES.has(stage)) {
      return this.getHubSpotStagePeople({
        stage: stage as 'aware' | 'engaged' | 'captured',
        scope,
        hubspotCampaigns,
        contentHubCampaigns: contentHubLoad.campaigns,
        reportingPeriodStart,
        reportingPeriodEnd,
        limit,
        offset,
        warnings,
      });
    }

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
        orderBy,
        take: limit,
        skip: offset,
      }),
    ]);

    const [programById, userById] = await Promise.all([
      this.programsById(rows.map((row) => row.programId)),
      this.usersById(rows.map((row) => row.userId)),
    ]);

    const chByProgramId = new Map<string, FunnelChCampaign>();
    for (const ch of contentHubLoad.campaigns) {
      if (ch.surveySourceProgramId && !chByProgramId.has(ch.surveySourceProgramId)) {
        chByProgramId.set(ch.surveySourceProgramId, ch);
      }
    }

    const items = rows.flatMap((row) => {
      const program = programById.get(row.programId);
      const user = userById.get(row.userId);
      if (!program || !user) return [];
      const ch = chByProgramId.get(row.programId) ?? null;
      const stageEnteredAt =
        stage === 'converted'
          ? row.postEventSurveyAcknowledgedAt
          : stage === 'attended'
            ? row.postEventAttendanceReviewedAt ?? row.reviewedAt
            : row.reviewedAt ?? row.updatedAt;

      return [
        {
          userId: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          npiNumber: user.npiNumber,
          programId: program.id,
          programTitle: program.title,
          campaignId: ch?.hubspotCampaignId ?? (ch ? String(ch.id) : null),
          campaignName: ch?.name ?? null,
          clientSponsor: ch?.clientSponsor ?? null,
          stageEnteredAt: stageEnteredAt
            ? stageEnteredAt.toISOString()
            : null,
        },
      ];
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

  /**
   * Named people for Aware / Engaged / Captured via HubSpot campaign contact IDs.
   * Counts remain sessions / LP views / form submissions; people use the closest
   * attribution cohort HubSpot exposes as contact IDs.
   */
  private async getHubSpotStagePeople(input: {
    stage: 'aware' | 'engaged' | 'captured';
    scope: ResolvedScope;
    hubspotCampaigns: HubSpotCampaignListItem[];
    contentHubCampaigns: FunnelChCampaign[];
    reportingPeriodStart: string;
    reportingPeriodEnd: string;
    limit: number;
    offset: number;
    warnings: string[];
  }): Promise<CampaignsFunnelPeopleResponse> {
    const {
      stage,
      scope,
      hubspotCampaigns,
      contentHubCampaigns,
      reportingPeriodStart,
      reportingPeriodEnd,
      limit,
      offset,
    } = input;
    const warnings = [...input.warnings, HUBSPOT_STAGE_PEOPLE_BASIS[stage]];

    if (!this.hubspot.isConfigured()) {
      return {
        stage,
        peopleAvailable: true,
        items: [],
        total: 0,
        limit,
        offset,
        warnings: [
          ...warnings,
          'HubSpot is not connected; Aware/Engaged/Captured people lists are empty.',
        ],
      };
    }

    let campaignIds = scope.hubspotCampaignIds;
    if (campaignIds.length > MAX_HUBSPOT_CAMPAIGNS_TO_AGGREGATE) {
      warnings.push(
        `HubSpot people list capped to first ${MAX_HUBSPOT_CAMPAIGNS_TO_AGGREGATE} campaigns in scope.`,
      );
      campaignIds = campaignIds.slice(0, MAX_HUBSPOT_CAMPAIGNS_TO_AGGREGATE);
    }

    if (campaignIds.length === 0) {
      return {
        stage,
        peopleAvailable: true,
        items: [],
        total: 0,
        limit,
        offset,
        warnings: [
          ...warnings,
          'No HubSpot campaigns in scope for this filter; people list is empty.',
        ],
      };
    }

    const contactType = HUBSPOT_STAGE_CONTACT_TYPE[stage];
    const campaignNameById = new Map<string, string>();
    for (const c of hubspotCampaigns) {
      if (c.id) campaignNameById.set(c.id, c.name || `Campaign ${c.id.slice(0, 8)}`);
    }
    const chByHubspotId = new Map<string, FunnelChCampaign>();
    for (const ch of contentHubCampaigns) {
      if (ch.hubspotCampaignId) chByHubspotId.set(ch.hubspotCampaignId, ch);
    }

    const contactToCampaign = new Map<string, string>();
    for (const campaignId of campaignIds) {
      if (contactToCampaign.size >= MAX_HUBSPOT_CONTACTS_FOR_PEOPLE) break;
      const remaining = MAX_HUBSPOT_CONTACTS_FOR_PEOPLE - contactToCampaign.size;
      const listed = await this.hubspot.listCampaignContactIds(
        campaignId,
        contactType,
        {
          startDate: reportingPeriodStart,
          endDate: reportingPeriodEnd,
          maxItems: remaining,
        },
      );
      warnings.push(...listed.warnings);
      for (const id of listed.ids) {
        if (!contactToCampaign.has(id)) {
          contactToCampaign.set(id, campaignId);
        }
      }
    }

    if (contactToCampaign.size >= MAX_HUBSPOT_CONTACTS_FOR_PEOPLE) {
      warnings.push(
        `HubSpot people list capped at ${MAX_HUBSPOT_CONTACTS_FOR_PEOPLE} contacts.`,
      );
    }

    const contactIds = [...contactToCampaign.keys()];
    const contacts = await this.hubspot.batchReadContacts(contactIds);
    const contactById = new Map(contacts.map((c) => [c.id, c]));

    const emails = contacts
      .map((c) => c.email)
      .filter((e): e is string => !!e);
    const npis = contacts
      .map((c) => (c.npiNumber || '').replace(/\D/g, ''))
      .filter((n) => n.length === 10);

    const chtUsers =
      emails.length || npis.length
        ? await this.prisma.user.findMany({
            where: {
              OR: [
                ...(emails.length
                  ? [{ email: { in: emails, mode: 'insensitive' as const } }]
                  : []),
                ...(npis.length ? [{ npiNumber: { in: npis } }] : []),
              ],
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              npiNumber: true,
            },
          })
        : [];

    const userByEmail = new Map(
      chtUsers
        .filter((u) => u.email)
        .map((u) => [u.email!.trim().toLowerCase(), u]),
    );
    const userByNpi = new Map(
      chtUsers
        .filter((u) => (u.npiNumber || '').replace(/\D/g, '').length === 10)
        .map((u) => [(u.npiNumber || '').replace(/\D/g, ''), u]),
    );

    const allItems: FunnelPersonRow[] = contactIds.map((contactId) => {
      const campaignId = contactToCampaign.get(contactId) ?? null;
      const contact = contactById.get(contactId);
      const email = contact?.email ?? null;
      const npi = contact?.npiNumber?.replace(/\D/g, '') || null;
      const cht =
        (email ? userByEmail.get(email) : undefined) ??
        (npi && npi.length === 10 ? userByNpi.get(npi) : undefined) ??
        null;
      const ch = campaignId ? chByHubspotId.get(campaignId) : undefined;

      return {
        userId: cht?.id ?? null,
        firstName: cht?.firstName ?? contact?.firstName ?? null,
        lastName: cht?.lastName ?? contact?.lastName ?? null,
        email: cht?.email ?? email,
        npiNumber: cht?.npiNumber ?? contact?.npiNumber ?? null,
        programId: ch?.surveySourceProgramId ?? null,
        programTitle: null,
        campaignId,
        campaignName:
          ch?.name ??
          (campaignId ? campaignNameById.get(campaignId) ?? null : null),
        clientSponsor: ch?.clientSponsor ?? null,
        stageEnteredAt: null,
      };
    });

    // Prefer rows with names/emails first for paging quality.
    allItems.sort((a, b) => {
      const aKey = `${a.lastName ?? ''}${a.firstName ?? ''}${a.email ?? ''}`;
      const bKey = `${b.lastName ?? ''}${b.firstName ?? ''}${b.email ?? ''}`;
      return aKey.localeCompare(bKey);
    });

    const total = allItems.length;
    const items = allItems.slice(offset, offset + limit);

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
    const registrationRows = await this.prisma.programRegistration.findMany({
      where: { userId: id },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    const programById = await this.programsById(
      registrationRows.map((row) => row.programId),
    );
    const registrations = registrationRows.flatMap((row) => {
      const program = programById.get(row.programId);
      if (!program) return [];
      return [{ ...row, program }];
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

  private async programsById(
    programIds: string[],
  ): Promise<Map<string, { id: string; title: string }>> {
    const unique = [...new Set(programIds.filter((id) => id.trim()))];
    if (unique.length === 0) return new Map();
    const programs = await this.prisma.program.findMany({
      where: { id: { in: unique } },
      select: { id: true, title: true },
    });
    return new Map(programs.map((program) => [program.id, program]));
  }

  private async usersById(
    userIds: string[],
  ): Promise<
    Map<
      string,
      {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        npiNumber: string | null;
      }
    >
  > {
    const unique = [...new Set(userIds.filter((id) => id.trim()))];
    if (unique.length === 0) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        npiNumber: true,
      },
    });
    return new Map(users.map((user) => [user.id, user]));
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
        // No CH program link → don't attribute all CHT programs to this campaign
        programIds: hasProgramFilter ? [programId] : [],
        contentHubCampaignsInScope: [],
        warnings: [
          hasProgramFilter
            ? 'Campaign is HubSpot-only (not linked in Content Hub); CHT stages use the selected program filter only.'
            : 'Campaign is HubSpot-only (not linked in Content Hub); CHT Registered/Attended/Converted are zero until a Content Hub program link exists (or set a program filter).',
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
    } else {
      // Unfiltered: all CHT programs (ticket: still works when Content Hub is empty).
      // HubSpot stages may cover a capped campaign set — warn for comparable reading.
      if (hubspotUniverse.hubspotCampaignIds.length > 0) {
        warnings.push(
          'Unfiltered view: HubSpot stages aggregate listed campaigns (soft-capped); CHT stages include all programs in the date range. Filter by campaign, client, or program for attributable HubSpot↔CHT comparison.',
        );
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
  }): Promise<{
    metrics: CampaignMetricTotals;
    byCampaignId: Map<string, CampaignMetricTotals>;
    warnings: string[];
  }> {
    const warnings: string[] = [];
    const byCampaignId = new Map<string, CampaignMetricTotals>();
    let ids = input.hubspotCampaignIds;
    if (ids.length > MAX_HUBSPOT_CAMPAIGNS_TO_AGGREGATE) {
      warnings.push(
        `Aggregating HubSpot metrics for the first ${MAX_HUBSPOT_CAMPAIGNS_TO_AGGREGATE} of ${ids.length} campaigns.`,
      );
      ids = ids.slice(0, MAX_HUBSPOT_CAMPAIGNS_TO_AGGREGATE);
    }

    if (!ids.length) {
      return {
        metrics: { ...EMPTY_CAMPAIGN_METRIC_TOTALS },
        byCampaignId,
        warnings,
      };
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
        let metrics: CampaignMetricTotals = {
          ...EMPTY_CAMPAIGN_METRIC_TOTALS,
        };
        let liveAttempted = false;
        let liveSucceeded = false;

        if (input.hubspotConnected && input.marketingScopesGranted) {
          liveAttempted = true;
          try {
            const snapshot = await this.hubspot.getCampaignAnalytics(
              {
                hubspotCampaignId,
                reportingPeriodStart: input.reportingPeriodStart,
                reportingPeriodEnd: input.reportingPeriodEnd,
              },
              { includeEmailStatistics: false },
            );
            metrics = mergeMetricTotals(
              accumulateMetricsFromUnknown(snapshot.metrics),
              accumulateMetricsFromUnknown(snapshot.campaign),
              accumulateMetricsFromUnknown(snapshot.assets),
            );
            liveSucceeded = true;
          } catch (err) {
            this.logger.debug(
              `Funnel live metrics failed for ${hubspotCampaignId}: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          }
        }

        // Use Content Hub cache only when live metrics were unavailable
        // (missing scopes / live fetch failed) — never overwrite a legitimate period zero.
        const useCache =
          (liveAttempted && !liveSucceeded) ||
          (!liveAttempted && !input.marketingScopesGranted);
        let usedCache = false;
        if (useCache) {
          const cached = cacheByHubspotId.get(hubspotCampaignId);
          if (cached?.hubspotRawData) {
            metrics = metricsFromHubspotSnapshot(cached.hubspotRawData).metrics;
            usedCache = true;
          }
        }

        return { hubspotCampaignId, metrics, usedCache };
      },
    );

    for (const row of perCampaign) {
      byCampaignId.set(row.hubspotCampaignId, row.metrics);
    }

    if (perCampaign.some((r) => r.usedCache)) {
      warnings.push(
        'Aware/Engaged/Captured include Content Hub cached HubSpot snapshots where live metrics were unavailable (not used for period zeros).',
      );
    }

    return {
      metrics: mergeMetricTotals(...perCampaign.map((r) => r.metrics)),
      byCampaignId,
      warnings,
    };
  }

  /** Warn when prod-ready Content Hub links are incomplete. */
  private buildProductionLinkWarnings(
    contentHubCampaigns: FunnelChCampaign[],
    scope: ResolvedScope,
    hubspotListedCount: number,
  ): string[] {
    const warnings: string[] = [];

    if (hubspotListedCount >= HUBSPOT_LIST_PAGE_SIZE) {
      warnings.push(
        `HubSpot campaign list is capped at ${HUBSPOT_LIST_PAGE_SIZE}; additional campaigns are not included until you filter.`,
      );
    }

    if (
      !scope.warnings.some((w) => /Aggregating HubSpot metrics/i.test(w)) &&
      scope.hubspotCampaignIds.length > MAX_HUBSPOT_CAMPAIGNS_TO_AGGREGATE
    ) {
      // aggregateHubSpot already warns when truncating
    }

    if (!contentHubCampaigns.length) {
      return warnings;
    }

    const missingSponsor = contentHubCampaigns.filter(
      (c) => !c.clientSponsor?.trim(),
    ).length;
    const missingHs = contentHubCampaigns.filter(
      (c) => !c.hubspotCampaignId?.trim(),
    ).length;
    const missingProgram = contentHubCampaigns.filter(
      (c) => !c.surveySourceProgramId?.trim(),
    ).length;

    if (missingSponsor || missingHs || missingProgram) {
      warnings.push(
        `Content Hub link gaps: ${missingSponsor} missing clientSponsor, ${missingHs} missing hubspotCampaignId, ${missingProgram} missing surveySourceProgramId. Client filter, campaign→CHT attribution, and rollup need all three for each campaign.`,
      );
    }

    return warnings;
  }

  /**
   * Group funnel activity by Content Hub clientSponsor.
   * HubSpot-only (unlinked) campaigns become a single "Not linked" row.
   */
  private async buildClientRollup(input: {
    query: CampaignsFunnelQuery;
    hubspotCampaigns: HubSpotCampaignListItem[];
    contentHubCampaigns: FunnelChCampaign[];
    metricsByCampaignId: Map<string, CampaignMetricTotals>;
    reportingPeriodStart: string;
    reportingPeriodEnd: string;
    scopedHubspotIds: Set<string>;
  }): Promise<FunnelClientRollupRow[]> {
    const clientFilter = input.query.clientSponsor?.trim().toLowerCase() || '';
    const campaignFilter = input.query.campaignId?.trim() || '';
    const programFilter = input.query.programId?.trim() || '';

    let chRows = [...input.contentHubCampaigns];
    if (clientFilter) {
      chRows = chRows.filter(
        (c) => (c.clientSponsor ?? '').toLowerCase() === clientFilter,
      );
    }
    if (campaignFilter) {
      const asNumber = Number(campaignFilter);
      chRows = chRows.filter(
        (c) =>
          c.hubspotCampaignId === campaignFilter ||
          (Number.isFinite(asNumber) && c.id === asNumber),
      );
    }
    if (programFilter) {
      chRows = chRows.filter((c) => c.surveySourceProgramId === programFilter);
    }

    type SponsorBucket = {
      clientSponsor: string | null;
      linked: boolean;
      hubspotIds: Set<string>;
      programIds: Set<string>;
      campaignKeys: Set<string>;
    };

    const buckets = new Map<string, SponsorBucket>();

    const ensureBucket = (
      key: string,
      clientSponsor: string | null,
      linked: boolean,
    ): SponsorBucket => {
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          clientSponsor,
          linked,
          hubspotIds: new Set(),
          programIds: new Set(),
          campaignKeys: new Set(),
        };
        buckets.set(key, bucket);
      }
      return bucket;
    };

    for (const ch of chRows) {
      const sponsor = ch.clientSponsor?.trim() || null;
      const key = sponsor
        ? `linked:${sponsor.toLowerCase()}`
        : `linked:unnamed:${ch.id}`;
      const bucket = ensureBucket(key, sponsor, true);
      bucket.campaignKeys.add(ch.hubspotCampaignId ?? `ch:${ch.id}`);
      if (ch.hubspotCampaignId) bucket.hubspotIds.add(ch.hubspotCampaignId);
      if (ch.surveySourceProgramId) {
        bucket.programIds.add(ch.surveySourceProgramId);
      }
    }

    const linkedHubspotIds = new Set(
      input.contentHubCampaigns
        .map((c) => c.hubspotCampaignId)
        .filter((id): id is string => !!id),
    );

    // Unlinked HubSpot campaigns (still in overall funnel when not filtered away)
    const unlinkedIds = input.hubspotCampaigns
      .map((c) => c.id)
      .filter((id) => {
        if (linkedHubspotIds.has(id)) return false;
        if (input.scopedHubspotIds.size && !input.scopedHubspotIds.has(id)) {
          return false;
        }
        if (campaignFilter && id !== campaignFilter) return false;
        // Client/program filters imply CH linkage — skip unlinked row
        if (clientFilter || programFilter) return false;
        return true;
      });

    if (unlinkedIds.length) {
      const bucket = ensureBucket('unlinked', null, false);
      for (const id of unlinkedIds) {
        bucket.hubspotIds.add(id);
        bucket.campaignKeys.add(id);
      }
    }

    const rows: FunnelClientRollupRow[] = [];
    const bucketList = [...buckets.values()].slice(0, 40);

    for (const bucket of bucketList) {
      const counts = emptyCountsByStage();
      const metricList = [...bucket.hubspotIds].map(
        (id) =>
          input.metricsByCampaignId.get(id) ?? {
            ...EMPTY_CAMPAIGN_METRIC_TOTALS,
          },
      );
      const merged = mergeMetricTotals(...metricList);
      counts.aware = merged.sessions;
      counts.engaged = merged.landingPageViews;
      counts.captured = merged.formSubmissions;

      const programIds = programFilter
        ? [programFilter]
        : bucket.linked
          ? [...bucket.programIds]
          : [];

      const cht = await this.countChtStages({
        programIds: bucket.linked
          ? programIds.length
            ? programIds
            : []
          : programFilter
            ? [programFilter]
            : [],
        reportingPeriodStart: input.reportingPeriodStart,
        reportingPeriodEnd: input.reportingPeriodEnd,
      });
      counts.registered = cht.registered;
      counts.attended = cht.attended;
      counts.converted = cht.converted;

      rows.push({
        clientSponsor: bucket.linked
          ? bucket.clientSponsor
          : null,
        linked: bucket.linked,
        campaignCount: bucket.campaignKeys.size,
        countsByStage: counts,
      });
    }

    rows.sort((a, b) => {
      if (a.linked !== b.linked) return a.linked ? -1 : 1;
      const aName = (a.clientSponsor ?? '').toLowerCase();
      const bName = (b.clientSponsor ?? '').toLowerCase();
      return aName.localeCompare(bName);
    });

    return rows;
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
      // Skip orphaned FKs. Testapp has ProgramRegistration rows whose Program
      // was deleted; a required include then 500s ("program ... got null").
      user: { is: {} },
      program: { is: {} },
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
      take: 500,
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
