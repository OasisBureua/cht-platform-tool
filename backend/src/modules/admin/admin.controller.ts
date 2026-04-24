import {
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Logger,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { UserRole, UserStatus, PaymentStatus, ProgramRegistrationStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.service';
import { ProgramsService } from '../programs/programs.service';
import { ProgramRegistrationsService } from '../programs/program-registrations.service';
import { SurveysService } from '../surveys/surveys.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ZoomService } from '../webinars/zoom.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { CreateSurveyDto } from './dto/create-survey.dto';
import { CreateSurveyFromJotformDto } from './dto/create-survey-from-jotform.dto';
import { UpdateProgramStatusDto } from './dto/update-program-status.dto';
import { UpdateSurveyDto } from './dto/update-survey.dto';
import { buildJotformIntakeSubmissionViewUrl } from '../../utils/jotform-intake-view-url';
import { effectiveWebinarIntakeFormUrl } from '../../utils/webinar-intake-url';

/** Latest activity for a registration row (resubmits bump updatedAt / intakeJotformSubmittedAt; createdAt is first request only). */
function lastProgramRegistrationSubmittedAtIso(r: {
  createdAt: Date;
  updatedAt: Date;
  intakeJotformSubmittedAt: Date | null;
}): string {
  return new Date(
    Math.max(
      r.createdAt.getTime(),
      r.updatedAt.getTime(),
      r.intakeJotformSubmittedAt?.getTime() ?? 0,
    ),
  ).toISOString();
}

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private programsService: ProgramsService,
    private programRegistrations: ProgramRegistrationsService,
    private surveysService: SurveysService,
    private prisma: PrismaService,
    private config: ConfigService,
    private zoom: ZoomService,
  ) {}

  // ─── Bootstrap (no auth — first-admin setup) ─────────────────────────────

  /**
   * POST /api/admin/bootstrap
   * One-time endpoint to promote the first admin.
   * Protected by ADMIN_BOOTSTRAP_SECRET env var.
   * Safe to call repeatedly — always requires the secret.
   */
  @Post('bootstrap')
  @ApiOperation({
    summary: 'Bootstrap first admin',
    description:
      'Promotes an existing user to ADMIN role. Requires the ADMIN_BOOTSTRAP_SECRET header. ' +
      'Set ADMIN_BOOTSTRAP_SECRET in AWS Secrets Manager / environment variables.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'secret'],
      properties: {
        email: { type: 'string', example: 'you@example.com' },
        secret: { type: 'string', description: 'Must match ADMIN_BOOTSTRAP_SECRET env var' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'User promoted to ADMIN' })
  @ApiResponse({ status: 403, description: 'Invalid bootstrap secret' })
  @ApiResponse({ status: 400, description: 'User not found or ADMIN_BOOTSTRAP_SECRET not configured' })
  async bootstrapAdmin(
    @Body('email') email: string,
    @Body('secret') secret: string,
  ) {
    const bootstrapSecret = this.config.get<string>('adminBootstrapSecret');
    if (!bootstrapSecret) {
      throw new BadRequestException('ADMIN_BOOTSTRAP_SECRET is not configured on this server.');
    }
    if (!secret || secret !== bootstrapSecret) {
      throw new ForbiddenException('Invalid bootstrap secret.');
    }
    if (!email?.trim()) {
      throw new BadRequestException('email is required.');
    }
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, email: true, role: true },
    });
    if (!user) {
      throw new BadRequestException(`No user found with email: ${email}`);
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.ADMIN },
      select: { id: true, email: true, role: true },
    });
    return { promoted: true, user: updated };
  }

  // ─── Protected endpoints (ADMIN role required) ────────────────────────────

  @Get('config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({
    summary: 'Get admin config (Jotform webinar template form IDs from env — used when scheduling webinars)',
  })
  getAdminConfig() {
    const invitation =
      this.config.get<string>('jotform.invitationTemplateFormId')?.trim() || '';
    const postEvent = this.config.get<string>('jotform.postEventTemplateFormId')?.trim() || '';
    const postEventShared =
      this.config.get<string>('jotform.postEventSharedFormId')?.trim() || '';
    return {
      jotformInvitationTemplateFormId: invitation,
      jotformPostEventTemplateFormId: postEvent,
      jotformPostEventSharedFormId: postEventShared,
      /** @deprecated use jotformPostEventTemplateFormId */
      jotformTemplateFormId: postEvent,
      webinarJotformTemplatesConfigured: !!(invitation && (postEvent || postEventShared)),
    };
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Get admin dashboard stats' })
  @ApiResponse({ status: 200, description: 'Dashboard stats (active HCPs, etc.)' })
  async getStats() {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [activeHcpsCount, activeHcpsCountPreviousWeek, paymentsPaidCount] = await Promise.all([
      this.prisma.user.count({
        where: {
          role: UserRole.HCP,
          status: UserStatus.ACTIVE,
        },
      }),
      this.prisma.user.count({
        where: {
          role: UserRole.HCP,
          status: UserStatus.ACTIVE,
          createdAt: { lte: oneWeekAgo },
        },
      }),
      this.prisma.payment.count({
        where: { status: PaymentStatus.PAID },
      }),
    ]);
    const pct =
      activeHcpsCountPreviousWeek === 0
        ? activeHcpsCount > 0
          ? '+100%'
          : '0%'
        : `${Math.round(((activeHcpsCount - activeHcpsCountPreviousWeek) / activeHcpsCountPreviousWeek) * 100)}%`;
    this.logger.debug(`[Admin] stats: activeHcps=${activeHcpsCount} activeHcpsPrevWeek=${activeHcpsCountPreviousWeek} change=${pct}`);
    return { activeHcpsCount, activeHcpsCountPreviousWeek, paymentsPaidCount };
  }

  @Get('programs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'List all programs (admin)' })
  getAllPrograms() {
    return this.programsService.getAllProgramsForAdmin();
  }

  @Post('programs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Create a new program' })
  async createProgram(@Body() dto: CreateProgramDto) {
    const program = await this.programsService.createProgram(dto);
    // Webinar invitation + post-event Jotform clones are created via POST /admin/webinars or Zoom import (WEBINAR).
    return program;
  }

  @Get('programs/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Single program (admin hub — forms, registration counts)' })
  async getProgramByIdForAdmin(@Param('id') id: string) {
    const p = await this.prisma.program.findUnique({
      where: { id },
      include: {
        surveys: { select: { id: true, title: true, jotformFormId: true, type: true } },
        officeHoursSlots: { orderBy: [{ sortOrder: 'asc' }, { startsAt: 'asc' }] },
        _count: { select: { enrollments: true, programRegistrations: true, officeHoursSlots: true } },
      },
    });
    if (!p) throw new NotFoundException('Program not found');
    return p;
  }

  @Patch('programs/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Update program status (DRAFT / PUBLISHED / ARCHIVED)' })
  @ApiParam({ name: 'id', description: 'Program ID' })
  updateProgramStatus(
    @Param('id') id: string,
    @Body() dto: UpdateProgramStatusDto,
  ) {
    return this.programsService.updateProgramStatus(id, dto.status);
  }

  @Post('surveys')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Create a survey' })
  createSurvey(@Body() dto: CreateSurveyDto) {
    return this.surveysService.createSurvey(dto);
  }

  @Post('surveys/from-jotform-template')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Clone a Jotform template and create a Survey' })
  createSurveyFromJotformTemplate(@Body() dto: CreateSurveyFromJotformDto) {
    return this.surveysService.createSurveyFromJotformTemplate(dto);
  }

  @Patch('surveys/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Update survey (Jotform form ID); FEEDBACK surveys also update program post-event URL' })
  @ApiParam({ name: 'id', description: 'Survey ID' })
  updateSurvey(@Param('id') id: string, @Body() dto: UpdateSurveyDto) {
    return this.surveysService.updateSurvey(id, dto);
  }

  @Delete('surveys/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Delete a survey' })
  @ApiParam({ name: 'id', description: 'Survey ID' })
  deleteSurvey(@Param('id') id: string) {
    return this.surveysService.deleteSurvey(id);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Search users (server-side)' })
  @ApiQuery({ name: 'q', required: false, description: 'Search by name or email' })
  @ApiQuery({ name: 'role', required: false, description: 'Filter by role (HCP, KOL, ADMIN)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (default 50)' })
  async getUsers(
    @Query('q') q?: string,
    @Query('role') role?: string,
    @Query('limit') limit?: string,
  ) {
    const take = Math.min(parseInt(limit ?? '50', 10) || 50, 200);
    const where: Record<string, unknown> = {};

    if (q?.trim()) {
      const term = q.trim();
      where.OR = [
        { email: { contains: term, mode: 'insensitive' } },
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (role && ['HCP', 'KOL', 'ADMIN'].includes(role.toUpperCase())) {
      where.role = role.toUpperCase() as UserRole;
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return users;
  }

  @Patch('users/:userId/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Promote or demote a user role' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['role'],
      properties: {
        role: { type: 'string', enum: ['HCP', 'KOL', 'ADMIN'] },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Role updated' })
  async updateUserRole(
    @Param('userId') userId: string,
    @Body('role') role: UserRole,
  ) {
    if (!role || !['HCP', 'KOL', 'ADMIN'].includes(role)) {
      throw new BadRequestException('Invalid role. Must be HCP, KOL, or ADMIN.');
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, role: true },
    });
    return updated;
  }

  @Delete('users/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({
    summary: 'Delete an HCP or KOL user',
    description:
      'Removes the user and cascaded data (enrollments, registrations, etc.). Admin accounts cannot be deleted. You cannot delete yourself.',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  async deleteParticipantUser(@Param('userId') userId: string, @CurrentUser() admin: AuthUser) {
    if (userId === admin.userId) {
      throw new BadRequestException('You cannot delete your own account.');
    }
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, email: true },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === UserRole.ADMIN) {
      throw new ForbiddenException('Admin accounts cannot be deleted from the portal.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { userId } });
      await tx.programRegistration.updateMany({
        where: { reviewedByUserId: userId },
        data: { reviewedByUserId: null },
      });
      await tx.webinarParticipantEvent.updateMany({
        where: { userId },
        data: { userId: null },
      });
      await tx.user.delete({ where: { id: userId } });
    });
    this.logger.log(`Admin ${admin.userId} deleted user ${userId} (${target.email})`);
    return { deleted: true, id: userId };
  }

  // ─── Admin Webinar Management ─────────────────────────────────────────────

  @Get('webinars')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'List webinars or office hours (Zoom + Programs) for admin' })
  @ApiQuery({
    name: 'zoomSessionType',
    required: false,
    enum: ['WEBINAR', 'MEETING'],
    description: 'Filter by session type (default: all)',
  })
  async listAdminWebinars(@Query('zoomSessionType') zoomSessionType?: 'WEBINAR' | 'MEETING') {
    const programs = await this.prisma.program.findMany({
      where:
        zoomSessionType === 'WEBINAR' || zoomSessionType === 'MEETING'
          ? { zoomSessionType }
          : undefined,
      orderBy: { startDate: 'desc' },
      take: 100,
    });

    let zoomWebinars: Awaited<ReturnType<ZoomService['listWebinars']>> = [];
    let zoomMeetings: Awaited<ReturnType<ZoomService['listScheduledMeetings']>> = [];
    if (this.zoom.isConfigured()) {
      zoomWebinars = await this.zoom.listWebinars();
      zoomMeetings = await this.zoom.listScheduledMeetings();
    }

    const webinarById = new Map(zoomWebinars.map((w) => [w.id, w]));
    const meetingById = new Map(zoomMeetings.map((m) => [m.id, m]));

    const result = programs.map((p) => {
      const zoom =
        p.zoomMeetingId && p.zoomSessionType === 'MEETING'
          ? meetingById.get(p.zoomMeetingId)
          : p.zoomMeetingId
            ? webinarById.get(p.zoomMeetingId)
            : undefined;
      return {
        id: p.id,
        title: p.title,
        description: p.description,
        status: p.status,
        startDate: p.startDate?.toISOString() ?? null,
        duration: p.duration ?? null,
        zoomSessionType: p.zoomSessionType,
        zoomMeetingId: p.zoomMeetingId ?? null,
        zoomJoinUrl: zoom?.joinUrl ?? p.zoomJoinUrl ?? null,
        zoomStartUrl: zoom?.startUrl ?? p.zoomStartUrl ?? null,
        sponsorName: p.sponsorName,
        creditAmount: p.creditAmount,
        honorariumAmount:
          p.zoomSessionType === 'WEBINAR' && p.honorariumAmount != null
            ? p.honorariumAmount / 100
            : undefined,
        createdAt: p.createdAt.toISOString(),
      };
    });

    return result;
  }

  @Post('webinars')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Create a webinar — schedules on Zoom and saves to DB' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'startDate', 'duration'],
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        sponsorName: { type: 'string' },
        startDate: { type: 'string', description: 'ISO 8601 datetime' },
        duration: { type: 'number', description: 'Duration in minutes' },
        timezone: { type: 'string', default: 'America/New_York' },
        status: { type: 'string', enum: ['DRAFT', 'PUBLISHED'], default: 'PUBLISHED' },
        zoomSessionType: { type: 'string', enum: ['WEBINAR', 'MEETING'], default: 'WEBINAR' },
        postEventJotformFormIdOrUrl: {
          type: 'string',
          description:
            'Optional. Jotform form ID or URL for post-event (FEEDBACK) survey; saved to Surveys and program hub.',
        },
        jotformIntakeFormUrl: {
          type: 'string',
          description:
            'Required for WEBINAR. Registration / invitation Jotform URL used for learner intake.',
        },
        honorariumAmount: {
          type: 'number',
          description:
            'Optional. Honorarium in USD for learners (stored as cents). WEBINAR only; not allowed for Office Hours (MEETING).',
        },
      },
    },
  })
  async createAdminWebinar(
    @Body() body: {
      title: string;
      description?: string;
      sponsorName?: string;
      startDate: string;
      duration: number;
      timezone?: string;
      status?: 'DRAFT' | 'PUBLISHED';
      zoomSessionType?: 'WEBINAR' | 'MEETING';
      /** When set for WEBINAR, clones invitation from template then uses this form for post-event (skips env post template). For MEETING, only attaches this survey. */
      postEventJotformFormIdOrUrl?: string;
      /** WEBINAR: required per-session intake URL. */
      jotformIntakeFormUrl?: string;
      /** WEBINAR only. Dollars (e.g. 250 = $250); stored as cents on Program. */
      honorariumAmount?: number;
    },
  ) {
    if (!body.title?.trim()) throw new BadRequestException('title is required');
    if (!body.startDate) throw new BadRequestException('startDate is required');
    if (!body.duration || body.duration < 1) throw new BadRequestException('duration (minutes) is required');

    const sessionType = body.zoomSessionType ?? 'WEBINAR';

    if (sessionType === 'MEETING' && body.honorariumAmount != null) {
      throw new BadRequestException(
        'Honorarium is only supported for Zoom Webinars. Remove honorariumAmount when scheduling Office Hours.',
      );
    }
    if (
      sessionType === 'WEBINAR' &&
      body.honorariumAmount != null &&
      (typeof body.honorariumAmount !== 'number' || body.honorariumAmount < 0)
    ) {
      throw new BadRequestException('honorariumAmount must be a non-negative number (USD).');
    }

    if (sessionType === 'WEBINAR' && !body.jotformIntakeFormUrl?.trim()) {
      throw new BadRequestException('Jotform intake URL is required for webinars.');
    }

    let zoomMeetingId: string | undefined;
    let zoomJoinUrl: string | undefined;
    let zoomStartUrl: string | undefined;
    let zoomError: string | undefined;

    if (this.zoom.isConfigured()) {
      try {
        if (sessionType === 'MEETING') {
          const created = await this.zoom.createMeetingForOfficeHours({
            topic: body.title.trim(),
            agenda: body.description?.trim(),
            startTime: body.startDate,
            duration: body.duration,
            timezone: body.timezone,
          });
          zoomMeetingId = created.id;
          zoomJoinUrl = created.joinUrl;
          zoomStartUrl = created.startUrl;
        } else {
          const created = await this.zoom.createWebinar({
            topic: body.title.trim(),
            agenda: body.description?.trim(),
            startTime: body.startDate,
            duration: body.duration,
            timezone: body.timezone,
          });
          zoomMeetingId = created.id;
          zoomJoinUrl = created.joinUrl;
          zoomStartUrl = created.startUrl;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Zoom create (${sessionType}) failed (saving to DB without Zoom): ${msg}`);
        zoomError = msg;
      }
    }

    let jotformFormsWarning: string | undefined;

    const manualIntakeUrl = body.jotformIntakeFormUrl?.trim();

    const program = await this.programsService.createProgram({
      title: body.title.trim(),
      description: body.description?.trim() || body.title.trim(),
      sponsorName: body.sponsorName?.trim() || 'General',
      startDate: body.startDate,
      duration: body.duration,
      zoomMeetingId,
      zoomJoinUrl,
      zoomStartUrl,
      status: body.status ?? 'PUBLISHED',
      zoomSessionType: sessionType,
      registrationRequiresApproval: true,
      ...(sessionType === 'WEBINAR' &&
      body.honorariumAmount != null &&
      body.honorariumAmount > 0
        ? { honorariumAmount: body.honorariumAmount }
        : {}),
      ...(sessionType === 'WEBINAR' && manualIntakeUrl
        ? { jotformIntakeFormUrl: manualIntakeUrl }
        : {}),
    });

    const manualPost = body.postEventJotformFormIdOrUrl?.trim();

    if (sessionType === 'WEBINAR') {
      try {
        if (manualIntakeUrl) {
          if (manualPost) {
            await this.surveysService.applyManualPostEventJotform(program.id, program.title, manualPost);
          } else {
            await this.surveysService.createWebinarPostEventOnlyFromTemplates(program.id, program.title);
          }
        } else if (manualPost) {
          await this.surveysService.createWebinarInvitationAndManualPostSurvey(
            program.id,
            program.title,
            manualPost,
          );
        } else {
          await this.surveysService.createWebinarJotformPairFromTemplates(program.id, program.title);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Webinar Jotform clone failed for program ${program.id}: ${msg}`);
        jotformFormsWarning =
          'The webinar was saved, but the invitation and post-event Jotforms were not created automatically. ' +
          'This usually means Jotform templates or API access still need to be configured for this environment. ' +
          'You can add form URLs manually in Program hub, or ask your technical administrator to finish deployment setup and try again. ' +
          'Learner signup is not blocked.';
        if (manualPost) {
          try {
            await this.surveysService.applyManualPostEventJotform(program.id, program.title, manualPost);
            this.logger.log(`Saved manual post-event survey for program ${program.id} after invitation clone failure`);
          } catch (e2) {
            const m2 = e2 instanceof Error ? e2.message : String(e2);
            this.logger.warn(`Manual post-event survey could not be saved for program ${program.id}: ${m2}`);
          }
        }
      }
    } else if (manualPost) {
      try {
        await this.surveysService.applyManualPostEventJotform(program.id, program.title, manualPost);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Post-event Jotform for office hours program ${program.id}: ${msg}`);
      }
    }

    return {
      ...program,
      zoomMeetingId: zoomMeetingId ?? null,
      zoomJoinUrl: zoomJoinUrl ?? null,
      zoomStartUrl: zoomStartUrl ?? null,
      ...(zoomError ? { zoomWarning: `Session saved but Zoom sync failed: ${zoomError}` } : {}),
      ...(jotformFormsWarning ? { jotformFormsWarning } : {}),
    };
  }

  /**
   * Link an existing Zoom webinar or meeting (created outside this app) to a new Program so learners get the same
   * Jotform intake, admin approval, and in-app join flow as app-scheduled sessions.
   */
  @Post('webinars/import-from-zoom')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Import existing Zoom webinar/meeting into DB (same registration flow as in-app sessions)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['zoomId'],
      properties: {
        zoomId: { type: 'string', description: 'Numeric Zoom webinar or meeting ID' },
        zoomSessionType: { type: 'string', enum: ['WEBINAR', 'MEETING'], default: 'WEBINAR' },
        sponsorName: { type: 'string' },
      },
    },
  })
  async importZoomSession(
    @Body()
    body: {
      zoomId: string;
      zoomSessionType?: 'WEBINAR' | 'MEETING';
      sponsorName?: string;
    },
  ) {
    if (!this.zoom.isConfigured()) {
      throw new BadRequestException('Zoom API is not configured (ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET).');
    }
    const zoomId = body.zoomId?.trim();
    if (!zoomId) throw new BadRequestException('zoomId is required');
    const sessionType = body.zoomSessionType ?? 'WEBINAR';

    const existing = await this.prisma.program.findFirst({
      where: { zoomMeetingId: zoomId, zoomSessionType: sessionType },
      select: { id: true, title: true },
    });
    if (existing) {
      throw new ConflictException(
        `This Zoom ${sessionType} is already linked to program “${existing.title}” (${existing.id}). Open Admin → Program hub to manage it.`,
      );
    }

    const zoomData =
      sessionType === 'MEETING'
        ? await this.zoom.getMeetingById(zoomId)
        : await this.zoom.getWebinarById(zoomId);

    if (!zoomData) {
      throw new NotFoundException(
        sessionType === 'MEETING'
          ? `No Zoom meeting found for ID ${zoomId}. Use the meeting ID from the Zoom client or URL. The Server-to-Server OAuth app must have access to this meeting’s account.`
          : `No Zoom webinar found for ID ${zoomId}. Use the webinar ID from the Zoom web portal. The Server-to-Server OAuth app must belong to the same Zoom account as the webinar.`,
      );
    }

    const program = await this.programsService.createProgram({
      title: zoomData.topic.trim(),
      description: (zoomData.agenda?.trim() || zoomData.topic).trim(),
      sponsorName: body.sponsorName?.trim() || 'General',
      startDate: zoomData.startTime,
      duration: zoomData.duration,
      zoomMeetingId: zoomData.id,
      zoomJoinUrl: zoomData.joinUrl,
      zoomStartUrl: zoomData.startUrl,
      status: 'PUBLISHED',
      zoomSessionType: sessionType,
      registrationRequiresApproval: true,
    });

    let jotformFormsWarning: string | undefined;
    if (sessionType === 'WEBINAR') {
      try {
        await this.surveysService.createWebinarJotformPairFromTemplates(program.id, program.title);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Webinar Jotform clone failed for imported program ${program.id}: ${msg}`);
        jotformFormsWarning =
          'The webinar was saved, but the invitation and post-event Jotforms were not created automatically. ' +
          'This usually means Jotform templates or API access still need to be configured for this environment. ' +
          'You can add form URLs manually in Program hub, or ask your technical administrator to finish deployment setup and try again. ' +
          'Learner signup is not blocked.';
      }
    }

    this.logger.log(`Imported Zoom ${sessionType} ${zoomId} → program ${program.id}`);
    return {
      ...program,
      zoomMeetingId: zoomData.id,
      zoomJoinUrl: zoomData.joinUrl,
      zoomStartUrl: zoomData.startUrl,
      ...(jotformFormsWarning ? { jotformFormsWarning } : {}),
    };
  }

  // ─── Program hub: Jotform URLs, approval gate (office hours), slots, ICS invites ───

  @Patch('programs/:id/registration-settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Update program intake/pre-event forms, host label, manual approval before Zoom access' })
  async patchProgramRegistrationSettings(
    @Param('id') id: string,
    @Body()
    body: {
      jotformIntakeFormUrl?: string | null;
      jotformPreEventUrl?: string | null;
      hostDisplayName?: string | null;
      registrationRequiresApproval?: boolean;
    },
  ) {
    const exists = await this.prisma.program.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Program not found');
    const data: Record<string, unknown> = {};
    if (body.jotformIntakeFormUrl !== undefined) data.jotformIntakeFormUrl = body.jotformIntakeFormUrl;
    if (body.jotformPreEventUrl !== undefined) data.jotformPreEventUrl = body.jotformPreEventUrl;
    if (body.hostDisplayName !== undefined) data.hostDisplayName = body.hostDisplayName;
    if (body.registrationRequiresApproval !== undefined) {
      data.registrationRequiresApproval = body.registrationRequiresApproval;
    }
    return this.prisma.program.update({ where: { id }, data });
  }

  @Get('webinar-registrations/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Pending LIVE webinar and Office Hours registration requests (all programs)' })
  async listPendingWebinarRegistrations() {
    const rows = await this.programRegistrations.listPendingWebinarRegistrationsForAdmin();
    const defaultIntake = this.config.get<string>('jotform.webinarDefaultIntakeUrl')?.trim() || undefined;
    return rows.map((r) => {
      const intakeRequired = !!effectiveWebinarIntakeFormUrl(
        r.program.zoomSessionType,
        r.program.jotformIntakeFormUrl,
        defaultIntake,
      );
      const intakeComplete = !intakeRequired || !!r.intakeJotformSubmissionId?.trim();
      return {
        id: r.id,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        lastSubmittedAt: lastProgramRegistrationSubmittedAtIso(r),
        intakeJotformSubmissionId: r.intakeJotformSubmissionId,
        intakeRequired,
        intakeComplete,
        jotformIntakeSubmissionViewUrl: intakeRequired
          ? buildJotformIntakeSubmissionViewUrl(r.program.jotformIntakeFormUrl, r.intakeJotformSubmissionId)
          : null,
        user: r.user,
        program: r.program,
      };
    });
  }

  @Get('webinar-registrations/pending-attendance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({
    summary:
      'Approved learners waiting for post-event attendance verification (unlocks survey / honorarium flow)',
  })
  async listPendingPostEventAttendance() {
    const rows = await this.programRegistrations.listPendingPostEventAttendanceForAdmin();
    return rows.map((r) => ({
      id: r.id,
      postEventAttendanceStatus: r.postEventAttendanceStatus,
      createdAt: r.createdAt.toISOString(),
      user: r.user,
      program: r.program,
    }));
  }

  @Get('programs/:id/enrollments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'List users enrolled in a program (webinar admin view)' })
  async listProgramEnrollments(@Param('id') id: string) {
    const exists = await this.prisma.program.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Program not found');
    const rows = await this.programsService.listProgramEnrollmentsForAdmin(id);
    return rows.map((e) => ({
      id: e.id,
      enrolledAt: e.enrolledAt.toISOString(),
      completed: e.completed,
      overallProgress: e.overallProgress,
      user: e.user,
    }));
  }

  @Get('programs/:id/registrations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'List registration requests for a program (approve / pick invitees)' })
  async listProgramRegistrations(@Param('id') id: string) {
    const exists = await this.prisma.program.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Program not found');
    const rows = await this.programRegistrations.listRegistrationsForAdmin(id);
    const defaultIntake = this.config.get<string>('jotform.webinarDefaultIntakeUrl')?.trim() || undefined;
    return rows.map((r) => {
      const intakeRequired = !!effectiveWebinarIntakeFormUrl(
        r.program.zoomSessionType,
        r.program.jotformIntakeFormUrl,
        defaultIntake,
      );
      const intakeComplete = !intakeRequired || !!r.intakeJotformSubmissionId?.trim();
      return {
        id: r.id,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        lastSubmittedAt: lastProgramRegistrationSubmittedAtIso(r),
        reviewedAt: r.reviewedAt?.toISOString(),
        calendarInviteSentAt: r.calendarInviteSentAt?.toISOString(),
        adminNotes: r.adminNotes,
        intakeJotformSubmissionId: r.intakeJotformSubmissionId,
        intakeRequired,
        intakeComplete,
        jotformIntakeSubmissionViewUrl: intakeRequired
          ? buildJotformIntakeSubmissionViewUrl(r.program.jotformIntakeFormUrl, r.intakeJotformSubmissionId)
          : null,
        user: r.user,
        slot: r.slot
          ? {
              id: r.slot.id,
              startsAt: r.slot.startsAt.toISOString(),
              endsAt: r.slot.endsAt.toISOString(),
              label: r.slot.label,
            }
          : null,
        postEventAttendanceStatus: r.postEventAttendanceStatus,
        postEventAttendanceReviewedAt: r.postEventAttendanceReviewedAt?.toISOString(),
        postEventSurveyAcknowledgedAt: r.postEventSurveyAcknowledgedAt?.toISOString(),
        honorariumRequestedAt: r.honorariumRequestedAt?.toISOString(),
      };
    });
  }

  @Patch('registrations/:registrationId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Approve, reject, or waitlist a registration (approve creates enrollment)' })
  async adminUpdateRegistration(
    @Param('registrationId') registrationId: string,
    @Body()
    body: {
      status: ProgramRegistrationStatus;
      adminNotes?: string;
    },
    @CurrentUser() admin: AuthUser,
  ) {
    if (!body?.status || !Object.values(ProgramRegistrationStatus).includes(body.status)) {
      throw new BadRequestException('status must be a valid ProgramRegistrationStatus');
    }
    return this.programRegistrations.adminSetRegistrationStatus(
      admin.userId,
      registrationId,
      body.status,
      body.adminNotes,
    );
  }

  @Patch('registrations/:registrationId/post-event-attendance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Verify or deny post-event attendance (unlocks survey when verified)' })
  async adminPatchPostEventAttendance(
    @Param('registrationId') registrationId: string,
    @Body() body: { status: 'VERIFIED' | 'DENIED' },
    @CurrentUser() admin: AuthUser,
  ) {
    if (body?.status !== 'VERIFIED' && body?.status !== 'DENIED') {
      throw new BadRequestException('status must be VERIFIED or DENIED');
    }
    return this.programRegistrations.adminSetPostEventAttendance(
      admin.userId,
      registrationId,
      body.status,
    );
  }

  @Delete('programs/:programId/enrollments/:enrollmentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({
    summary: 'Remove a learner enrollment (revokes access); sets registration to rejected so they may re-register',
  })
  async adminRemoveProgramEnrollment(
    @Param('programId') programId: string,
    @Param('enrollmentId') enrollmentId: string,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.programRegistrations.adminRemoveEnrollment(admin.userId, programId, enrollmentId);
  }

  @Get('registrations/:registrationId/ics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Download .ics calendar invite for an approved registration' })
  async downloadRegistrationIcs(
    @Param('registrationId') registrationId: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const { filename, body } = await this.programRegistrations.buildIcsForRegistration(registrationId);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(body);
  }

  @Post('registrations/:registrationId/mark-calendar-sent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Record that a calendar invite was sent to the registrant' })
  async markCalendarInviteSent(@Param('registrationId') registrationId: string) {
    return this.programRegistrations.markCalendarInviteSent(registrationId);
  }

  @Post('programs/:id/slots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Add an office-hours time slot (aligned with Zoom meeting duration)' })
  async createOfficeHoursSlot(
    @Param('id') id: string,
    @Body() body: { startsAt: string; endsAt: string; label?: string; maxAttendees?: number; sortOrder?: number },
  ) {
    if (!body?.startsAt || !body?.endsAt) {
      throw new BadRequestException('startsAt and endsAt (ISO) are required');
    }
    return this.programRegistrations.createSlot(id, body);
  }

  @Delete('programs/:programId/slots/:slotId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Delete an office-hours slot' })
  async deleteOfficeHoursSlot(
    @Param('programId') programId: string,
    @Param('slotId') slotId: string,
  ) {
    const slot = await this.prisma.officeHoursSlot.findFirst({
      where: { id: slotId, programId },
    });
    if (!slot) throw new NotFoundException('Slot not found');
    return this.programRegistrations.deleteSlot(slotId);
  }

  @Get('programs/:id/form-links')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  async listProgramFormLinks(@Param('id') id: string) {
    const exists = await this.prisma.program.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Program not found');
    return this.programRegistrations.listFormLinks(id);
  }

  @Post('programs/:id/form-links')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  async addProgramFormLink(
    @Param('id') id: string,
    @Body() body: { kind: 'INTAKE' | 'PRE_EVENT' | 'POST_EVENT' | 'CUSTOM'; label: string; jotformUrl: string; sortOrder?: number },
  ) {
    if (!body?.label?.trim() || !body?.jotformUrl?.trim()) {
      throw new BadRequestException('label and jotformUrl are required');
    }
    return this.programRegistrations.addFormLink(id, body);
  }

  @Delete('program-form-links/:linkId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  async deleteProgramFormLink(@Param('linkId') linkId: string) {
    return this.programRegistrations.deleteFormLink(linkId);
  }

  @Patch('webinars/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Update a webinar (DB + Zoom sync)' })
  @ApiParam({ name: 'id', description: 'Program ID' })
  async updateAdminWebinar(
    @Param('id') id: string,
    @Body() body: {
      title?: string;
      description?: string;
      sponsorName?: string;
      startDate?: string;
      duration?: number;
      status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
      /** WEBINAR only. Dollars; omit to leave unchanged. Set to 0 to clear. */
      honorariumAmount?: number;
    },
  ) {
    const existing = await this.prisma.program.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Webinar not found');

    if (body.honorariumAmount !== undefined) {
      if (existing.zoomSessionType !== 'WEBINAR') {
        throw new BadRequestException('Honorarium can only be set on Zoom Webinar programs, not Office Hours.');
      }
      if (typeof body.honorariumAmount !== 'number' || body.honorariumAmount < 0) {
        throw new BadRequestException('honorariumAmount must be a non-negative number (USD).');
      }
    }

    if (existing.zoomMeetingId && this.zoom.isConfigured()) {
      if (existing.zoomSessionType === 'MEETING') {
        await this.zoom.updateMeeting(existing.zoomMeetingId, {
          topic: body.title,
          agenda: body.description,
          startTime: body.startDate,
          duration: body.duration,
        });
      } else {
        await this.zoom.updateWebinar(existing.zoomMeetingId, {
          topic: body.title,
          agenda: body.description,
          startTime: body.startDate,
          duration: body.duration,
        });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (body.title) updateData.title = body.title.trim();
    if (body.description !== undefined) updateData.description = body.description.trim();
    if (body.sponsorName) updateData.sponsorName = body.sponsorName.trim();
    if (body.startDate) updateData.startDate = new Date(body.startDate);
    if (body.duration !== undefined) updateData.duration = body.duration;
    if (body.status) updateData.status = body.status;
    if (body.honorariumAmount !== undefined && existing.zoomSessionType === 'WEBINAR') {
      updateData.honorariumAmount =
        body.honorariumAmount <= 0 ? null : Math.round(body.honorariumAmount * 100);
    }

    const updated = await this.prisma.program.update({ where: { id }, data: updateData });
    return updated;
  }

  @Delete('webinars/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Delete a webinar (DB + Zoom)' })
  @ApiParam({ name: 'id', description: 'Program ID' })
  async deleteAdminWebinar(@Param('id') id: string) {
    const existing = await this.prisma.program.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Webinar not found');

    if (existing.zoomMeetingId && this.zoom.isConfigured()) {
      if (existing.zoomSessionType === 'MEETING') {
        await this.zoom.deleteMeeting(existing.zoomMeetingId);
      } else {
        await this.zoom.deleteWebinar(existing.zoomMeetingId);
      }
    }

    await this.prisma.program.delete({ where: { id } });
    return { deleted: true, id };
  }
}
