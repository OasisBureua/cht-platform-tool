import { Controller, Get, Post, Body, Param, Logger, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CheckUserGuard } from '../../auth/check-user.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.service';
import { ProgramsService } from './programs.service';
import { ProgramRegistrationsService } from './program-registrations.service';
import { EnrollUserDto, EnrollmentResponseDto } from './dto/enroll-user.dto';
import { ProgramResponseDto } from './dto/program-response.dto';
import { UpdateVideoProgressDto, VideoProgressResponseDto } from './dto/update-video-progress.dto';

@Controller('programs')
export class ProgramsController {
  private readonly logger = new Logger(ProgramsController.name);

  constructor(
    private readonly programsService: ProgramsService,
    private readonly registrationsService: ProgramRegistrationsService,
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
   * GET /api/programs/:id/slots — published office-hours time slots (public)
   */
  @Get(':id/slots')
  async listSlots(@Param('id') id: string) {
    return this.registrationsService.listSlotsForProgram(id);
  }

  /**
   * GET /api/programs/:id/registration — current user’s registration row (auth)
   */
  @Get(':id/registration')
  @UseGuards(JwtAuthGuard)
  async getMyRegistration(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.registrationsService.getMyRegistration(user.userId, id);
  }

  /**
   * POST /api/programs/:id/registration — submit registration (auth)
   */
  @Post(':id/registration')
  @UseGuards(JwtAuthGuard)
  async submitRegistration(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { officeHoursSlotId?: string; intakeJotformSubmissionId?: string },
  ) {
    return this.registrationsService.submitRegistration(user.userId, id, body ?? {});
  }

  /**
   * GET /api/programs/:id/calendly-scheduling
   * Calendly URL for published office-hours programs — enrolled users only (sign-in + /app).
   */
  @Get(':id/calendly-scheduling')
  @UseGuards(JwtAuthGuard)
  async getCalendlyScheduling(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.programsService.getCalendlySchedulingForEnrolledUser(user.userId, id);
  }

  /**
   * GET /api/programs/:id
   * Get single program by ID (public)
   */
  @Get(':id')
  async getProgramById(@Param('id') id: string): Promise<ProgramResponseDto> {
    this.logger.log(`Getting program: ${id}`);
    return this.programsService.getProgramById(id);
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
    this.logger.log(`Enrolling user ${user.userId} in program ${dto.programId}`);
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
