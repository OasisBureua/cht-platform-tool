import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type NpiLookupResult =
  | {
      valid: true;
      npi: string;
      providerName?: string;
      providerType?: string;
      practiceAddress?: string;
    }
  | {
      valid: false;
      npi: string;
      reason: 'invalid_format' | 'not_found' | 'unavailable';
      message: string;
    };

/**
 * Validates individual NPIs against NIH Clinical Tables (CMS NPPES-backed).
 * Public free API — no API key. Override base URL via NPI_API_BASE_URL if needed.
 *
 * @see https://clinicaltables.nlm.nih.gov/apidoc/npi_idv/v3/doc.html
 */
@Injectable()
export class NpiRegistryService {
  private readonly logger = new Logger(NpiRegistryService.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = (
      this.config.get<string>('npi.apiBaseUrl') ||
      'https://clinicaltables.nlm.nih.gov/api/npi_idv/v3/search'
    ).replace(/\/$/, '');
    this.timeoutMs = this.config.get<number>('npi.timeoutMs') ?? 8000;
  }

  normalizeNpi(raw: string | undefined | null): string {
    return (raw || '').replace(/\D/g, '').slice(0, 10);
  }

  async lookup(rawNpi: string): Promise<NpiLookupResult> {
    const npi = this.normalizeNpi(rawNpi);
    if (npi.length !== 10) {
      return {
        valid: false,
        npi,
        reason: 'invalid_format',
        message: 'NPI number must be exactly 10 digits.',
      };
    }

    const url = new URL(this.baseUrl);
    url.searchParams.set('terms', npi);
    // Exact NPI match — avoid fuzzy name hits when digits collide with other fields.
    url.searchParams.set('sf', 'NPI');
    url.searchParams.set('q', `NPI:${npi}`);
    url.searchParams.set('df', 'NPI,name.full,provider_type,addr_practice.full');
    url.searchParams.set('ef', 'name.full,provider_type,addr_practice.full');
    url.searchParams.set('maxList', '1');

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        this.logger.warn(
          `[NPI] Clinical Tables HTTP ${res.status} for npi=${npi}`,
        );
        return {
          valid: false,
          npi,
          reason: 'unavailable',
          message:
            'NPI verification is temporarily unavailable. Please try again.',
        };
      }

      const payload = (await res.json()) as unknown;
      if (!Array.isArray(payload) || payload.length < 2) {
        return {
          valid: false,
          npi,
          reason: 'unavailable',
          message:
            'NPI verification returned an unexpected response. Please try again.',
        };
      }

      const codes = payload[1];
      if (!Array.isArray(codes) || codes.length === 0) {
        return {
          valid: false,
          npi,
          reason: 'not_found',
          message:
            'NPI not found in the National Provider Identifier registry. Please check and try again.',
        };
      }

      const matched = codes.some(
        (code) => String(code).replace(/\D/g, '') === npi,
      );
      if (!matched) {
        return {
          valid: false,
          npi,
          reason: 'not_found',
          message:
            'NPI not found in the National Provider Identifier registry. Please check and try again.',
        };
      }

      const extra =
        payload[2] && typeof payload[2] === 'object'
          ? (payload[2] as Record<string, unknown[]>)
          : null;
      const first = (key: string): string | undefined => {
        const arr = extra?.[key];
        if (!Array.isArray(arr) || arr.length === 0) return undefined;
        const v = arr[0];
        return typeof v === 'string' && v.trim() ? v.trim() : undefined;
      };

      return {
        valid: true,
        npi,
        providerName: first('name.full'),
        providerType: first('provider_type'),
        practiceAddress: first('addr_practice.full'),
      };
    } catch (err) {
      this.logger.warn(
        `[NPI] lookup failed for npi=${npi}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        valid: false,
        npi,
        reason: 'unavailable',
        message:
          'NPI verification is temporarily unavailable. Please try again.',
      };
    }
  }

  /** Throws-friendly message for signup/profile when NPI must be valid. */
  async assertValidIndividualNpi(rawNpi: string): Promise<string> {
    const result = await this.lookup(rawNpi);
    if (result.valid) return result.npi;
    throw new Error(result.message);
  }
}
