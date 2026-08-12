import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Logger,
  NotFoundException,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.service';
import {
  WebinarsService,
  WebinarItem,
  MeetingSdkAuthDto,
} from './webinars.service';

@Controller('office-hours')
export class OfficeHoursController {
  private readonly logger = new Logger(OfficeHoursController.name);

  constructor(private readonly webinarsService: WebinarsService) {}

  /**
   * POST /api/office-hours/:id/meeting-sdk-auth
   * Signed JWT for Zoom Meeting SDK embed (enrolled users only).
   */
  @Post(':id/meeting-sdk-auth')
  @UseGuards(JwtAuthGuard)
  async meetingSdkAuth(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<MeetingSdkAuthDto> {
    this.logger.log(`Meeting SDK auth for program ${id} user ${user.userId}`);
    return this.webinarsService.getOfficeHoursMeetingSdkAuth(user, id);
  }

  /**
   * POST /api/office-hours/:id/sdk-attendance
   * Client-side Meeting SDK join/leave → WebinarParticipantEvent.
   */
  @Post(':id/sdk-attendance')
  @UseGuards(JwtAuthGuard)
  async sdkAttendance(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { event?: string },
  ): Promise<{ ok: true }> {
    const event = body?.event === 'LEFT' ? 'LEFT' : body?.event === 'JOINED' ? 'JOINED' : null;
    if (!event) {
      throw new BadRequestException('event must be JOINED or LEFT');
    }
    return this.webinarsService.recordSdkAttendance(user, id, event, 'MEETING');
  }

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
