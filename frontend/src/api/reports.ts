import apiClient from './client';

export type ReportStatus =
  | 'queued'
  | 'pulling_data'
  | 'generating'
  | 'rendering'
  | 'uploading'
  | 'waiting_for_transcript'
  | 'complete'
  | 'failed';

export const REPORT_IN_FLIGHT: ReadonlySet<ReportStatus> = new Set([
  'queued',
  'pulling_data',
  'generating',
  'rendering',
  'uploading',
  'waiting_for_transcript',
]);

export type DateRangeDays = 30 | 60 | 90;

export type Report = {
  reportId: string;
  campaignId: string;
  templateType: string;
  status: ReportStatus;
  sources: string[];
  dateRangeDays: number | null;
  windowStart: string | null;
  windowEnd: string;
  notifyEmails: string[];
  attemptCount: number;
  editAttempts: number;
  maxEditAttempts: number;
  lastError: string | null;
  requestedBy: string;
  version: number | null;
  downloadAvailable: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateReportInput = {
  campaignId: string;
  dateRangeDays: DateRangeDays;
  sources: string[];
  templateType?: string;
  notifyEmails?: string[];
};

export type ReportRecipient = {
  userId: string;
  name: string;
  email: string;
};

export type CampaignLinkProgram = {
  id: string;
  title: string;
  status: string;
  startDate: string | null;
  zoomSessionType: string;
  chmProgramId: string | null;
  campaignId: string | null;
};

/**
 * The reports API returns meaningful 409/503 messages ("already generating",
 * "not configured"), so read them for every status instead of hiding 5xx.
 * Blob responses (download) carry the JSON error as a Blob.
 */
export async function reportErrorMessage(
  err: unknown,
  fallback: string,
): Promise<string> {
  const ax = err as {
    response?: { status?: number; data?: unknown };
  };
  let data = ax.response?.data;
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      data = JSON.parse(await data.text());
    } catch {
      data = undefined;
    }
  }
  const message = (data as { message?: string | string[] } | undefined)?.message;
  if (Array.isArray(message)) return message.filter(Boolean).join('; ');
  if (typeof message === 'string' && message.trim()) return message;
  return fallback;
}

function filenameFrom(disposition: string | undefined, fallback: string): string {
  const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  return match?.[1] ? decodeURIComponent(match[1]) : fallback;
}

export const reportsApi = {
  list: async (campaignId: string): Promise<Report[]> => {
    const { data } = await apiClient.get<Report[]>('/reports', {
      params: { campaignId },
    });
    return data;
  },

  get: async (reportId: string, campaignId: string): Promise<Report> => {
    const { data } = await apiClient.get<Report>(`/reports/${reportId}`, {
      params: { campaignId },
    });
    return data;
  },

  create: async (input: CreateReportInput): Promise<Report> => {
    const { data } = await apiClient.post<Report>('/reports', input);
    return data;
  },

  regenerate: async (
    reportId: string,
    campaignId: string,
    editInstructions?: string,
  ): Promise<Report> => {
    const { data } = await apiClient.post<Report>(
      `/reports/${reportId}/regenerate`,
      editInstructions?.trim() ? { editInstructions: editInstructions.trim() } : {},
      { params: { campaignId } },
    );
    return data;
  },

  /** Streams the PDF through the API and saves it; the S3 location is never exposed. */
  download: async (report: Report): Promise<void> => {
    const res = await apiClient.get<Blob>(`/reports/${report.reportId}/download`, {
      params: { campaignId: report.campaignId },
      responseType: 'blob',
    });
    const filename = filenameFrom(
      res.headers['content-disposition'] as string | undefined,
      `campaign-${report.campaignId}-${report.templateType}-v${report.version ?? 1}.pdf`,
    );
    const url = URL.createObjectURL(
      new Blob([res.data], { type: 'application/pdf' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  },

  notifyRecipients: async (): Promise<ReportRecipient[]> => {
    const { data } = await apiClient.get<ReportRecipient[]>(
      '/reports/notify-recipients',
    );
    return data;
  },

  /** CPR-41 — sync platform export into Hub for this campaign (no report generate). */
  refreshData: async (
    campaignId: string,
  ): Promise<{ status?: string; sessionsUpserted?: number }> => {
    const { data } = await apiClient.post<{
      status?: string;
      sessionsUpserted?: number;
    }>(`/reports/campaigns/${encodeURIComponent(campaignId)}/refresh-data`);
    return data;
  },
};

export const campaignLinksApi = {
  listPrograms: async (): Promise<CampaignLinkProgram[]> => {
    const { data } = await apiClient.get<CampaignLinkProgram[]>(
      '/admin/campaign-links/programs',
    );
    return data;
  },

  setProgramCampaign: async (
    programId: string,
    campaignId: string | null,
  ): Promise<CampaignLinkProgram> => {
    const { data } = await apiClient.patch<CampaignLinkProgram>(
      `/admin/campaign-links/programs/${programId}`,
      { campaignId },
    );
    return data;
  },
};

/** Hub KOL attached to a campaign; the report's KOL section uses these (CPR-45). */
export interface CampaignKol {
  id: string;
  slug: string;
  name: string;
  title: string | null;
  institution: string | null;
}

export const campaignKolsApi = {
  list: async (campaignId: string): Promise<CampaignKol[]> => {
    const { data } = await apiClient.get<{ items: CampaignKol[] }>(
      `/admin/content-hub/campaigns/${campaignId}/kols`,
    );
    return data?.items ?? [];
  },

  set: async (campaignId: string, kolIds: string[]): Promise<CampaignKol[]> => {
    const { data } = await apiClient.put<{ items: CampaignKol[] }>(
      `/admin/content-hub/campaigns/${campaignId}/kols`,
      { kolIds },
    );
    return data?.items ?? [];
  },
};
