import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  HttpCode,
  Injectable,
  Logger,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ReportReadyDto } from './dto/report-ready.dto';
import { ReportReadyService } from './report-ready.service';

/** Runs before body validation, so an unauthenticated caller only ever sees 401/403. */
@Injectable()
export class ReportsNotifyM2mGuard implements CanActivate {
  constructor(private readonly ready: ReportReadyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    await this.ready.assertAuthorized(
      typeof header === 'string' ? header : undefined,
    );
    return true;
  }
}

/**
 * Service-to-service report hooks (CPR-35).
 *
 * Auth: Cognito M2M Bearer from the cht-reports client with
 * `platform/reports.notify`. No session cookies.
 *
 * POST /internal/reports/:reportId/ready  { campaignId, version }
 *   cht-reports calls this after marking a version complete; platform emails
 *   the report's notify list once per version.
 */
@Controller('internal/reports')
@UseGuards(ReportsNotifyM2mGuard)
export class InternalReportsController {
  private readonly logger = new Logger(InternalReportsController.name);

  constructor(private readonly ready: ReportReadyService) {}

  @Post(':reportId/ready')
  @HttpCode(200)
  async reportReady(
    @Param('reportId') reportId: string,
    @Body() body: ReportReadyDto,
  ) {
    this.logger.log(
      `POST /internal/reports/${reportId}/ready campaignId=${body.campaignId} v${body.version}`,
    );
    return this.ready.handleReady(reportId, body.campaignId, body.version);
  }
}
