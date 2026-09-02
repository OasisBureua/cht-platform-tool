import { Injectable, Logger } from '@nestjs/common';
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

  constructor(private readonly contentHub: ContentHubClientService) {
    if (!this.contentHub.isConfigured()) {
      this.logger.warn(
        'CONTENTHUB_API_KEY not configured, HCP upsert disabled',
      );
    }
  }

  isConfigured(): boolean {
    return this.contentHub.isConfigured();
  }

  /**
   * Upsert HCP roster to Content Hub when configured.
   * Returns true on success so registration is not blocked by sync failures.
   */
  async upsertHCP(input: MediaHubHCPUpsertInput): Promise<boolean> {
    const npi = (input.npi || '').replace(/\D/g, '');
    if (npi.length !== 10) {
      this.logger.debug(
        `[HCP upsert] skip: invalid NPI '${input.npi ?? ''}'`,
      );
      return false;
    }

    if (!this.contentHub.isConfigured()) {
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

    return this.upsertViaContentHub(body, npi);
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
}
