import { Injectable, Logger } from '@nestjs/common';
import { HubSpotService } from '../hubspot/hubspot.service';
import { MailchimpSyncService } from './mailchimp-sync.service';
import { MediaHubSyncService } from './mediahub-sync.service';

export interface OutboundSyncInput {
  email: string;
  firstName: string;
  lastName: string;
  npiNumber?: string | null;
  specialty?: string | null;
  institution?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}

export interface OutboundSyncResult {
  hubspot: boolean;
  mailchimp: boolean;
  mediahub: boolean;
}

/**
 * Fan-out an NPI-bearing user update to all external attribution systems.
 *
 * Contract: never throws. Any single destination's failure is logged but does
 * not block the other destinations (so a Mailchimp 500 can't silently break
 * HubSpot sync on signup). Returns per-destination booleans for observability.
 *
 * Called from:
 *   - auth.service.findOrCreateByAuthId (new-user path, after first DB insert)
 *   - dashboard.service.updateProfile  (profile-edit path)
 *   - backfill script (one-shot for existing users)
 */
@Injectable()
export class OutboundSyncService {
  private readonly logger = new Logger(OutboundSyncService.name);

  constructor(
    private readonly hubspot: HubSpotService,
    private readonly mailchimp: MailchimpSyncService,
    private readonly mediahub: MediaHubSyncService,
  ) {}

  async syncUser(input: OutboundSyncInput): Promise<OutboundSyncResult> {
    const email = (input.email || '').trim().toLowerCase();
    const npi = (input.npiNumber || '').replace(/\D/g, '');
    const hasValidNpi = npi.length === 10;

    const hubspotPromise = this.hubspot
      .createOrUpdateContact({
        email,
        firstname: input.firstName,
        lastname: input.lastName,
        jobtitle: input.specialty ?? undefined,
        company: input.institution ?? undefined,
        city: input.city ?? undefined,
        state: input.state ?? undefined,
        zip: input.zipCode ?? undefined,
        npi_number: hasValidNpi ? npi : undefined,
      })
      .then(() => true)
      .catch((err) => {
        this.logger.error(`[OutboundSync] hubspot error for ${email}:`, err);
        return false;
      });

    const mailchimpPromise = this.mailchimp.upsertMember({
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      npi: hasValidNpi ? npi : null,
      specialty: input.specialty,
      institution: input.institution,
      city: input.city,
      state: input.state,
    });

    // MediaHub roster is NPI-keyed — skip HCPs without a valid NPI rather than
    // pushing noise. HubSpot and Mailchimp still sync (lead-nurture surfaces).
    const mediahubPromise = hasValidNpi
      ? this.mediahub.upsertHCP({
          npi,
          firstName: input.firstName,
          lastName: input.lastName,
          email,
          specialty: input.specialty,
          institution: input.institution,
          city: input.city,
          state: input.state,
          zip: input.zipCode,
        })
      : Promise.resolve(false);

    const [hubspot, mailchimp, mediahub] = await Promise.all([
      hubspotPromise,
      mailchimpPromise,
      mediahubPromise,
    ]);

    this.logger.log(
      `[OutboundSync] ${email} npi=${hasValidNpi ? npi : 'none'} results: hubspot=${hubspot} mailchimp=${mailchimp} mediahub=${mediahub}`,
    );

    return { hubspot, mailchimp, mediahub };
  }
}
