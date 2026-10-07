import {
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReportReadyService } from './report-ready.service';
import type { ReportsService } from './reports.service';
import type { ReportItem } from './reports.types';
import type { CognitoService } from '../../auth/cognito.service';
import type { SesEmailService } from '../email/ses-email.service';

function row(overrides: Partial<ReportItem> = {}): ReportItem {
  return {
    campaign_id: '9',
    report_id: 'rep-1',
    template_type: 'executive_summary',
    sources: [],
    window_start: null,
    window_end: '2026-10-01T00:00:00.000Z',
    notify_emails: ['a@cht.com', 'B@cht.com ', 'a@cht.com'],
    status: 'complete',
    attempt_count: 1,
    edit_attempts: 1,
    last_error: null,
    requested_by: 'user-1',
    s3_key_pdf: 'reports/9/rep-1/v2.pdf',
    version: 2,
    notified_version: 2,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:05:00.000Z',
    ...overrides,
  };
}

function setup(configOverrides: Record<string, unknown> = {}) {
  const map: Record<string, unknown> = {
    'cognito.m2mReportsClientId': 'reports-client',
    'cognito.m2mReportsNotifyScope': 'platform/reports.notify',
    ...configOverrides,
  };
  const config = { get: (key: string) => map[key] } as unknown as ConfigService;
  const cognito = {
    isConfigured: jest.fn().mockReturnValue(true),
    verifyM2mAccessToken: jest
      .fn()
      .mockResolvedValue({ client_id: 'reports-client' }),
  };
  const reports = {
    claimReadyNotification: jest.fn().mockResolvedValue(row()),
    releaseReadyNotification: jest.fn().mockResolvedValue(undefined),
  };
  const email = {
    sendReportReadyEmail: jest.fn().mockResolvedValue(undefined),
  };
  const service = new ReportReadyService(
    config,
    cognito as unknown as CognitoService,
    reports as unknown as ReportsService,
    email as unknown as SesEmailService,
  );
  return { service, cognito, reports, email };
}

describe('ReportReadyService', () => {
  describe('assertAuthorized', () => {
    it('accepts the cht-reports client with platform/reports.notify', async () => {
      const { service, cognito } = setup();

      await expect(
        service.assertAuthorized('Bearer a.b.c'),
      ).resolves.toBeUndefined();
      expect(cognito.verifyM2mAccessToken).toHaveBeenCalledWith('a.b.c', {
        allowedClientIds: ['reports-client'],
        requiredScope: 'platform/reports.notify',
      });
    });

    it('401s without a Bearer token', async () => {
      const { service, cognito } = setup();

      await expect(service.assertAuthorized(undefined)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(
        service.assertAuthorized('Basic abc'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(cognito.verifyM2mAccessToken).not.toHaveBeenCalled();
    });

    it('401s when the reports client is not configured', async () => {
      const { service } = setup({ 'cognito.m2mReportsClientId': '' });

      await expect(
        service.assertAuthorized('Bearer a.b.c'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('403s a token without the scope, 401s an invalid one', async () => {
      const { service, cognito } = setup();
      cognito.verifyM2mAccessToken.mockRejectedValueOnce(
        Object.assign(new Error('missing scope'), { code: 'MISSING_SCOPE' }),
      );
      await expect(
        service.assertAuthorized('Bearer a.b.c'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      cognito.verifyM2mAccessToken.mockRejectedValueOnce(
        new Error('client_id mismatch'),
      );
      await expect(
        service.assertAuthorized('Bearer a.b.c'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('handleReady', () => {
    it('emails each unique notify address once for the claimed version', async () => {
      const { service, reports, email } = setup();

      const result = await service.handleReady('rep-1', '9', 2);

      expect(reports.claimReadyNotification).toHaveBeenCalledWith(
        '9',
        'rep-1',
        2,
      );
      expect(
        email.sendReportReadyEmail.mock.calls.map(([o]) => o as unknown),
      ).toEqual([
        { to: 'a@cht.com', campaignId: '9', version: 2 },
        { to: 'b@cht.com', campaignId: '9', version: 2 },
      ]);
      expect(result).toEqual({ status: 'sent', sent: 2, failed: 0 });
    });

    it('sends nothing when the version was already emailed', async () => {
      const { service, reports, email } = setup();
      reports.claimReadyNotification.mockResolvedValue(null);

      await expect(service.handleReady('rep-1', '9', 2)).resolves.toEqual({
        status: 'already_notified',
        sent: 0,
        failed: 0,
      });
      expect(email.sendReportReadyEmail).not.toHaveBeenCalled();
    });

    it('does nothing when the report has no notify emails', async () => {
      const { service, reports, email } = setup();
      reports.claimReadyNotification.mockResolvedValue(
        row({ notify_emails: [] }),
      );

      await expect(service.handleReady('rep-1', '9', 2)).resolves.toEqual({
        status: 'no_recipients',
        sent: 0,
        failed: 0,
      });
      expect(email.sendReportReadyEmail).not.toHaveBeenCalled();
    });

    it('keeps the claim on a partial failure so a retry cannot double-send', async () => {
      const { service, reports, email } = setup();
      email.sendReportReadyEmail
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('SES throttled'));

      await expect(service.handleReady('rep-1', '9', 2)).resolves.toEqual({
        status: 'sent',
        sent: 1,
        failed: 1,
      });
      expect(reports.releaseReadyNotification).not.toHaveBeenCalled();
    });

    it('releases the claim and 503s when no email went out, so cht-reports retries', async () => {
      const { service, reports, email } = setup();
      email.sendReportReadyEmail.mockRejectedValue(new Error('SES down'));

      await expect(service.handleReady('rep-1', '9', 2)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(reports.releaseReadyNotification).toHaveBeenCalledWith(
        '9',
        'rep-1',
        2,
      );
    });
  });
});
