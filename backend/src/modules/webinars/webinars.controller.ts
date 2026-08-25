import {
  Body,
  Controller,
  Get,
  Param,
  Post,
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
   * POST /api/webinars/:id/meeting-sdk-auth
   * Signed JWT for Zoom Meeting SDK embed (approved/enrolled learners only).
   * Declared before :id GET so Nest does not treat "meeting-sdk-auth" as an id.
   */
  @Post(':id/meeting-sdk-auth')
  @UseGuards(JwtAuthGuard)
  async meetingSdkAuth(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body?: { asHost?: boolean },
  ): Promise<MeetingSdkAuthDto> {
    const asHost = !!body?.asHost;
    this.logger.log(
      `Webinar Meeting SDK auth for program ${id} user ${user.userId} asHost=${asHost}`,
    );
    return this.webinarsService.getWebinarMeetingSdkAuth(user, id, { asHost });
  }

  /**
   * POST /api/webinars/:id/sdk-attendance
   * Client-side Meeting SDK join/leave → WebinarParticipantEvent (complements Zoom webhooks).
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
    return this.webinarsService.recordSdkAttendance(user, id, event, 'WEBINAR');
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
