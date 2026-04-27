import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { ProgramZoomSessionType } from '@prisma/client';
import { buildRegistrationApprovedEmail } from './templates/registration-approved-email';
import {
  buildRegistrationRejectedEmail,
  type RejectionEmailReason,
} from './templates/registration-rejected-email';

/**
 * Transactional email via [Amazon SES](https://docs.aws.amazon.com/ses/) (SESv2 `SendEmail` with Simple content).
 * Aligns with the AWS SES developer guide: verified identities, UTF-8 bodies, and IAM `ses:SendEmail`.
 */
@Injectable()
export class SesEmailService {
  private readonly logger = new Logger(SesEmailService.name);
  private readonly client: SESv2Client;
  private readonly from: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const region = this.config.get<string>('aws.region') || 'us-east-1';
    const accessKeyId = this.config.get<string>('aws.accessKeyId');
    const secretAccessKey = this.config.get<string>('aws.secretAccessKey');
    this.from = this.config.get<string>('email.from') || 'info@communityhealth.media';
    this.enabled = this.config.get<boolean>('email.enabled') !== false;
    this.client = new SESv2Client({
      region,
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
  }

  /**
   * Learner is approved to attend a published Live / Office Hours session (after admin approves registration).
   * Uses a branded HTML + plain-text template; dynamic user/session fields are HTML-escaped.
   */
  async sendLiveSessionRegistrationApprovedEmail(opts: {
    to: string;
    firstName: string;
    program: {
      id: string;
      title: string;
      description: string;
      startDate: Date | null;
      duration: number | null;
      honorariumAmount: number | null;
      hostDisplayName: string | null;
      sponsorName: string;
    };
    sessionKind: ProgramZoomSessionType;
  }): Promise<void> {
    if (!this.enabled) {
      this.logger.debug('EMAIL disabled: skip registration-approved email');
      return;
    }
    const { to, firstName, program, sessionKind } = opts;
    const base = (this.config.get<string>('frontendUrl') || 'https://communityhealth.media').replace(/\/$/, '');
    const appSessionUrl =
      sessionKind === ProgramZoomSessionType.MEETING
        ? `${base}/app/chm-office-hours/${encodeURIComponent(program.id)}`
        : `${base}/app/live/${encodeURIComponent(program.id)}`;
    const supportEmail = this.from;
    const { subject, text, html } = buildRegistrationApprovedEmail(
      {
        firstName,
        programTitle: program.title,
        programDescription: program.description,
        startDate: program.startDate,
        durationMinutes: program.duration,
        honorariumCents: program.honorariumAmount,
        hostDisplayName: program.hostDisplayName,
        sponsorName: program.sponsorName,
        sessionKind,
        appSessionUrl,
        supportEmail,
      },
      escapeHtml,
    );
    try {
      await this.client.send(
        new SendEmailCommand({
          FromEmailAddress: this.from,
          Destination: { ToAddresses: [to] },
          Content: {
            Simple: {
              Subject: { Data: subject, Charset: 'UTF-8' },
              Body: {
                Text: { Data: text, Charset: 'UTF-8' },
                Html: { Data: html, Charset: 'UTF-8' },
              },
            },
          },
        }),
      );
      this.logger.log(`Sent registration-approved email to ${to} for program ${program.id}`);
    } catch (err) {
      this.logger.warn(
        `Failed to send registration-approved email to ${to} for program ${program.id}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Registration was not approved (admin reject). Use GENERIC or INCOMPLETE_INTAKE copy; optional admin note in body.
   */
  async sendLiveSessionRegistrationRejectedEmail(opts: {
    to: string;
    firstName: string;
    program: { id: string; title: string };
    sessionKind: ProgramZoomSessionType;
    reason: RejectionEmailReason;
    adminNote: string;
  }): Promise<void> {
    if (!this.enabled) {
      this.logger.debug('EMAIL disabled: skip registration-rejected email');
      return;
    }
    const { to, firstName, program, sessionKind, reason, adminNote } = opts;
    const base = (this.config.get<string>('frontendUrl') || 'https://communityhealth.media').replace(/\/$/, '');
    const appSessionUrl =
      sessionKind === ProgramZoomSessionType.MEETING
        ? `${base}/app/chm-office-hours/${encodeURIComponent(program.id)}`
        : `${base}/app/live/${encodeURIComponent(program.id)}`;
    const supportEmail = this.from;
    const { subject, text, html } = buildRegistrationRejectedEmail(
      {
        firstName,
        programTitle: program.title,
        sessionKind,
        reason,
        adminNote,
        appSessionUrl,
        supportEmail,
      },
      escapeHtml,
    );
    try {
      await this.client.send(
        new SendEmailCommand({
          FromEmailAddress: this.from,
          Destination: { ToAddresses: [to] },
          Content: {
            Simple: {
              Subject: { Data: subject, Charset: 'UTF-8' },
              Body: {
                Text: { Data: text, Charset: 'UTF-8' },
                Html: { Data: html, Charset: 'UTF-8' },
              },
            },
          },
        }),
      );
      this.logger.log(`Sent registration-rejected email to ${to} for program ${program.id} (${reason})`);
    } catch (err) {
      this.logger.warn(
        `Failed to send registration-rejected email to ${to} for program ${program.id}: ${(err as Error).message}`,
      );
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
