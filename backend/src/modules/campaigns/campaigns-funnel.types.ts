/** Chunk 0 locked stage keys for the admin sales funnel. */
export const FUNNEL_STAGE_KEYS = [
  'aware',
  'engaged',
  'captured',
  'registered',
  'attended',
  'converted',
] as const;

export type FunnelStageKey = (typeof FUNNEL_STAGE_KEYS)[number];

export function isFunnelStageKey(value: string): value is FunnelStageKey {
  return (FUNNEL_STAGE_KEYS as readonly string[]).includes(value);
}

/** HubSpot stages are aggregate-only in V1 (Chunk 0). */
export const FUNNEL_STAGE_PEOPLE_AVAILABLE: Record<FunnelStageKey, boolean> = {
  aware: false,
  engaged: false,
  captured: false,
  registered: true,
  attended: true,
  converted: true,
};

export const FUNNEL_STAGE_LABELS: Record<FunnelStageKey, string> = {
  aware: 'Aware',
  engaged: 'Engaged',
  captured: 'Captured',
  registered: 'Registered',
  attended: 'Attended',
  converted: 'Converted',
};

export const FUNNEL_STAGE_SOURCES: Record<FunnelStageKey, string> = {
  aware: 'HubSpot sessions',
  engaged: 'HubSpot landingPageViews',
  captured: 'HubSpot formSubmissions',
  registered: 'CHT ProgramRegistration APPROVED',
  attended: 'CHT attendance VERIFIED',
  converted: 'CHT VERIFIED + post-event survey completed',
};

export type CampaignsFunnelQuery = {
  startDate?: string;
  endDate?: string;
  /** HubSpot and/or Content Hub campaign id (resolved in Chunk 2). */
  campaignId?: string;
  clientSponsor?: string;
  programId?: string;
};

export type CampaignsFunnelPeopleQuery = CampaignsFunnelQuery & {
  stage: FunnelStageKey;
  limit?: number;
  offset?: number;
};

export type FunnelStageSummary = {
  key: FunnelStageKey;
  label: string;
  count: number;
  /**
   * Drop-off % vs previous stage (0–100).
   * null for Aware or when previous count is 0; 0 when current >= previous (no drop).
   */
  dropOffFromPreviousPct: number | null;
  source: string;
  peopleAvailable: boolean;
};

export type FunnelClientRollupRow = {
  clientSponsor: string | null;
  linked: boolean;
  campaignCount: number;
  countsByStage: Record<FunnelStageKey, number>;
};

export type FunnelFilterOptions = {
  campaigns: Array<{ id: string; name: string }>;
  clients: string[];
  programs: Array<{ id: string; title: string }>;
};

export type CampaignsFunnelResponse = {
  syncedAt: string;
  reportingPeriodStart: string | null;
  reportingPeriodEnd: string | null;
  stages: FunnelStageSummary[];
  clientRollup: FunnelClientRollupRow[];
  filters: FunnelFilterOptions;
  warnings: string[];
  hubspot: {
    connected: boolean;
    marketingScopesGranted: boolean;
    missingScopes: string[];
  };
  contentHub: {
    configured: boolean;
    reachable: boolean;
  };
};

export type FunnelPersonRow = {
  userId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  npiNumber: string | null;
  programId: string | null;
  programTitle: string | null;
  campaignId: string | null;
  campaignName: string | null;
  clientSponsor: string | null;
  stageEnteredAt: string | null;
};

export type CampaignsFunnelPeopleResponse = {
  stage: FunnelStageKey;
  peopleAvailable: boolean;
  items: FunnelPersonRow[];
  total: number;
  limit: number;
  offset: number;
  warnings: string[];
};

export type CampaignsFunnelHcpResponse = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  npiNumber: string | null;
  match: {
    matched: boolean;
    method: 'email' | 'npi' | null;
  };
  lastCampaign: {
    id: string | null;
    name: string | null;
    clientSponsor: string | null;
  } | null;
  lastChtActivity: Array<{
    type: 'register' | 'attend' | 'survey';
    at: string | null;
    programId: string | null;
    programTitle: string | null;
  }>;
  warnings: string[];
};
