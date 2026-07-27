// Content Hub data layer: NestJS admin proxy → Content Hub.
// HubSpot status/sync stay on CHT; campaign CRUD and reports go through Hub.

import apiClient, { getApiErrorMessage } from '../../../../api/client';
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
  Template,
} from './types';

type CampaignListResponse = {
  items?: Campaign[];
  total?: number;
};

type TemplateListResponse = {
  items?: Template[];
  total?: number;
};

/** Hub rejects empty strings for date fields — send null instead. */
const CAMPAIGN_DATE_KEYS = [
  'reportingPeriodStart',
  'reportingPeriodEnd',
  'eventDate',
] as const;

function sanitizeCampaignBody(
  body: Partial<Campaign>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body };
  for (const key of CAMPAIGN_DATE_KEYS) {
    if (!(key in out)) continue;
    const value = out[key];
    if (value === '' || value === undefined) {
      out[key] = null;
    }
  }
  return out;
}

function asCampaign(data: unknown): Campaign {
  return data as Campaign;
}

function throwApiError(err: unknown, fallback: string): never {
  throw new Error(getApiErrorMessage(err, fallback));
}

// ---------- Campaigns ----------
export async function listCampaigns(): Promise<Campaign[]> {
  try {
    const { data } = await apiClient.get<CampaignListResponse | Campaign[]>(
      '/admin/content-hub/campaigns',
    );
    if (Array.isArray(data)) return data;
    return data?.items ?? [];
  } catch (err) {
    throwApiError(err, 'Failed to load campaigns.');
  }
}

export async function getCampaign(id: number): Promise<Campaign> {
  try {
    const { data } = await apiClient.get<Campaign>(
      `/admin/content-hub/campaigns/${id}`,
    );
    return asCampaign(data);
  } catch (err) {
    throwApiError(err, 'Campaign not found.');
  }
}

export async function createCampaign(
  body: Partial<Campaign>,
): Promise<Campaign> {
  try {
    const { data } = await apiClient.post<Campaign>(
      '/admin/content-hub/campaigns',
      sanitizeCampaignBody(body),
    );
    return asCampaign(data);
  } catch (err) {
    throwApiError(err, 'Failed to create campaign.');
  }
}

export async function updateCampaign(
  id: number,
  body: Partial<Campaign>,
): Promise<Campaign> {
  try {
    const { data } = await apiClient.patch<Campaign>(
      `/admin/content-hub/campaigns/${id}`,
      sanitizeCampaignBody(body),
    );
    return asCampaign(data);
  } catch (err) {
    throwApiError(err, 'Failed to update campaign.');
  }
}

export async function deleteCampaign(id: number): Promise<void> {
  try {
    await apiClient.delete(`/admin/content-hub/campaigns/${id}`);
  } catch (err) {
    throwApiError(err, 'Failed to delete campaign.');
  }
}

// ---------- Campaign data ----------
export async function uploadCsv(
  id: number,
  platform: Platform,
  filename: string,
  content: string,
): Promise<CsvUpload> {
  try {
    const { data } = await apiClient.post<CsvUpload>(
      `/admin/content-hub/campaigns/${id}/uploads`,
      {
        platform,
        filename: filename || 'upload.csv',
        content,
      },
    );
    return data;
  } catch (err) {
    throwApiError(err, 'Failed to upload CSV.');
  }
}

export async function connectFeedbackSurvey(
  id: number,
  input: {
    surveyId: string;
    programId: string | null;
    label: string;
    totalResponses: number;
    analytics: unknown;
  },
): Promise<CsvUpload> {
  // Persist survey attribution on the Hub campaign, then upload a lightweight
  // CSV so platform-data / validation can treat survey as available.
  await updateCampaign(id, {
    surveySourceId: input.surveyId,
    surveySourceProgramId: input.programId,
    surveySourceLabel: input.label,
  } as Partial<Campaign>);

  const header = 'response_index,survey_id,program_id,label';
  const rows = Array.from({ length: Math.max(input.totalResponses, 0) }, (_, i) =>
    [
      String(i + 1),
      JSON.stringify(input.surveyId),
      JSON.stringify(input.programId ?? ''),
      JSON.stringify(input.label),
    ].join(','),
  );
  const content = [header, ...rows].join('\n');

  return uploadCsv(id, 'survey', input.label, content);
}

export async function getCsvData(id: number): Promise<CsvUpload[]> {
  try {
    const { data } = await apiClient.get<{
      items?: Array<{
        id?: number;
        campaignId?: number;
        platform?: Platform;
        filename?: string | null;
        rowCount?: number | null;
        uploadedAt?: string | null;
        syncedAt?: string | null;
        status?: string;
      }>;
    }>(`/admin/content-hub/campaigns/${id}/platform-data`);

    return (data?.items ?? [])
      .filter((item) => item.platform)
      .map((item, index) => ({
        id: item.id ?? index + 1,
        campaignId: item.campaignId ?? id,
        platform: item.platform as Platform,
        filename: item.filename ?? `${item.platform}.csv`,
        rowCount: item.rowCount ?? 0,
        uploadedAt: item.uploadedAt ?? item.syncedAt ?? new Date().toISOString(),
      }));
  } catch (err) {
    throwApiError(err, 'Failed to load platform data.');
  }
}

export async function getDataValidation(id: number): Promise<DataValidation> {
  try {
    const { data } = await apiClient.get<DataValidation>(
      `/admin/content-hub/campaigns/${id}/validation`,
    );
    return data;
  } catch (err) {
    throwApiError(err, 'Failed to load data validation.');
  }
}

export async function hubspotSync(
  id: number,
): Promise<{
  synced: boolean;
  syncedAt: string;
  warnings?: string[];
  errors?: string[];
}> {
  try {
    const { data } = await apiClient.post<{
      synced: boolean;
      syncedAt: string;
      warnings?: string[];
      errors?: string[];
    }>(`/admin/content-hub/campaigns/${id}/hubspot/sync`);
    return data;
  } catch (err) {
    throwApiError(err, 'HubSpot sync failed.');
  }
}

export async function generateAiInsights(
  id: number,
): Promise<{ insights: string }> {
  try {
    const { data } = await apiClient.post<{ insights: string }>(
      `/admin/content-hub/campaigns/${id}/insights`,
    );
    return data;
  } catch (err) {
    throwApiError(err, 'Failed to generate insights.');
  }
}

// ---------- Reports ----------
export async function getAnalyticsReport(
  id: number,
): Promise<AnalyticsReport> {
  try {
    const { data } = await apiClient.get<AnalyticsReport>(
      `/admin/content-hub/campaigns/${id}/report`,
    );
    return data;
  } catch (err) {
    throwApiError(err, 'Failed to load analytics report.');
  }
}

export async function getExecutiveReport(
  id: number,
): Promise<ExecutiveReport> {
  try {
    const { data } = await apiClient.get<ExecutiveReport>(
      `/admin/content-hub/campaigns/${id}/executive-report`,
    );
    return data;
  } catch (err) {
    throwApiError(err, 'Failed to load executive report.');
  }
}

// ---------- Templates ----------
export async function listTemplates(): Promise<Template[]> {
  try {
    const { data } = await apiClient.get<TemplateListResponse | Template[]>(
      '/admin/content-hub/templates',
    );
    if (Array.isArray(data)) return data;
    return data?.items ?? [];
  } catch (err) {
    throwApiError(err, 'Failed to load templates.');
  }
}

export async function createTemplate(body: {
  name: string;
  type: string;
  description: string;
}): Promise<Template> {
  try {
    const { data } = await apiClient.post<Template>(
      '/admin/content-hub/templates',
      body,
    );
    return data;
  } catch (err) {
    throwApiError(err, 'Failed to create template.');
  }
}

export async function deleteTemplate(id: number): Promise<void> {
  try {
    await apiClient.delete(`/admin/content-hub/templates/${id}`);
  } catch (err) {
    throwApiError(err, 'Failed to delete template.');
  }
}

// ---------- Integrations ----------
const EMPTY_INTEGRATIONS: IntegrationSettings = {
  hubspot: { token: '', enabled: false, accountName: '' },
  linkedin: {
    enabled: false,
    note: 'Upload CSV exports from LinkedIn Campaign Manager.',
  },
  meta: {
    enabled: false,
    note: 'Upload CSV exports from Meta Ads Manager.',
  },
  youtube: {
    enabled: false,
    note: 'Upload CSV exports from YouTube Studio analytics.',
  },
  livestream: {
    enabled: false,
    note: 'Zoom webinars and livestream attendance (CHT).',
  },
  survey: {
    enabled: true,
    note: 'Native CHT post-event feedback responses by program.',
  },
};

/** Settings form shape derived from live connection status (no local tokens). */
export async function getIntegrations(): Promise<IntegrationSettings> {
  const connection = await getIntegrationsConnection();
  const out = structuredClone(EMPTY_INTEGRATIONS);
  for (const key of Object.keys(out) as Array<keyof IntegrationSettings>) {
    const block = connection[key];
    if (!block) continue;
    if (key === 'hubspot') {
      out.hubspot = {
        token: '',
        enabled: Boolean(block.connected),
        accountName: block.accountName ?? '',
      };
    } else {
      out[key] = {
        enabled: Boolean(block.connected ?? block.enabled),
        note: block.note || out[key].note,
      };
    }
  }
  return out;
}

export async function updateIntegrations(
  patch: Partial<Record<keyof IntegrationSettings, unknown>>,
): Promise<{ saved: true }> {
  // HubSpot credentials are managed in CHT secrets — never PATCH them to Hub.
  const { hubspot: _ignored, ...rest } = patch;
  try {
    await apiClient.patch('/admin/content-hub/integrations', rest);
    return { saved: true };
  } catch (err) {
    throwApiError(err, 'Failed to update integrations.');
  }
}

export async function getHubspotStatus(): Promise<HubspotStatus> {
  try {
    const { data } = await apiClient.get<{
      connected?: boolean;
      accountName?: string | null;
      portalId?: string | null;
      error?: string;
    }>('/admin/content-hub/integrations/hubspot/status');
    return {
      connected: Boolean(data?.connected),
      accountName: data?.accountName ?? null,
      portalId: data?.portalId ?? null,
      error: data?.error,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'HubSpot status check failed';
    return {
      connected: false,
      accountName: null,
      portalId: null,
      error: message,
    };
  }
}

/** Content Hub dependency health: reachability only (not integration credentials). */
export async function getContentHubHealth(): Promise<ContentHubHealth> {
  try {
    const { data } = await apiClient.get<ContentHubHealth>(
      '/admin/content-hub/health',
    );
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
