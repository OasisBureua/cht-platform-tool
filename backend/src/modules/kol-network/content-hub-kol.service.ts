import { Injectable } from '@nestjs/common';
import { ContentHubClientService } from '../content-hub/content-hub-client.service';
import { normalizePublicKolAiBrief } from '../../utils/kol-ai-brief';
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

  private normalizeKol(kol: PublicKol): PublicKol {
    if (!kol.intel?.ai_brief) return kol;
    const ai_brief = normalizePublicKolAiBrief(kol.intel.ai_brief);
    if (!ai_brief) return kol;
    return {
      ...kol,
      intel: {
        ...kol.intel,
        ai_brief,
      },
    };
  }

  async getKols(params?: KolListQuery): Promise<PublicKolList> {
    const query: Record<string, string | number | boolean | undefined> = {};
    if (params?.region) query.region = params.region;
    if (params?.institution) query.institution = params.institution;
    if (params?.q) query.q = params.q;
    if (params?.new_only) query.new_only = true;
    if (params?.limit != null) query.limit = params.limit;
    if (params?.offset != null) query.offset = params.offset;

    const data = await this.client.get<PublicKolList>('/kols', query);
    return {
      ...data,
      items: data.items.map((item) => this.normalizeKol(item)),
    };
  }

  async getKol(slug: string): Promise<PublicKol> {
    const kol = await this.client.get<PublicKol>(
      `/kols/${encodeURIComponent(slug)}`,
    );
    return this.normalizeKol(kol);
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
