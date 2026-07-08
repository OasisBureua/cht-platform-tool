import { Body, Controller, Post } from '@nestjs/common';
import { ContactService } from './contact.service';
import { SubmitContactDto } from './dto/submit-contact.dto';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  /**
   * POST /api/contact
   * Public contact form - syncs to HubSpot. Rate-limited by ThrottlerGuard.
   */
  @Post()
  async submit(@Body() dto: SubmitContactDto) {
    return this.contactService.submit(dto);
  }
}
