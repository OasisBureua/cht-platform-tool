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
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { UserRole, UserStatus, PaymentStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { ProgramsService } from '../programs/programs.service';
import { SurveysService } from '../surveys/surveys.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ZoomService } from '../webinars/zoom.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { CreateSurveyDto } from './dto/create-survey.dto';
import { CreateSurveyFromJotformDto } from './dto/create-survey-from-jotform.dto';
import { UpdateProgramStatusDto } from './dto/update-program-status.dto';
import { UpdateSurveyDto } from './dto/update-survey.dto';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private programsService: ProgramsService,
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
  @ApiOperation({ summary: 'Get admin config (e.g. Jotform template ID for webinar surveys)' })
  getAdminConfig() {
    return {
      jotformTemplateFormId: this.config.get<string>('jotform.templateFormId') || '260698533879881',
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
    if (dto.createSurveyFromTemplate?.trim()) {
      await this.surveysService.createSurveyFromJotformTemplate({
        programId: program.id,
        templateFormId: dto.createSurveyFromTemplate.trim(),
        title: `${program.title} - Post Event Survey`,
        type: 'FEEDBACK',
      });
    }
    return program;
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
        createSurveyFromTemplate: { type: 'string' },
        status: { type: 'string', enum: ['DRAFT', 'PUBLISHED'], default: 'PUBLISHED' },
        zoomSessionType: { type: 'string', enum: ['WEBINAR', 'MEETING'], default: 'WEBINAR' },
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
      createSurveyFromTemplate?: string;
      status?: 'DRAFT' | 'PUBLISHED';
      zoomSessionType?: 'WEBINAR' | 'MEETING';
    },
  ) {
    if (!body.title?.trim()) throw new BadRequestException('title is required');
    if (!body.startDate) throw new BadRequestException('startDate is required');
    if (!body.duration || body.duration < 1) throw new BadRequestException('duration (minutes) is required');

    const sessionType = body.zoomSessionType ?? 'WEBINAR';

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
    });

    if (sessionType === 'WEBINAR' && body.createSurveyFromTemplate?.trim()) {
      await this.surveysService.createSurveyFromJotformTemplate({
        programId: program.id,
        templateFormId: body.createSurveyFromTemplate.trim(),
        title: `${program.title} - Post Event Survey`,
        type: 'FEEDBACK',
      });
    }

    return {
      ...program,
      zoomMeetingId: zoomMeetingId ?? null,
      zoomJoinUrl: zoomJoinUrl ?? null,
      zoomStartUrl: zoomStartUrl ?? null,
      ...(zoomError ? { zoomWarning: `Session saved but Zoom sync failed: ${zoomError}` } : {}),
    };
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
    },
  ) {
    const existing = await this.prisma.program.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Webinar not found');

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
