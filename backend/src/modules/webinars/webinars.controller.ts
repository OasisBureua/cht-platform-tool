import {
  Controller,
  Get,
  Param,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { WebinarsService, WebinarItem } from './webinars.service';

@Controller('webinars')
export class WebinarsController {
  private readonly logger = new Logger(WebinarsController.name);

  constructor(private readonly webinarsService: WebinarsService) {}

  /**
   * GET /api/webinars
   * Public – list webinars from Zoom API and/or database programs.
   */
  @Get()
  async listWebinars(): Promise<WebinarItem[]> {
    this.logger.log('Listing webinars');
    return this.webinarsService.listWebinars();
  }

  /**
   * GET /api/webinars/:id
   * Public – get single webinar by ID.
   */
  @Get(':id')
  async getWebinar(@Param('id') id: string): Promise<WebinarItem> {
    this.logger.log(`Getting webinar ${id}`);
    const webinar = await this.webinarsService.getWebinarById(id);
    if (!webinar) throw new NotFoundException('Webinar not found');
    return webinar;
  }
}
