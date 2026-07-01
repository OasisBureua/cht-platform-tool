import { Injectable } from '@nestjs/common';
import { ContentHubClientService } from '../content-hub/content-hub-client.service';
import type {
  KolListQuery,
  PublicKol,
  PublicKolList,
  PublicKolPublicationList,
} from './kol-network.types';

/** Proxies CHT /api/kol-network/* → Content Hub GET /api/public/kols* */
@Injectable()
export class ContentHubKolService {
  constructor(private readonly client: ContentHubClientService) {}

  isConfigured(): boolean {
    return this.client.isConfigured();
  }

  async getKols(params?: KolListQuery): Promise<PublicKolList> {
    const query: Record<string, string | number | boolean | undefined> = {};
    if (params?.region) query.region = params.region;
    if (params?.institution) query.institution = params.institution;
    if (params?.q) query.q = params.q;
    if (params?.new_only) query.new_only = true;
    if (params?.limit != null) query.limit = params.limit;
    if (params?.offset != null) query.offset = params.offset;

    return this.client.get<PublicKolList>('/kols', query);
  }

  async getKol(slug: string): Promise<PublicKol> {
    return this.client.get<PublicKol>(
      `/kols/${encodeURIComponent(slug)}`,
    );
  }

  async getKolPublications(
    slug: string,
    params?: { limit?: number; offset?: number },
  ): Promise<PublicKolPublicationList> {
    const query: Record<string, number | undefined> = {};
    if (params?.limit != null) query.limit = params.limit;
    if (params?.offset != null) query.offset = params.offset;

    return this.client.get<PublicKolPublicationList>(
      `/kols/${encodeURIComponent(slug)}/publications`,
      query,
    );
  }
}
