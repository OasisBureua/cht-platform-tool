import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { ContentHubClientService } from '../content-hub/content-hub-client.service';
import { axiosContentHubErrorMeta } from '../../utils/content-hub-error';

export interface MediaHubHCPUpsertInput {
  npi: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  specialty?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  institution?: string | null;
}

@Injectable()
export class MediaHubSyncService {
  private readonly logger = new Logger(MediaHubSyncService.name);
  private readonly mediahubBaseUrl: string;
  private readonly mediahubApiKey: string | null;

  constructor(
    private readonly config: ConfigService,
    private readonly contentHub: ContentHubClientService,
  ) {
    this.mediahubBaseUrl = (
      this.config.get<string>('mediahub.baseUrl') ||
      'https://mediahub.communityhealth.media/api/public'
    ).replace(/\/$/, '');
    this.mediahubApiKey = this.config.get<string>('mediahub.apiKey')?.trim() || null;
    if (!this.mediahubApiKey && !this.contentHub.isConfigured()) {
      this.logger.warn(
        'MEDIAHUB_API_KEY and CONTENTHUB_API_KEY not configured, HCP upsert disabled',
      );
    }
  }

  isConfigured(): boolean {
    return !!this.mediahubApiKey || this.contentHub.isConfigured();
  }

  /**
   * Dual-write HCP roster to EC2 MediaHub and Content Hub (when each is configured).
   * Returns true if at least one target succeeds so registration is not blocked.
   */
  async upsertHCP(input: MediaHubHCPUpsertInput): Promise<boolean> {
    const npi = (input.npi || '').replace(/\D/g, '');
    if (npi.length !== 10) {
      this.logger.debug(
        `[HCP upsert] skip: invalid NPI '${input.npi ?? ''}'`,
      );
      return false;
    }

    const body = {
      npi,
      first_name: (input.firstName || '').trim() || 'Unknown',
      last_name: (input.lastName || '').trim() || 'Unknown',
      email: input.email || undefined,
      specialty: input.specialty || undefined,
      city: input.city || undefined,
      state: input.state || undefined,
      zip: input.zip || undefined,
      institution: input.institution || undefined,
      source: 'cht',
    };

    const targets: Promise<boolean>[] = [];
    if (this.mediahubApiKey) {
      targets.push(this.upsertViaMediaHub(body, npi));
    }
    if (this.contentHub.isConfigured()) {
      targets.push(this.upsertViaContentHub(body, npi));
    }
    if (targets.length === 0) {
      return false;
    }

    const results = await Promise.all(targets);
    return results.some(Boolean);
  }

  private async upsertViaContentHub(
    body: Record<string, string | undefined>,
    npi: string,
  ): Promise<boolean> {
    try {
      const out = await this.contentHub.post<{ created?: boolean }>(
        '/hcp/upsert',
        body,
      );
      this.logger.debug(
        `[Content Hub] HCP upsert ok: npi=${npi} created=${out.created ?? '?'}`,
      );
      return true;
    } catch (err: unknown) {
      const meta = isAxiosError(err)
        ? axiosContentHubErrorMeta(err)
        : { status: 500, message: 'Unknown error' };
      this.logger.error(
        `[Content Hub] HCP upsert failed (npi=${npi}` +
          `${meta.requestId ? `, upstream-request-id=${meta.requestId}` : ''}): ${meta.message}`,
      );
      return false;
    }
  }

  private async upsertViaMediaHub(
    body: Record<string, string | undefined>,
    npi: string,
  ): Promise<boolean> {
    try {
      const res = await fetch(`${this.mediahubBaseUrl}/hcp/upsert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.mediahubApiKey!,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.error(
          `[MediaHub EC2] HCP upsert failed: ${res.status} ${res.statusText} - ${text.slice(0, 200)}`,
        );
        return false;
      }
      const out = (await res.json().catch(() => ({}))) as { created?: boolean };
      this.logger.debug(
        `[MediaHub EC2] HCP upsert ok: npi=${npi} created=${out.created ?? '?'}`,
      );
      return true;
    } catch (err) {
      this.logger.error(`[MediaHub EC2] HCP upsert error for npi=${npi}:`, err);
      return false;
    }
  }
}
