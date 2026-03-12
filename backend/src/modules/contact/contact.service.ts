import { Injectable } from '@nestjs/common';
import { HubSpotService } from '../hubspot/hubspot.service';
import { SubmitContactDto } from './dto/submit-contact.dto';

@Injectable()
export class ContactService {
  constructor(private readonly hubspot: HubSpotService) {}

  async submit(dto: SubmitContactDto): Promise<{ received: boolean }> {
    const email = dto.email.trim().toLowerCase();
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();

    this.hubspot.createOrUpdateContact({
      email,
      firstname: firstName,
      lastname: lastName,
      company: dto.organization?.trim(),
      jobtitle: dto.role?.trim(),
    }).catch(() => {});

    return { received: true };
  }
}
