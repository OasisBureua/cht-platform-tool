// Content Hub data layer: localStorage for campaigns/reports (dev UI).
// Integration health: GET /api/admin/content-hub/health (CHT probes Hub + HubSpot).
// TODO(content-hub): swap campaign CRUD to NestJS proxy when Hub admin API is live.

import {
  buildAnalyticsReport,
  buildDataValidation,
  buildExecutiveReport,
} from './reports';
import apiClient from '../../../../api/client';
import type {
  AnalyticsReport,
  Campaign,
  ContentHubHealth,
  CsvUpload,
  DataValidation,
  ExecutiveReport,
  HubspotStatus,
  IntegrationsConnectionMap,
  IntegrationSettings,
  Platform,
  StoredCsvUpload,
  Template,
} from './types';

const STORAGE_KEY = 'chm-content-hub-db';

interface DbShape {
  campaigns: Campaign[];
  templates: Template[];
  csvUploads: StoredCsvUpload[];
  integrations: IntegrationSettings;
  nextCampaignId: number;
  nextTemplateId: number;
  nextUploadId: number;
}

// Seeded from the standalone app's docs/research/api-campaigns.json (inlined verbatim).
const SEED_CAMPAIGNS: Campaign[] = [
  { id: 1, name: 'morgan', programName: '', clientSponsor: '', diseaseState: '', treatmentTopic: '', reportingPeriodStart: '', reportingPeriodEnd: '', platforms: [], targetAudience: '', targetRegions: '', targetInstitutions: '', physicianSpeakers: '', landingPageUrl: '', hubspotCampaignId: '', eventDate: '', livestreamUrl: '', hubspotSyncedAt: null, hubspotRawData: null, executiveReportData: null, reportType: 'executive', status: 'draft', createdBy: '', tags: [], templateId: null, createdAt: '2026-06-23T07:22:58.168Z', updatedAt: '2026-06-23T07:22:58.168Z' },
  { id: 2, name: 'dgfwewe', programName: '', clientSponsor: '', diseaseState: '', treatmentTopic: '', reportingPeriodStart: '', reportingPeriodEnd: '', platforms: [], targetAudience: '', targetRegions: '', targetInstitutions: '', physicianSpeakers: '', landingPageUrl: '', hubspotCampaignId: '', eventDate: '', livestreamUrl: '', hubspotSyncedAt: null, hubspotRawData: null, executiveReportData: null, reportType: 'executive', status: 'draft', createdBy: '', tags: [], templateId: null, createdAt: '2026-06-23T14:09:42.770Z', updatedAt: '2026-06-23T14:09:42.770Z' },
  { id: 3, name: 'Q2 DS1/D1 Report', programName: 'Tamarind', clientSponsor: 'AstraZeneca', diseaseState: 'Breast Cancer', treatmentTopic: 'Early Stage', reportingPeriodStart: '2026-06-01', reportingPeriodEnd: '2026-06-25', platforms: ['linkedin', 'meta', 'youtube'], targetAudience: 'Oncologist, PCP', targetRegions: 'Midwest', targetInstitutions: 'Community Oncology', physicianSpeakers: 'Iyengar, Jhaveri, Makhlin', landingPageUrl: '', hubspotCampaignId: '', eventDate: '', livestreamUrl: '', hubspotSyncedAt: null, hubspotRawData: null, executiveReportData: null, reportType: 'executive', status: 'draft', createdBy: 'Dave Gill', tags: [], templateId: null, createdAt: '2026-06-25T14:26:04.485Z', updatedAt: '2026-06-25T14:26:04.485Z' },
  { id: 4, name: 'Q3 Oncology', programName: 'Onco Precision', clientSponsor: 'ABC Pharma', diseaseState: 'Early Stage Breast Cancer', treatmentTopic: 'First line immuno', reportingPeriodStart: '0026-07-12', reportingPeriodEnd: '2026-08-01', platforms: ['linkedin', 'meta', 'youtube'], targetAudience: 'PCPs', targetRegions: 'Midwest', targetInstitutions: 'Academic', physicianSpeakers: 'Dr. Rizwari', landingPageUrl: '', hubspotCampaignId: '', eventDate: '', livestreamUrl: '', hubspotSyncedAt: null, hubspotRawData: null, executiveReportData: null, reportType: 'executive', status: 'draft', createdBy: 'Dave Gill', tags: [], templateId: null, createdAt: '2026-06-25T19:03:51.246Z', updatedAt: '2026-06-25T19:03:51.246Z' },
];

const SEED_INTEGRATIONS: IntegrationSettings = {
  hubspot: { token: '', enabled: false, accountName: '' },
  linkedin: { enabled: false, note: 'Upload CSV exports from LinkedIn Campaign Manager.' },
  meta: { enabled: false, note: 'Upload CSV exports from Meta Ads Manager.' },
  youtube: { enabled: false, note: 'Upload CSV exports from YouTube Studio analytics.' },
  livestream: { enabled: false, note: 'Upload attendance/engagement CSV from your livestream platform.' },
  survey: { enabled: true, note: 'Select native CHT post-event feedback responses by program.' },
};

function seed(): DbShape {
  return {
    campaigns: structuredClone(SEED_CAMPAIGNS),
    templates: [],
    csvUploads: [],
    integrations: structuredClone(SEED_INTEGRATIONS),
    nextCampaignId: 5,
    nextTemplateId: 1,
    nextUploadId: 1,
  };
}

function load(): DbShape {
  if (typeof window === 'undefined') return seed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fresh = seed();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    }
    return { ...seed(), ...(JSON.parse(raw) as Partial<DbShape>) } as DbShape;
  } catch {
    return seed();
  }
}

function save(db: DbShape): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

const now = () => new Date().toISOString();

function emptyCampaign(): Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: '', programName: '', clientSponsor: '', diseaseState: '', treatmentTopic: '',
    reportingPeriodStart: '', reportingPeriodEnd: '', platforms: [], targetAudience: '',
    targetRegions: '', targetInstitutions: '', physicianSpeakers: '', landingPageUrl: '',
    hubspotCampaignId: '', eventDate: '', livestreamUrl: '', hubspotSyncedAt: null,
    hubspotRawData: null, executiveReportData: null, reportType: 'executive', status: 'draft',
    createdBy: '', tags: [], templateId: null,
  };
}

function hubspotConnected(db: DbShape): boolean {
  return Boolean(db.integrations.hubspot?.token || db.integrations.hubspot?.enabled);
}

function uploadsFor(db: DbShape, campaignId: number): StoredCsvUpload[] {
  return db.csvUploads.filter((u) => u.campaignId === campaignId);
}

// ---------- Campaigns ----------
export function listCampaigns(): Campaign[] {
  return load().campaigns;
}

export function getCampaign(id: number): Campaign {
  const c = load().campaigns.find((x) => x.id === id);
  if (!c) throw new Error('Campaign not found');
  return c;
}

export function createCampaign(body: Partial<Campaign>): Campaign {
  const db = load();
  const campaign: Campaign = {
    ...emptyCampaign(),
    ...body,
    id: db.nextCampaignId++,
    createdAt: now(),
    updatedAt: now(),
  } as Campaign;
  db.campaigns.push(campaign);
  save(db);
  return campaign;
}

export function updateCampaign(id: number, body: Partial<Campaign>): Campaign {
  const db = load();
  const campaign = db.campaigns.find((c) => c.id === id);
  if (!campaign) throw new Error('Campaign not found');
  Object.assign(campaign, body, { id: campaign.id, updatedAt: now() });
  save(db);
  return campaign;
}

export function deleteCampaign(id: number): void {
  const db = load();
  db.campaigns = db.campaigns.filter((c) => c.id !== id);
  db.csvUploads = db.csvUploads.filter((u) => u.campaignId !== id);
  save(db);
}

// ---------- Campaign data ----------
export function uploadCsv(id: number, platform: Platform, filename: string, content: string): CsvUpload {
  const db = load();
  const campaign = db.campaigns.find((c) => c.id === id);
  if (!campaign) throw new Error('Campaign not found');

  // Parse CSV: first row = headers (mirrors the original server implementation).
  const lines = String(content).trim().split(/\r?\n/);
  const headers = (lines[0] ?? '').split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ''));
    return row;
  });

  db.csvUploads = db.csvUploads.filter((u) => !(u.campaignId === id && u.platform === platform));
  const upload: StoredCsvUpload = {
    id: db.nextUploadId++,
    campaignId: id,
    platform,
    filename: filename || 'upload.csv',
    rows,
    uploadedAt: now(),
  };
  db.csvUploads.push(upload);
  campaign.updatedAt = now();
  save(db);
  return { id: upload.id, campaignId: id, platform, filename: upload.filename, rowCount: rows.length, uploadedAt: upload.uploadedAt };
}

export function connectFeedbackSurvey(
  id: number,
  input: {
    surveyId: string;
    programId: string | null;
    label: string;
    totalResponses: number;
    analytics: unknown;
  },
): CsvUpload {
  const db = load();
  const campaign = db.campaigns.find((item) => item.id === id);
  if (!campaign) throw new Error('Campaign not found');

  db.csvUploads = db.csvUploads.filter(
    (upload) => !(upload.campaignId === id && upload.platform === 'survey'),
  );
  const uploadedAt = now();
  const upload: StoredCsvUpload = {
    id: db.nextUploadId++,
    campaignId: id,
    platform: 'survey',
    filename: input.label,
    // Reports currently use row count for the survey KPI. Detailed, PII-safe
    // aggregates are retained in metadata for report sections to consume.
    rows: Array.from({ length: input.totalResponses }, (_, index) => ({
      response: String(index + 1),
    })),
    uploadedAt,
    metadata: {
      source: 'cht-feedback-survey',
      surveyId: input.surveyId,
      programId: input.programId,
      analytics: input.analytics,
    },
  };
  db.csvUploads.push(upload);
  campaign.surveySourceId = input.surveyId;
  campaign.surveySourceProgramId = input.programId;
  campaign.surveySourceLabel = input.label;
  if (!campaign.platforms.includes('survey')) {
    campaign.platforms = [...campaign.platforms, 'survey'];
  }
  campaign.updatedAt = uploadedAt;
  save(db);

  return {
    id: upload.id,
    campaignId: id,
    platform: 'survey',
    filename: upload.filename,
    rowCount: upload.rows.length,
    uploadedAt,
  };
}

export function getCsvData(id: number): CsvUpload[] {
  return uploadsFor(load(), id).map((u) => ({
    id: u.id,
    campaignId: u.campaignId,
    platform: u.platform,
    filename: u.filename,
    rowCount: u.rows?.length ?? 0,
    uploadedAt: u.uploadedAt,
  }));
}

export function getDataValidation(id: number): DataValidation {
  const db = load();
  const campaign = getCampaign(id);
  return buildDataValidation(campaign, uploadsFor(db, id), hubspotConnected(db));
}

export function hubspotSync(id: number): { synced: boolean; syncedAt: string } {
  const db = load();
  const campaign = db.campaigns.find((c) => c.id === id);
  if (!campaign) throw new Error('Campaign not found');
  if (!hubspotConnected(db)) {
    throw new Error('No HubSpot access token configured. Add HUBSPOT_ACCESS_TOKEN to your environment secrets.');
  }
  campaign.hubspotSyncedAt = now();
  save(db);
  return { synced: true, syncedAt: campaign.hubspotSyncedAt };
}

export function generateAiInsights(id: number): { insights: string } {
  const db = load();
  const campaign = db.campaigns.find((c) => c.id === id);
  if (!campaign) throw new Error('Campaign not found');
  const uploads = uploadsFor(db, id);
  if (uploads.length === 0 && !hubspotConnected(db)) {
    throw new Error('No data available to generate insights. Upload platform CSVs or connect HubSpot first.');
  }
  campaign.aiInsights = `Across the reporting period, ${campaign.name} shows meaningful engagement signals in the uploaded platform data. Focus follow-up analysis on the highest-CTR segments and replicate top-performing creative pairings in the next flight.`;
  campaign.updatedAt = now();
  save(db);
  return { insights: campaign.aiInsights };
}

// ---------- Reports ----------
export function getAnalyticsReport(id: number): AnalyticsReport {
  const db = load();
  const campaign = getCampaign(id);
  return buildAnalyticsReport(campaign, uploadsFor(db, id), hubspotConnected(db));
}

export function getExecutiveReport(id: number): ExecutiveReport {
  const db = load();
  const campaign = getCampaign(id);
  return buildExecutiveReport(campaign, uploadsFor(db, id));
}

// ---------- Templates ----------
export function listTemplates(): Template[] {
  return load().templates;
}

export function createTemplate(body: { name: string; type: string; description: string }): Template {
  const db = load();
  const template: Template = {
    id: db.nextTemplateId++,
    name: '',
    type: 'Analytics Report',
    description: '',
    ...body,
    createdAt: now(),
    updatedAt: now(),
  };
  db.templates.push(template);
  save(db);
  return template;
}

export function deleteTemplate(id: number): void {
  const db = load();
  db.templates = db.templates.filter((t) => t.id !== id);
  save(db);
}

// ---------- Integrations ----------
export function getIntegrations(): IntegrationSettings {
  const out = structuredClone(load().integrations);
  if (out.hubspot?.token) out.hubspot.token = '••••••••' + String(out.hubspot.token).slice(-4);
  return out;
}

export function updateIntegrations(patch: Partial<Record<keyof IntegrationSettings, unknown>>): { saved: true } {
  const db = load();
  for (const [key, value] of Object.entries(patch)) {
    const k = key as keyof IntegrationSettings;
    if (db.integrations[k]) Object.assign(db.integrations[k], value);
  }
  save(db);
  return { saved: true };
}

export function getHubspotStatus(): HubspotStatus {
  const db = load();
  if (!hubspotConnected(db)) {
    return {
      connected: false,
      accountName: null,
      portalId: null,
      error: 'No HubSpot access token configured. Add HUBSPOT_ACCESS_TOKEN to your environment secrets.',
    };
  }
  return { connected: true, accountName: db.integrations.hubspot.accountName || 'HubSpot Account', portalId: null };
}

/** Content Hub dependency health: reachability only (not integration credentials). */
export async function getContentHubHealth(): Promise<ContentHubHealth> {
  try {
    const { data } = await apiClient.get<ContentHubHealth>('/admin/content-hub/health');
    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Health check failed';
    return {
      status: 'error',
      contentHub: { configured: false, reachable: false, error: message },
    };
  }
}

/** Live integration connection status from CHT (HubSpot, Zoom, surveys + Hub platforms). */
export async function getIntegrationsConnection(): Promise<IntegrationsConnectionMap> {
  try {
    const { data } = await apiClient.get<IntegrationsConnectionMap>(
      '/admin/content-hub/integrations',
    );
    return data ?? {};
  } catch {
    return {};
  }
}
