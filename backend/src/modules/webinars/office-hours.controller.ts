import { Controller, Get, Param, Logger, NotFoundException } from '@nestjs/common';
import { WebinarsService, WebinarItem } from './webinars.service';

@Controller('office-hours')
export class OfficeHoursController {
  private readonly logger = new Logger(OfficeHoursController.name);

  constructor(private readonly webinarsService: WebinarsService) {}

  @Get()
  async listOfficeHours(): Promise<WebinarItem[]> {
    this.logger.log('Listing office hours (Zoom meetings)');
    return this.webinarsService.listOfficeHours();
  }

  @Get(':id')
  async getOfficeHours(@Param('id') id: string): Promise<WebinarItem> {
    this.logger.log(`Getting office hours ${id}`);
    const item = await this.webinarsService.getOfficeHoursById(id);
    if (!item) throw new NotFoundException('Office hours session not found');
    return item;
  }
}
