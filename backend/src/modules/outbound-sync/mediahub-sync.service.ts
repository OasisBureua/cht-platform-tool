import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
  private readonly baseUrl: string;
  private readonly apiKey: string | null;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = (
      this.config.get<string>('mediahub.baseUrl') ||
      'https://mediahub.communityhealth.media/api/public'
    ).replace(/\/$/, '');
    this.apiKey = this.config.get<string>('mediahub.apiKey')?.trim() || null;
    if (!this.apiKey) {
      this.logger.warn('MEDIAHUB_API_KEY not configured — HCP sync disabled');
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Upsert an HCP into MediaHub's `hcps` roster. No-op when API key missing.
   * Returns true on success, false on any failure (caller logs + moves on).
   */
  async upsertHCP(input: MediaHubHCPUpsertInput): Promise<boolean> {
    if (!this.apiKey) return false;
    const npi = (input.npi || '').replace(/\D/g, '');
    if (npi.length !== 10) {
      this.logger.debug(
        `[MediaHub] skip upsert: invalid NPI '${input.npi ?? ''}'`,
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

    try {
      const res = await fetch(`${this.baseUrl}/hcp/upsert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.error(
          `[MediaHub] HCP upsert failed: ${res.status} ${res.statusText} - ${text.slice(0, 200)}`,
        );
        return false;
      }
      const out = (await res.json().catch(() => ({}))) as { created?: boolean };
      this.logger.debug(
        `[MediaHub] HCP upsert ok: npi=${npi} created=${out.created ?? '?'}`,
      );
      return true;
    } catch (err) {
      this.logger.error(`[MediaHub] HCP upsert error for npi=${npi}:`, err);
      return false;
    }
  }
}
