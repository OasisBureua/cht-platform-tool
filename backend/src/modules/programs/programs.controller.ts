import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Logger,
  UseGuards,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { FormJotformScope } from './form-jotform-scope';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../auth/optional-jwt-auth.guard';
import { CheckUserGuard } from '../../auth/check-user.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.service';
import { ProgramsService } from './programs.service';
import { ProgramRegistrationsService } from './program-registrations.service';
import { FormJotformProgressService } from './form-jotform-progress.service';
import { PaymentsService } from '../payments/payments.service';
import { EnrollUserDto, EnrollmentResponseDto } from './dto/enroll-user.dto';
import { ProgramResponseDto } from './dto/program-response.dto';
import {
  UpdateVideoProgressDto,
  VideoProgressResponseDto,
} from './dto/update-video-progress.dto';

@Controller('programs')
export class ProgramsController {
  private readonly logger = new Logger(ProgramsController.name);

  constructor(
    private readonly programsService: ProgramsService,
    private readonly registrationsService: ProgramRegistrationsService,
    private readonly formJotformProgress: FormJotformProgressService,
    private readonly paymentsService: PaymentsService,
  ) {}

  /**
   * GET /api/programs
   * Get all published programs (public)
   */
  @Get()
  async getAllPrograms(): Promise<ProgramResponseDto[]> {
    this.logger.log('Getting all programs');
    return this.programsService.getAllPrograms();
  }

  /**
   * GET /api/programs/enrollments/:userId
   * Must be registered before GET :id so "enrollments" is not captured as id.
   */
  @Get('enrollments/:userId')
  @UseGuards(JwtAuthGuard, CheckUserGuard)
  async getUserEnrollments(@Param('userId') userId: string) {
    this.logger.log(`Getting enrollments for user: ${userId}`);
    return this.programsService.getUserEnrollments(userId);
  }

  /**
   * GET /api/programs/live-action-items
   * Derived webinar reminders (invitation + post-event Jotform) for the current user.
   */
  @Get('live-action-items')
  @UseGuards(JwtAuthGuard)
  async getLiveActionItems(@CurrentUser() user: AuthUser) {
    return this.programsService.getLiveWebinarActionItems(user.userId);
  }

  /**
   * GET /api/programs/me/live-session-status — enrollment / registration per LIVE or Office Hours program (auth).
   */
  @Get('me/live-session-status')
  @UseGuards(JwtAuthGuard)
  async getMyLiveSessionStatus(@CurrentUser() user: AuthUser) {
    return this.registrationsService.getMyLiveSessionStatusForLists(
      user.userId,
    );
  }

  /**
   * GET /api/programs/:id/slots — published office-hours time slots (public)
   */
  @Get(':id/slots')
  async listSlots(@Param('id') id: string) {
    return this.registrationsService.listSlotsForProgram(id);
  }

  /**
   * GET /api/programs/:id/registration - current user’s registration row (auth)
   */
  @Get(':id/registration')
  @UseGuards(JwtAuthGuard)
  async getMyRegistration(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.registrationsService.getMyRegistration(user.userId, id);
  }

  /**
   * POST /api/programs/:id/registration - submit registration (auth)
   */
  @Post(':id/registration')
  @UseGuards(JwtAuthGuard)
  async submitRegistration(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body()
    body: { officeHoursSlotId?: string; intakeJotformSubmissionId?: string },
  ) {
    return this.registrationsService.submitRegistration(
      user.userId,
      id,
      body ?? {},
    );
  }

  /**
   * POST /api/programs/:id/post-event/acknowledge-survey — learner confirms post-event Jotform submitted (after attendance verified).
   */
  @Post(':id/post-event/acknowledge-survey')
  @UseGuards(JwtAuthGuard)
  async acknowledgePostEventSurvey(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.registrationsService.acknowledgePostEventSurvey(
      user.userId,
      id,
    );
  }

  /**
   * POST /api/programs/:id/post-event/request-honorarium — learner confirms payout details; enqueues payment job (worker inserts PENDING row).
   */
  @Post(':id/post-event/request-honorarium')
  @UseGuards(JwtAuthGuard)
  async requestPostEventHonorarium(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.registrationsService.requestPostEventHonorariumPayout(
      user.userId,
      id,
    );
  }

  /**
   * GET /api/programs/:id/honorarium-preview — masked payout summary for honorarium confirmation step.
   */
  @Get(':id/honorarium-preview')
  @UseGuards(JwtAuthGuard)
  async getHonorariumPreview(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentsService.getHonorariumProgramPreview(user.userId, id);
  }

  /**
   * GET /api/programs/:id/jotform-resume — saved Jotform “Save & Continue” session (24h), if any
   */
  @Get(':id/jotform-resume')
  @UseGuards(JwtAuthGuard)
  async getIntakeJotformResume(
    @Param('id') programId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.formJotformProgress.getResumeSession(
      user.userId,
      FormJotformScope.INTAKE,
      programId,
    );
  }

  /**
   * PUT /api/programs/:id/jotform-resume — store session id (extends expiry to 24h from now)
   */
  @Put(':id/jotform-resume')
  @UseGuards(JwtAuthGuard)
  async putIntakeJotformResume(
    @Param('id') programId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { sessionId?: string },
  ) {
    if (!body.sessionId?.trim()) {
      throw new BadRequestException('sessionId is required');
    }
    await this.formJotformProgress.saveResumeSession(
      user.userId,
      FormJotformScope.INTAKE,
      programId,
      body.sessionId,
    );
    return { ok: true as const };
  }

  /**
   * GET /api/programs/:id
   * Get single program by ID (public). Zoom host start URL is returned only when the caller is an authenticated admin.
   */
  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async getProgramById(
    @Param('id') id: string,
    @Req() req: Request & { user?: AuthUser },
  ): Promise<ProgramResponseDto> {
    this.logger.log(`Getting program: ${id}`);
    const includeZoomHostLink = req.user?.role === UserRole.ADMIN;
    return this.programsService.getProgramById(id, { includeZoomHostLink });
  }

  /**
   * POST /api/programs/enroll
   * Enroll user in program (auth required; uses authenticated user ID)
   */
  @Post('enroll')
  @UseGuards(JwtAuthGuard)
  async enrollUser(
    @CurrentUser() user: AuthUser,
    @Body() dto: EnrollUserDto,
  ): Promise<EnrollmentResponseDto> {
    const enrollDto = { ...dto, userId: user.userId };
    this.logger.log(
      `Enrolling user ${user.userId} in program ${dto.programId}`,
    );
    return this.programsService.enrollUser(enrollDto);
  }

  /**
   * POST /api/programs/video-progress
   * Update video progress (auth required; uses authenticated user ID)
   */
  @Post('video-progress')
  @UseGuards(JwtAuthGuard)
  async updateVideoProgress(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateVideoProgressDto,
  ): Promise<VideoProgressResponseDto> {
    const progressDto = { ...dto, userId: user.userId };
    this.logger.debug(`Updating video progress for user: ${user.userId}`);
    return this.programsService.updateVideoProgress(progressDto);
  }
}
