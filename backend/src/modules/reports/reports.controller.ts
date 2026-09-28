import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { AuthUser } from '../../auth/auth.service';
import { CreateReportDto } from './dto/create-report.dto';
import { RegenerateReportDto } from './dto/regenerate-report.dto';
import { ReportsService } from './reports.service';
import {
  ReportRecipientsService,
  type ReportRecipient,
} from './report-recipients.service';
import type { ReportView } from './reports.types';

@ApiTags('Reports')
@ApiBearerAuth('session-token')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly recipients: ReportRecipientsService,
  ) {}

  @Get('notify-recipients')
  @ApiOperation({
    summary: 'Active admins who can be picked as report notify recipients',
  })
  notifyRecipients(): Promise<ReportRecipient[]> {
    return this.recipients.listAdmins();
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      'Queue a report: freezes the window, takes the campaign/template lock, enqueues for cht-reports',
  })
  create(
    @Body() dto: CreateReportDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ReportView> {
    return this.reports.create(dto, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List reports for a campaign (newest first)' })
  list(@Query('campaignId') campaignId?: string): Promise<ReportView[]> {
    const id = campaignId?.trim();
    if (!id) throw new BadRequestException('campaignId is required');
    return this.reports.list(id);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Poll a report. Pass campaignId (returned by POST) for a strongly consistent read.',
  })
  get(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('campaignId') campaignId?: string,
  ): Promise<ReportView> {
    return this.reports.get(id, campaignId?.trim() || undefined);
  }

  @Post(':id/regenerate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      'Regenerate a completed report. 409 if not complete or the edit limit is reached.',
  })
  regenerate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RegenerateReportDto,
    @Query('campaignId') campaignId?: string,
  ): Promise<ReportView> {
    return this.reports.regenerate(
      id,
      campaignId?.trim() || undefined,
      body?.editInstructions,
    );
  }

  @Get(':id/download')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Download the report PDF (streamed; 409 until complete)',
  })
  async download(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('campaignId') campaignId?: string,
  ): Promise<StreamableFile> {
    const file = await this.reports.openDownload(
      id,
      campaignId?.trim() || undefined,
    );
    return new StreamableFile(file.stream, {
      type: 'application/pdf',
      disposition: `attachment; filename="${file.filename}"`,
      length: file.contentLength,
    });
  }
}
