import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ProgramZoomSessionType, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.service';
import { ZoomRecordingsCatalogService } from './zoom-recordings-catalog.service';
import { ZoomRecordingsPullService } from './zoom-recordings-pull.service';
import { ZoomRecordingsSyncService } from './zoom-recordings-sync.service';
import { ZoomAttendanceImportService } from './zoom-attendance-import.service';

function parseLinkedFilter(value?: string): boolean | undefined {
  if (!value?.trim()) return undefined;
  const v = value.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  throw new BadRequestException('linked must be true or false');
}

function serializeSyncJob(job: {
  id: string;
  status: string;
  monthsBack: number;
  sessionTypeFilter: ProgramZoomSessionType | null;
  fromDate: Date;
  toDate: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  startedByUserId: string | null;
  progressJson: unknown;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: job.id,
    status: job.status,
    monthsBack: job.monthsBack,
    sessionTypeFilter: job.sessionTypeFilter,
    fromDate: job.fromDate.toISOString(),
    toDate: job.toDate.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    startedByUserId: job.startedByUserId,
    progress: job.progressJson ?? null,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

function serializeAttendanceImportJob(job: {
  id: string;
  status: string;
  monthsBack: number;
  sessionTypeFilter: ProgramZoomSessionType | null;
  fromDate: Date;
  toDate: Date;
  runAutoVerify: boolean;
  startedAt: Date | null;
  finishedAt: Date | null;
  startedByUserId: string | null;
  progressJson: unknown;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: job.id,
    status: job.status,
    monthsBack: job.monthsBack,
    sessionTypeFilter: job.sessionTypeFilter,
    runAutoVerify: job.runAutoVerify,
    fromDate: job.fromDate.toISOString(),
    toDate: job.toDate.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    startedByUserId: job.startedByUserId,
    progress: job.progressJson ?? null,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

@ApiTags('Admin')
@ApiBearerAuth('session-token')
@Controller('admin/zoom-recordings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminZoomRecordingsController {
  constructor(
    private readonly catalog: ZoomRecordingsCatalogService,
    private readonly pullService: ZoomRecordingsPullService,
    private readonly sync: ZoomRecordingsSyncService,
    private readonly attendanceImport: ZoomAttendanceImportService,
  ) {}

  @Get('sessions')
  @ApiOperation({
    summary:
      'List Zoom recording sessions in the account catalog (LIVE → Zoom Recordings)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({
    name: 'linked',
    required: false,
    description: 'Filter by whether the session is linked to a CHT Program',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search topic, Zoom meeting id, or host email',
  })
  async listSessions(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('linked') linked?: string,
    @Query('q') q?: string,
  ) {
    return this.catalog.listSessions({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      linked: parseLinkedFilter(linked),
      q,
    });
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ summary: 'Get a catalog session with recording files' })
  async getSession(@Param('sessionId') sessionId: string) {
    return this.catalog.getSession(sessionId);
  }

  @Post('sessions/:sessionId/pull')
  @ApiOperation({
    summary:
      'Pull completed Zoom recording files for a catalog session into S3',
  })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        fileTypes: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional filter, e.g. ["TRANSCRIPT","MP4"]. Defaults to all completed files.',
        },
      },
    },
  })
  async pullSession(
    @Param('sessionId') sessionId: string,
    @Body() body: { fileTypes?: string[] },
    @CurrentUser() admin: AuthUser,
  ) {
    const result = await this.pullService.pullForSession(sessionId, {
      adminUserId: admin.userId,
      fileTypes: body?.fileTypes,
    });
    const detail = await this.catalog.getSession(sessionId);
    return {
      ...detail,
      pulledCount: result.upserted.length,
      errors: result.errors.length ? result.errors : undefined,
    };
  }

  @Get('sessions/:sessionId/files/:fileId/download-url')
  @ApiOperation({
    summary: 'Presigned S3 GET URL for a catalog recording file',
  })
  @ApiQuery({
    name: 'disposition',
    required: false,
    enum: ['inline', 'attachment'],
  })
  async sessionFileDownloadUrl(
    @Param('sessionId') sessionId: string,
    @Param('fileId') fileId: string,
    @Query('disposition') disposition?: string,
  ) {
    if (
      disposition &&
      disposition !== 'inline' &&
      disposition !== 'attachment'
    ) {
      throw new BadRequestException(
        'disposition must be inline or attachment',
      );
    }
    return this.catalog.createDownloadUrl(sessionId, fileId, {
      disposition: disposition === 'inline' ? 'inline' : 'attachment',
    });
  }

  @Post('sessions/:sessionId/link')
  @ApiOperation({
    summary: 'Link a catalog session to an existing CHT Program',
  })
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: ['programId'],
      properties: {
        programId: { type: 'string' },
      },
    },
  })
  async linkSession(
    @Param('sessionId') sessionId: string,
    @Body() body: { programId?: string },
  ) {
    if (!body?.programId?.trim()) {
      throw new BadRequestException('programId is required');
    }
    return this.catalog.linkSessionToProgram(sessionId, body.programId.trim());
  }

  @Post('sync')
  @ApiOperation({
    summary:
      'Start a manual account-wide Zoom recordings sync (metadata only; files pulled separately)',
  })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        monthsBack: {
          type: 'number',
          description:
            'How many months back to crawl. Defaults to ZOOM_RECORDINGS_SYNC_MONTHS_BACK.',
        },
        sessionTypeFilter: {
          type: 'string',
          enum: Object.values(ProgramZoomSessionType),
        },
      },
    },
  })
  async startSync(
    @Body()
    body: {
      monthsBack?: number;
      sessionTypeFilter?: ProgramZoomSessionType;
    },
    @CurrentUser() admin: AuthUser,
  ) {
    const job = await this.sync.startSync({
      monthsBack: body?.monthsBack,
      sessionTypeFilter: body?.sessionTypeFilter ?? null,
      startedByUserId: admin.userId,
    });
    return serializeSyncJob(job);
  }

  @Get('sync/latest')
  @ApiOperation({ summary: 'Most recent Zoom recordings sync job' })
  async latestSyncJob() {
    const job = await this.sync.getLatestJob();
    return job ? serializeSyncJob(job) : null;
  }

  @Get('sync/:jobId')
  @ApiOperation({ summary: 'Get Zoom recordings sync job status' })
  async getSyncJob(@Param('jobId') jobId: string) {
    const job = await this.sync.getJob(jobId);
    return serializeSyncJob(job);
  }

  @Get('sessions/:sessionId/attendance')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'List imported/staged attendees for a catalog session' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Default 10' })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Filter by participant name, email, or Zoom participant ID',
  })
  async listSessionAttendance(
    @Param('sessionId') sessionId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.catalog.listSessionAttendees(sessionId, {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      search,
    });
  }

  @Get('sessions/:sessionId/attendance/report/download-url')
  @ApiOperation({
    summary: 'Presigned S3 GET URL for the session attendee report CSV',
  })
  async sessionAttendanceReportDownloadUrl(
    @Param('sessionId') sessionId: string,
  ) {
    return this.catalog.createAttendanceReportDownloadUrl(sessionId);
  }

  @Post('sessions/:sessionId/attendance/import')
  @ApiOperation({
    summary: 'Import Zoom Report API attendees for one catalog session',
  })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        runAutoVerify: {
          type: 'boolean',
          description:
            'When linked to a Program, auto-verify matching registrations (default false).',
        },
      },
    },
  })
  async importSessionAttendance(
    @Param('sessionId') sessionId: string,
    @Body() body: { runAutoVerify?: boolean },
  ) {
    const result = await this.attendanceImport.importSessionAttendees(
      sessionId,
      { runAutoVerify: body?.runAutoVerify },
    );
    const detail = await this.catalog.getSession(sessionId);
    return { ...detail, ...result };
  }

  @Post('attendance/import')
  @ApiOperation({
    summary:
      'Start a manual 12-month Zoom attendee import for catalog sessions (Report API)',
  })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        monthsBack: {
          type: 'number',
          description:
            'How many months back. Defaults to ZOOM_ATTENDANCE_IMPORT_MONTHS_BACK.',
        },
        runAutoVerify: {
          type: 'boolean',
          description:
            'Auto-verify matching Program registrations after import (default false).',
        },
        sessionTypeFilter: {
          type: 'string',
          enum: Object.values(ProgramZoomSessionType),
        },
      },
    },
  })
  async startAttendanceImport(
    @Body()
    body: {
      monthsBack?: number;
      runAutoVerify?: boolean;
      sessionTypeFilter?: ProgramZoomSessionType;
    },
    @CurrentUser() admin: AuthUser,
  ) {
    const job = await this.attendanceImport.startImport({
      monthsBack: body?.monthsBack,
      runAutoVerify: body?.runAutoVerify,
      sessionTypeFilter: body?.sessionTypeFilter ?? ProgramZoomSessionType.WEBINAR,
      startedByUserId: admin.userId,
    });
    return serializeAttendanceImportJob(job);
  }

  @Get('attendance/import/latest')
  @ApiOperation({ summary: 'Most recent Zoom attendance import job' })
  async latestAttendanceImportJob() {
    const job = await this.attendanceImport.getLatestJob();
    return job ? serializeAttendanceImportJob(job) : null;
  }

  @Get('attendance/import/:jobId')
  @ApiOperation({ summary: 'Get Zoom attendance import job status' })
  async getAttendanceImportJob(@Param('jobId') jobId: string) {
    const job = await this.attendanceImport.getJob(jobId);
    return serializeAttendanceImportJob(job);
  }
}
