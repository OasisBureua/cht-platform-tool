// Content Hub types — ported verbatim from the standalone report generator's src/types.ts.
export type Platform = 'linkedin' | 'meta' | 'youtube' | 'livestream' | 'survey';

export type CampaignStatus = 'draft' | 'data_needed' | 'ready_for_review' | 'final';

export type ReportType = 'analytics' | 'executive';

export interface Campaign {
  id: number;
  name: string;
  programName: string;
  clientSponsor: string;
  diseaseState: string;
  treatmentTopic: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  platforms: Platform[];
  targetAudience: string;
  targetRegions: string;
  targetInstitutions: string;
  physicianSpeakers: string;
  landingPageUrl: string;
  hubspotCampaignId: string;
  eventDate: string;
  livestreamUrl: string;
  hubspotSyncedAt: string | null;
  hubspotRawData: unknown | null;
  executiveReportData: Record<string, unknown> | null;
  reportType: ReportType;
  status: CampaignStatus;
  createdBy: string;
  tags: string[];
  templateId: number | null;
  createdAt: string;
  updatedAt: string;
  aiInsights?: string | null;
}

export interface Template {
  id: number;
  name: string;
  type: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface HubspotStatus {
  connected: boolean;
  accountName: string | null;
  portalId: string | null;
  error?: string;
}

export type PlatformSnapshotStatus = 'missing' | 'syncing' | 'available' | 'error';

export interface PlatformSnapshot {
  platform: Platform;
  status: PlatformSnapshotStatus;
  syncedAt: string | null;
  fetchDate?: string | null;
  nextSyncAt?: string | null;
  rowCount?: number | null;
  filename?: string | null;
  error?: string | null;
}

export interface PlatformDataList {
  items: PlatformSnapshot[];
}

export interface ContentHubHealth {
  status: string;
  contentHub: {
    configured: boolean;
    reachable: boolean;
    error?: string;
  };
}

export interface IntegrationConnectionStatus {
  managedBy?: 'cht' | 'contenthub';
  connected: boolean;
  note?: string;
  error?: string;
  accountName?: string | null;
  portalId?: string | null;
  enabled?: boolean;
}

export type IntegrationsConnectionMap = Partial<
  Record<keyof IntegrationSettings, IntegrationConnectionStatus>
>;

export interface IntegrationSettings {
  hubspot: { token: string; enabled: boolean; accountName: string };
  linkedin: { enabled: boolean; note: string };
  meta: { enabled: boolean; note: string };
  youtube: { enabled: boolean; note: string };
  livestream: { enabled: boolean; note: string };
  survey: { enabled: boolean; note: string };
}

export interface DataSourceSummary {
  source: 'HubSpot' | 'LinkedIn' | 'Meta' | 'YouTube' | 'Livestream' | 'Survey';
  status: 'missing' | 'available';
  metricsAvailable: string[];
  metricsMissing: string[];
  lastUpdated: string | null;
}

export interface DataValidation {
  hubspotConnected: boolean;
  hubspotSyncedAt: string | null;
  dataSourcesSummary: DataSourceSummary[];
}

export interface CsvUpload {
  id: number;
  campaignId: number;
  platform: Platform;
  filename: string;
  rowCount: number;
  uploadedAt: string;
}

export interface KpiTile {
  label: string;
  value: string;
  source: string;
  note: string;
}

export interface GlossaryEntry {
  term: string;
  definition: string;
  platform: string;
}

export interface AnalyticsReportSections {
  executiveSummary: string;
  crossChannelSnapshot: { rows: Array<Record<string, string>> };
  kpiTiles: KpiTile[];
  hubspotOverview: unknown | null;
  landingPageAnalytics: { source: string; available: boolean; note: string };
  hcpEngagement: { source: string; available: boolean; note: string };
  funnelConversion: { available: boolean; note: string };
  emailPerformance: { available: boolean; note: string };
  linkedinData: unknown | null;
  metaData: unknown | null;
  youtubeData: unknown | null;
  livestreamData: unknown | null;
  surveyData: unknown | null;
  topContent: unknown[];
  keyHighlights: string[];
  recommendations: string[];
  dataGaps: string[];
  glossary: GlossaryEntry[];
  aiInsights?: string | null;
}

export interface AnalyticsReport {
  campaign: Campaign;
  generatedAt: string;
  hubspotData: unknown | null;
  csvData: unknown[];
  sections: AnalyticsReportSections;
  dataValidation: DataValidation;
}

export interface ExecutivePlatformBreakdown {
  platform: string;
  totalViews: number;
  totalImpressions: number;
  hasData: boolean;
}

export interface ExecutiveKeyLearning {
  title: string;
  body: string;
}

export interface ExecutiveReport {
  campaign: Campaign;
  metrics: {
    totalViews: number | null;
    totalImpressions: number | null;
    totalViewsFormatted: string | null;
    totalImpressionsFormatted: string | null;
    youtube: unknown | null;
    linkedin: unknown | null;
    meta: unknown | null;
    livestream: unknown | null;
    survey: unknown | null;
  };
  platformBreakdown: ExecutivePlatformBreakdown[];
  config: {
    overviewText: string;
    productionOverview: string;
    distributionOverview: string;
    conclusionText: string;
    targetingNarrative: string;
    contentThemes: string[];
    preRecordDate: string;
    liveStreamDate: string;
    distributionDate: string;
    longFormEpisodes: string;
    shortFormTopics: string;
    clipVariations: string;
    longFormPosts: string | null;
    shortFormPosts: string | null;
    clipPosts: string | null;
    keyLearnings: ExecutiveKeyLearning[];
  };
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  linkedin: 'LinkedIn',
  meta: 'Meta',
  youtube: 'YouTube',
  livestream: 'Livestream',
  survey: 'Survey',
};

export const PLATFORM_COLORS: Record<Platform, string> = {
  linkedin: '#0077B5',
  meta: '#7B5EA7',
  youtube: '#FF0000',
  livestream: '#3DA4C0',
  survey: '#2E7D32',
};

export const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Draft',
  data_needed: 'Data Needed',
  ready_for_review: 'Ready for Review',
  final: 'Final',
};

/** Raw upload record kept in the client store — includes parsed rows (the API surface hides rows). */
export interface StoredCsvUpload {
  id: number;
  campaignId: number;
  platform: Platform;
  filename: string;
  rows: Array<Record<string, string>>;
  uploadedAt: string;
}
