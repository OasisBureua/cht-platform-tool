import { Injectable } from '@nestjs/common';
import { ContentHubClientService } from './content-hub-client.service';

export type CampaignPlatform = 'linkedin' | 'meta' | 'youtube' | 'livestream' | 'survey';

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
    return this.client.getAdmin<T>(`/campaigns/${id}`, undefined, { cache: false });
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

  getPlatformData<T = unknown>(id: number | string): Promise<T> {
    return this.client.getAdmin<T>(`/campaigns/${id}/platform-data`, undefined, {
      cache: false,
    });
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

  generateExecutiveReport<T = unknown>(id: number | string): Promise<T> {
    return this.client.postAdmin<T>(
      `/campaigns/${id}/executive-report/generate`,
    );
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
    return this.client.getAdmin<T>('/integrations', undefined, { cache: false });
  }

  patchIntegrations<T = unknown>(body: unknown): Promise<T> {
    return this.client.patchAdmin<T>('/integrations', body);
  }
}
