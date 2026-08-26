import { Injectable } from '@nestjs/common';
import { OutboundSyncService } from '../outbound-sync/outbound-sync.service';
import { SubmitContactDto } from './dto/submit-contact.dto';

@Injectable()
export class ContactService {
  constructor(private readonly outboundSync: OutboundSyncService) {}

  async submit(dto: SubmitContactDto): Promise<{ received: boolean }> {
    const email = dto.email.trim().toLowerCase();
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();

    // Public contact form: HubSpot contact only (no NPI → MediaHub skipped).
    this.outboundSync
      .syncUser({
        email,
        firstName,
        lastName,
        institution: dto.organization?.trim() || null,
        specialty: dto.role?.trim() || null,
      })
      .catch(() => {});

    return { received: true };
  }
}
