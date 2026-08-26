import { Injectable } from '@nestjs/common';
import { ContentHubClientService } from '../content-hub/content-hub-client.service';

/** Content Hub `KOLAdminOut`. */
export interface AdminKol {
  id: string;
  slug: string;
  name: string;
  title: string | null;
  specialty: string | null;
  institution: string | null;
  bio: string | null;
  photo_url: string | null;
  region: string | null;
  region_label: string | null;
  display_order: number | null;
  featured: boolean;
  curated_fields: string[];
  hcp_npi: string | null;
  hcp_match_status: string;
  created_at: string | null;
  updated_at: string | null;
}

/** Content Hub `KOLAdminUpdate`. Every field optional. */
export interface AdminKolUpdate {
  title?: string | null;
  specialty?: string | null;
  institution?: string | null;
  bio?: string | null;
  photo_url?: string | null;
  region?: string | null;
  display_order?: number | null;
  featured?: boolean | null;
}

/** Content Hub `KOLRefreshOut`. */
export interface KolRefreshResult {
  status: 'enqueued' | 'no_op' | 'cooldown';
  reason?: string | null;
  slug: string;
  hcp_npi: string | null;
  cooldown_remaining_seconds?: number | null;
}

export interface KolHeadshotPresignRequest {
  content_type: string;
}

/** Content Hub `KOLHeadshotPresignOut`. */
export interface KolHeadshotPresignResult {
  upload_url: string;
  upload_method: 'PUT';
  upload_headers: Record<string, string>;
  key: string;
  photo_url: string;
  expires_in_seconds: number;
}

/**
 * Proxies KOL admin writes to Content Hub:
 * - PATCH /api/admin/kols/{slug}    : field edits
 * - POST  /api/admin/kols/{slug}/refresh
 * - POST  /api/admin/kols/{slug}/headshot/presign
 *
 * All three are cache-invalidating on CHT, the controller calls
 * `CacheClearService.clear('contenthub')` after a successful response.
 */
@Injectable()
export class KolMutationsService {
  constructor(private readonly client: ContentHubClientService) {}

  isConfigured(): boolean {
    return this.client.isAdminConfigured();
  }

  private base(slug: string): string {
    return `/kols/${encodeURIComponent(slug)}`;
  }

  async patchKol(slug: string, body: AdminKolUpdate): Promise<AdminKol> {
    return this.client.patchAdmin<AdminKol>(this.base(slug), body);
  }

  async refreshKol(slug: string): Promise<KolRefreshResult> {
    return this.client.postAdmin<KolRefreshResult>(`${this.base(slug)}/refresh`);
  }

  async presignHeadshot(
    slug: string,
    body: KolHeadshotPresignRequest,
  ): Promise<KolHeadshotPresignResult> {
    return this.client.postAdmin<KolHeadshotPresignResult>(
      `${this.base(slug)}/headshot/presign`,
      body,
    );
  }
}
