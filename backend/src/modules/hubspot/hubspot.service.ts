import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const HUBSPOT_API_BASE = 'https://api.hubapi.com';

export interface HubSpotContactProperties {
  email: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  company?: string;
  city?: string;
  state?: string;
  zip?: string;
  jobtitle?: string;
  npi_number?: string;
  [key: string]: string | undefined;
}

/** Reject blank / placeholder secrets that would only produce HubSpot 401 noise. */
function normalizeHubSpotToken(raw: string | undefined | null): string | null {
  const token = raw?.trim() ?? '';
  if (!token) return null;
  // Common placeholders from tfvars / Secrets Manager when HubSpot is "disabled"
  if (token === '"' || token === "'") return null;
  if (/^["']?\s*["']?$/.test(token)) return null;
  // HubSpot private app tokens are typically long and start with pat-
  if (token.length < 20) return null;
  return token;
}

@Injectable()
export class HubSpotService {
  private readonly logger = new Logger(HubSpotService.name);
  private accessToken: string | null;
  /** After INVALID_AUTHENTICATION, stop calling HubSpot for this process. */
  private authDisabled = false;
  private authFailureLogged = false;

  constructor(private readonly config: ConfigService) {
    this.accessToken = normalizeHubSpotToken(
      this.config.get<string>('hubspot.accessToken'),
    );
    if (!this.accessToken) {
      this.logger.warn(
        'HUBSPOT_ACCESS_TOKEN not configured (or placeholder) - contact sync disabled',
      );
    }
  }

  isConfigured(): boolean {
    return !!this.accessToken && !this.authDisabled;
  }

  /**
   * Create or update a contact in HubSpot by email.
   * No-op when token is not configured or HubSpot rejected auth (401).
   */
  async createOrUpdateContact(
    properties: HubSpotContactProperties,
  ): Promise<void> {
    if (!this.isConfigured() || !this.accessToken) return;

    const email = properties.email?.trim()?.toLowerCase();
    if (!email) {
      this.logger.warn('[HubSpot] Skipping sync: missing email');
      return;
    }

    const contactProperties: Record<string, string> = {
      email,
      ...(properties.firstname && { firstname: properties.firstname.trim() }),
      ...(properties.lastname && { lastname: properties.lastname.trim() }),
      ...(properties.phone && { phone: properties.phone.trim() }),
      ...(properties.company && { company: properties.company.trim() }),
      ...(properties.city && { city: properties.city.trim() }),
      ...(properties.state && { state: properties.state.trim() }),
      ...(properties.zip && { zip: properties.zip.trim() }),
      ...(properties.jobtitle && { jobtitle: properties.jobtitle.trim() }),
      ...(properties.npi_number && {
        npi_number: String(properties.npi_number).trim(),
      }),
    };

    const body = {
      inputs: [
        { id: email, idProperty: 'email', properties: contactProperties },
      ],
    };

    try {
      const res = await fetch(
        `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/batch/upsert`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 401) {
          this.authDisabled = true;
          if (!this.authFailureLogged) {
            this.authFailureLogged = true;
            this.logger.warn(
              `[HubSpot] Auth failed (401) — disabling contact sync for this process. Set a valid private-app token in Secrets Manager (hubspot_access_token), or clear it to silence sync. Detail: ${errText}`,
            );
          }
          return;
        }
        this.logger.error(
          `[HubSpot] Upsert failed: ${res.status} ${res.statusText} - ${errText}`,
        );
        return;
      }

      this.logger.debug(`[HubSpot] Contact synced: ${email}`);
    } catch (err) {
      this.logger.error(`[HubSpot] Sync error for ${email}:`, err);
    }
  }
}
