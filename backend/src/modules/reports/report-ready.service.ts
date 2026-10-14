import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CognitoService } from '../../auth/cognito.service';
import { SesEmailService } from '../email/ses-email.service';
import { ReportsService } from './reports.service';

export const M2M_REPORTS_NOTIFY_SCOPE_DEFAULT = 'platform/reports.notify';

export type ReportReadyResult = {
  status: 'sent' | 'already_notified' | 'no_recipients';
  sent: number;
  failed: number;
};

/**
 * cht-reports tells platform a report version is ready (CPR-35); platform
 * emails the report's notify list, same sender and layout as its other
 * transactional email. Once per version: the claim on the DynamoDB row makes
 * a retried call a no-op.
 */
@Injectable()
export class ReportReadyService {
  private readonly logger = new Logger(ReportReadyService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly cognito: CognitoService,
    private readonly reports: ReportsService,
    private readonly email: SesEmailService,
  ) {}

  /** Bearer must be the cht-reports M2M client with platform/reports.notify. */
  async assertAuthorized(authorization?: string): Promise<void> {
    const clientId =
      this.config.get<string>('cognito.m2mReportsClientId')?.trim() || '';
    if (!clientId || !this.cognito.isConfigured()) {
      this.logger.warn('[M2M] report-ready rejected: not configured');
      throw new UnauthorizedException(
        'Report notifications are not configured',
      );
    }

    const bearer = authorization?.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';
    if (!bearer) {
      throw new UnauthorizedException('Missing Authorization Bearer token');
    }

    const requiredScope =
      this.config.get<string>('cognito.m2mReportsNotifyScope')?.trim() ||
      M2M_REPORTS_NOTIFY_SCOPE_DEFAULT;
    try {
      await this.cognito.verifyM2mAccessToken(bearer, {
        allowedClientIds: [clientId],
        requiredScope,
      });
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: string }).code || '')
          : '';
      if (code === 'MISSING_SCOPE') {
        throw new ForbiddenException(
          `Access token missing required scope ${requiredScope}`,
        );
      }
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[M2M] report-ready reject: ${message}`);
      throw new UnauthorizedException('Invalid M2M access token');
    }
  }

  async handleReady(
    reportId: string,
    campaignId: string,
    version: number,
  ): Promise<ReportReadyResult> {
    const report = await this.reports.claimReadyNotification(
      campaignId,
      reportId,
      version,
    );
    if (!report) {
      this.logger.log(
        `[reports] ready v${version} reportId=${reportId}: already notified, skipping`,
      );
      return { status: 'already_notified', sent: 0, failed: 0 };
    }

    const recipients = [
      ...new Set(
        (report.notify_emails ?? [])
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    if (recipients.length === 0) {
      this.logger.log(
        `[reports] ready v${version} reportId=${reportId}: no notify emails`,
      );
      return { status: 'no_recipients', sent: 0, failed: 0 };
    }

    let sent = 0;
    for (const to of recipients) {
      try {
        await this.email.sendReportReadyEmail({ to, campaignId, version });
        sent++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `[reports] report-ready email failed reportId=${reportId} v${version} to=${to}: ${message}`,
        );
      }
    }
    const failed = recipients.length - sent;

    // Nobody got it: release the claim so cht-reports' retry can send.
    // A partial failure keeps the claim, so a retry cannot double-send.
    if (sent === 0) {
      await this.reports.releaseReadyNotification(
        campaignId,
        reportId,
        version,
      );
      throw new ServiceUnavailableException(
        'Report-ready email could not be sent',
      );
    }

    this.logger.log(
      `[reports] ready v${version} reportId=${reportId} campaignId=${campaignId}: emailed ${sent}/${recipients.length}`,
    );
    return { status: 'sent', sent, failed };
  }
}
