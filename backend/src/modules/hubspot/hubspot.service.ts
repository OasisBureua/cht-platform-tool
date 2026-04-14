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

@Injectable()
export class HubSpotService {
  private readonly logger = new Logger(HubSpotService.name);
  private readonly accessToken: string | null;

  constructor(private readonly config: ConfigService) {
    this.accessToken = this.config.get<string>('hubspot.accessToken')?.trim() || null;
    if (!this.accessToken) {
      this.logger.warn('HUBSPOT_ACCESS_TOKEN not configured — contact sync disabled');
    }
  }

  isConfigured(): boolean {
    return !!this.accessToken;
  }

  /**
   * Create or update a contact in HubSpot by email.
   * No-op when token is not configured.
   */
  async createOrUpdateContact(properties: HubSpotContactProperties): Promise<void> {
    if (!this.accessToken) return;

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
      ...(properties.npi_number && { npi_number: String(properties.npi_number).trim() }),
    };

    const body = {
      inputs: [{ id: email, idProperty: 'email', properties: contactProperties }],
    };

    try {
      const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/batch/upsert`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        this.logger.error(`[HubSpot] Upsert failed: ${res.status} ${res.statusText} - ${errText}`);
        return;
      }

      this.logger.debug(`[HubSpot] Contact synced: ${email}`);
    } catch (err) {
      this.logger.error(`[HubSpot] Sync error for ${email}:`, err);
    }
  }
}
