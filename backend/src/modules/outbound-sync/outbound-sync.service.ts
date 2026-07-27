import { Injectable, Logger } from '@nestjs/common';
import { HubSpotService } from '../hubspot/hubspot.service';
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

export interface OutboundProgramEventInput extends OutboundSyncInput {
  programId: string;
  programTitle: string;
  registrationStatus: string;
  event:
    | 'survey_submitted'
    | 'registration_pending'
    | 'registration_approved'
    | 'registration_rejected'
    | 'registration_updated';
}

export interface OutboundSyncResult {
  hubspot: boolean;
  mediahub: boolean;
}

/**
 * Fan-out an NPI-bearing user update to HubSpot + MediaHub/Content Hub HCP roster.
 *
 * Contract: never throws. Any single destination's failure is logged but does
 * not block the other destinations. Returns per-destination booleans for
 * observability.
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
    private readonly mediahub: MediaHubSyncService,
  ) {}

  async syncUser(input: OutboundSyncInput): Promise<OutboundSyncResult> {
    const email = (input.email || '').trim().toLowerCase();
    const npi = (input.npiNumber || '').replace(/\D/g, '');
    const hasValidNpi = npi.length === 10;

    const hubspotPromise = this.hubspot.isConfigured()
      ? this.hubspot
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
          })
      : Promise.resolve(false);

    // MediaHub roster is NPI-keyed, skip HCPs without a valid NPI rather than
    // pushing noise. HubSpot still syncs (CRM contact surface).
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

    const [hubspot, mediahub] = await Promise.all([
      hubspotPromise,
      mediahubPromise,
    ]);

    this.logger.log(
      `[OutboundSync] ${email} npi=${hasValidNpi ? npi : 'none'} results: hubspot=${hubspot} mediahub=${mediahub}`,
    );

    return { hubspot, mediahub };
  }

  /**
   * Contact upsert + HubSpot timeline note for registration/survey lifecycle.
   * Never throws. MediaHub still only gets identity when NPI is valid.
   */
  async syncProgramEvent(
    input: OutboundProgramEventInput,
  ): Promise<OutboundSyncResult> {
    const email = (input.email || '').trim().toLowerCase();
    const npi = (input.npiNumber || '').replace(/\D/g, '');
    const hasValidNpi = npi.length === 10;

    const hubspotPromise = this.hubspot.isConfigured()
      ? this.hubspot
          .recordProgramActivity({
            contact: {
              email,
              firstname: input.firstName,
              lastname: input.lastName,
              jobtitle: input.specialty ?? undefined,
              company: input.institution ?? undefined,
              city: input.city ?? undefined,
              state: input.state ?? undefined,
              zip: input.zipCode ?? undefined,
              npi_number: hasValidNpi ? npi : undefined,
            },
            programId: input.programId,
            programTitle: input.programTitle,
            registrationStatus: input.registrationStatus,
            event: input.event,
          })
          .then(() => true)
          .catch((err) => {
            this.logger.error(
              `[OutboundSync] hubspot program-event error for ${email}:`,
              err,
            );
            return false;
          })
      : Promise.resolve(false);

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

    const [hubspot, mediahub] = await Promise.all([
      hubspotPromise,
      mediahubPromise,
    ]);

    this.logger.log(
      `[OutboundSync] program-event ${input.event} ${email} program=${input.programId} hubspot=${hubspot} mediahub=${mediahub}`,
    );

    return { hubspot, mediahub };
  }
}
