import { Injectable } from '@nestjs/common';
import { ContentHubClientService } from '../content-hub/content-hub-client.service';
import type {
  EngagementSignals,
  AdminKolPublicationList,
  OpenPayments,
  Trials,
  News,
  PublicationsQuery,
  OpenPaymentsQuery,
  TrialsQuery,
  NewsQuery,
} from './kol-intel.types';

/**
 * Proxies CHT /api/admin/kol-network/:slug/{engagement,publications,open-payments,trials,news}
 * → Content Hub GET /api/admin/kols/{slug}/*.
 *
 * Read-through cache in `ContentHubClientService.getAdmin` under the
 * `cht:contenthub:admin:*` namespace; cleared via
 * `CacheClearService.clear('contenthub')` on edit/refresh.
 */
@Injectable()
export class KolIntelService {
  constructor(private readonly client: ContentHubClientService) {}

  isConfigured(): boolean {
    return this.client.isAdminConfigured();
  }

  private base(slug: string): string {
    return `/kols/${encodeURIComponent(slug)}`;
  }

  async getEngagement(slug: string): Promise<EngagementSignals> {
    return this.client.getAdmin<EngagementSignals>(
      `${this.base(slug)}/engagement`,
    );
  }

  async getPublications(
    slug: string,
    params?: PublicationsQuery,
  ): Promise<AdminKolPublicationList> {
    const query: Record<string, number | undefined> = {};
    if (params?.limit != null) query.limit = params.limit;
    if (params?.offset != null) query.offset = params.offset;
    return this.client.getAdmin<AdminKolPublicationList>(
      `${this.base(slug)}/publications`,
      query,
    );
  }

  async getOpenPayments(
    slug: string,
    params?: OpenPaymentsQuery,
  ): Promise<OpenPayments> {
    const query: Record<string, number | undefined> = {};
    if (params?.limit != null) query.limit = params.limit;
    return this.client.getAdmin<OpenPayments>(
      `${this.base(slug)}/open-payments`,
      query,
    );
  }

  async getTrials(slug: string, params?: TrialsQuery): Promise<Trials> {
    const query: Record<string, number | undefined> = {};
    if (params?.limit != null) query.limit = params.limit;
    if (params?.offset != null) query.offset = params.offset;
    return this.client.getAdmin<Trials>(`${this.base(slug)}/trials`, query);
  }

  async getNews(slug: string, params?: NewsQuery): Promise<News> {
    const query: Record<string, number | undefined> = {};
    if (params?.limit != null) query.limit = params.limit;
    if (params?.offset != null) query.offset = params.offset;
    return this.client.getAdmin<News>(`${this.base(slug)}/news`, query);
  }
}
