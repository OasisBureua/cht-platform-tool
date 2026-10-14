import { Injectable } from '@nestjs/common';
import { ContentHubClientService } from './content-hub-client.service';

export type CampaignPlatform =
  | 'linkedin'
  | 'meta'
  | 'youtube'
  | 'livestream'
  | 'survey';

export type CampaignKol = {
  id: string;
  slug: string;
  name: string;
  title: string | null;
  institution: string | null;
};

export type CampaignKolList = { items: CampaignKol[] };

export type CampaignListResponse = {
  items: unknown[];
  total: number;
};

@Injectable()
export class ContentHubCampaignService {
  constructor(private readonly client: ContentHubClientService) {}

  isConfigured(): boolean {
    return this.client.isAdminConfigured();
  }

  getAdminBaseUrl(): string {
    return this.client.getAdminBaseUrl();
  }

  listCampaigns(q?: string): Promise<CampaignListResponse> {
    return this.client.getAdmin<CampaignListResponse>('/campaigns', { q });
  }

  getCampaign<T = unknown>(id: number | string): Promise<T> {
    return this.client.getAdmin<T>(`/campaigns/${id}`, undefined, {
      cache: false,
    });
  }

  createCampaign<T = unknown>(body: unknown): Promise<T> {
    return this.client.postAdmin<T>('/campaigns', body);
  }

  updateCampaign<T = unknown>(id: number | string, body: unknown): Promise<T> {
    return this.client.patchAdmin<T>(`/campaigns/${id}`, body);
  }

  deleteCampaign(id: number | string): Promise<void> {
    return this.client.deleteAdmin(`/campaigns/${id}`);
  }

  listCampaignKols(id: number | string): Promise<CampaignKolList> {
    return this.client.getAdmin<CampaignKolList>(
      `/campaigns/${id}/kols`,
      undefined,
      { cache: false },
    );
  }

  setCampaignKols(
    id: number | string,
    kolIds: string[],
  ): Promise<CampaignKolList> {
    return this.client.putAdmin<CampaignKolList>(`/campaigns/${id}/kols`, {
      kolIds,
    });
  }

  getPlatformData<T = unknown>(id: number | string): Promise<T> {
    return this.client.getAdmin<T>(
      `/campaigns/${id}/platform-data`,
      undefined,
      {
        cache: false,
      },
    );
  }

  syncPlatform<T = unknown>(
    id: number | string,
    platform: CampaignPlatform,
  ): Promise<T> {
    return this.client.postAdmin<T>(
      `/campaigns/${id}/platforms/${platform}/sync`,
    );
  }

  syncAll<T = unknown>(id: number | string): Promise<T> {
    return this.client.postAdmin<T>(`/campaigns/${id}/sync-all`);
  }

  /**
   * CPR-41 — pull platform Zoom export into the Hub warehouse for this campaign.
   * `exportCampaignId` defaults to the Hub id string (matches Program.campaignId).
   */
  exportIngest<T = unknown>(
    id: number | string,
    opts?: {
      exportCampaignId?: string;
      trigger?: string;
      timeoutMs?: number;
    },
  ): Promise<T> {
    const hubId = String(id).trim();
    const exportCampaignId = (opts?.exportCampaignId || hubId).trim();
    return this.client.postAdmin<T>(
      `/campaigns/${hubId}/export-ingest`,
      undefined,
      {
        // Stay under Hub ALB idle timeout (~60s) and Platform ALB (~90s).
        timeoutMs: opts?.timeoutMs ?? 55_000,
        params: {
          source: 'http',
          exportCampaignId,
          trigger: opts?.trigger || 'manual',
        },
      },
    );
  }

  uploadCsv<T = unknown>(
    id: number | string,
    body: { platform: CampaignPlatform; filename: string; content: string },
  ): Promise<T> {
    return this.client.postAdmin<T>(`/campaigns/${id}/uploads`, body);
  }

  getValidation<T = unknown>(id: number | string): Promise<T> {
    return this.client.getAdmin<T>(`/campaigns/${id}/validation`, undefined, {
      cache: false,
    });
  }

  generateReport<T = unknown>(id: number | string): Promise<T> {
    return this.client.postAdmin<T>(`/campaigns/${id}/report/generate`);
  }

  generateInsights<T = unknown>(id: number | string): Promise<T> {
    return this.client.postAdmin<T>(`/campaigns/${id}/insights`);
  }

  listTemplates<T = unknown>(): Promise<T> {
    return this.client.getAdmin<T>('/templates');
  }

  createTemplate<T = unknown>(body: unknown): Promise<T> {
    return this.client.postAdmin<T>('/templates', body);
  }

  deleteTemplate(id: number | string): Promise<void> {
    return this.client.deleteAdmin(`/templates/${id}`);
  }

  getIntegrations<T = unknown>(): Promise<T> {
    return this.client.getAdmin<T>('/integrations', undefined, {
      cache: false,
    });
  }

  patchIntegrations<T = unknown>(body: unknown): Promise<T> {
    return this.client.patchAdmin<T>('/integrations', body);
  }
}
