import apiClient from './client';

/** Content Hub `KOLAdminOut`, proxied through CHT `/admin/kol-network`. */
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

/** PATCH body: every field optional; omitted fields are untouched. */
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

export interface KolRefreshResult {
  status: 'enqueued' | 'no_op' | 'cooldown';
  reason?: string | null;
  slug: string;
  hcp_npi: string | null;
  cooldown_remaining_seconds?: number | null;
}

export interface KolHeadshotPresign {
  upload_url: string;
  upload_method: 'PUT';
  upload_headers: Record<string, string>;
  key: string;
  photo_url: string;
  expires_in_seconds: number;
}

function base(slug: string): string {
  return `/admin/kol-network/${encodeURIComponent(slug)}`;
}

export const adminKolApi = {
  patch: async (slug: string, body: AdminKolUpdate): Promise<AdminKol> => {
    const { data } = await apiClient.patch<AdminKol>(base(slug), body);
    return data;
  },

  refresh: async (slug: string): Promise<KolRefreshResult> => {
    const { data } = await apiClient.post<KolRefreshResult>(`${base(slug)}/refresh`);
    return data;
  },

  presignHeadshot: async (
    slug: string,
    contentType: string,
  ): Promise<KolHeadshotPresign> => {
    const { data } = await apiClient.post<KolHeadshotPresign>(
      `${base(slug)}/headshot/presign`,
      { content_type: contentType },
    );
    return data;
  },
};

/** Direct browser PUT to S3 using the presigned URL. Not through apiClient: the
 * S3 URL rejects our JWT + adds its own signature. */
export async function uploadHeadshotToS3(
  presign: KolHeadshotPresign,
  file: File,
): Promise<void> {
  const res = await fetch(presign.upload_url, {
    method: presign.upload_method,
    headers: presign.upload_headers,
    body: file,
  });
  if (!res.ok) {
    throw new Error(`S3 upload failed (${res.status})`);
  }
}
