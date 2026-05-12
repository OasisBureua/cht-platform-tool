import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { ProgramZoomSessionType } from '@prisma/client';
import { buildRegistrationApprovedEmail } from './templates/registration-approved-email';
import {
  buildApprovalEmailMimeBuffer,
  buildLiveSessionIcs,
  googleCalendarTemplateUrl,
} from './live-session-calendar';
import {
  buildRegistrationRejectedEmail,
  type RejectionEmailReason,
} from './templates/registration-rejected-email';
import { buildMissedWebinarEmail } from './templates/missed-webinar-email';
import { buildPostWebinarSurveyEmail } from './templates/post-webinar-survey-email';
import { buildWebinarAccessEmail } from './templates/webinar-access-email';
import { buildPreWebinarReminderEmail } from './templates/pre-webinar-reminder-email';

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
    this.from =
      this.config.get<string>('email.from') || 'info@communityhealth.media';
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
      zoomJoinUrl?: string | null;
    };
    sessionKind: ProgramZoomSessionType;
  }): Promise<void> {
    if (!this.enabled) {
      this.logger.debug('EMAIL disabled: skip registration-approved email');
      return;
    }
    const { to, firstName, program, sessionKind } = opts;
    const base = (
      this.config.get<string>('frontendUrl') || 'https://communityhealth.media'
    ).replace(/\/$/, '');
    const appSessionUrl =
      sessionKind === ProgramZoomSessionType.MEETING
        ? `${base}/app/chm-office-hours/${encodeURIComponent(program.id)}`
        : `${base}/app/live/${encodeURIComponent(program.id)}`;
    const supportEmail = this.from;
    const zoomTrim = program.zoomJoinUrl?.trim() || null;
    const googleDetails = (
      sanitizePlainDescription(program.description) +
      (zoomTrim ? `\n\nJoin on Zoom: ${zoomTrim}` : '')
    ).slice(0, 800);
    const googleCalendarUrl =
      program.startDate != null
        ? googleCalendarTemplateUrl({
            title: program.title,
            details: googleDetails,
            start: program.startDate,
            end: new Date(
              program.startDate.getTime() + (program.duration ?? 60) * 60_000,
            ),
          })
        : null;

    const buildApproved = (calendarInviteIncluded: boolean) =>
      buildRegistrationApprovedEmail(
        {
          firstName,
          programTitle: program.title,
          programDescription: program.description,
          startDate: program.startDate,
          durationMinutes: program.duration,
          honorariumCents: program.honorariumAmount,
          hostDisplayName: program.hostDisplayName,
          sponsorName: program.sponsorName,
          zoomJoinUrl: zoomTrim,
          sessionKind,
          appSessionUrl,
          supportEmail,
          googleCalendarUrl: calendarInviteIncluded ? googleCalendarUrl : null,
          calendarInviteIncluded,
        },
        escapeHtml,
      );

    try {
      if (!program.startDate) {
        const { subject, text, html } = buildApproved(false);
        await this.sendSimpleEmail(to, subject, text, html);
        this.logger.log(
          `Sent registration-approved email to ${to} for program ${program.id}`,
        );
        return;
      }

      const withInvite = buildApproved(true);
      try {
        const ics = buildLiveSessionIcs({
          programId: program.id,
          title: program.title,
          description: program.description,
          start: program.startDate,
          durationMinutes: program.duration ?? 60,
          appSessionUrl,
          zoomJoinUrl: program.zoomJoinUrl,
          organizerEmail: this.from,
        });
        const raw = buildApprovalEmailMimeBuffer({
          from: this.from,
          to,
          subject: withInvite.subject,
          textPlain: withInvite.text,
          html: withInvite.html,
          icsFilename: 'live-session.ics',
          icsBody: ics,
        });
        await this.client.send(
          new SendEmailCommand({
            FromEmailAddress: this.from,
            Destination: { ToAddresses: [to] },
            Content: { Raw: { Data: raw } },
          }),
        );
        this.logger.log(
          `Sent registration-approved email (with calendar invite) to ${to} for program ${program.id}`,
        );
        return;
      } catch (mimeErr) {
        this.logger.warn(
          `MIME registration-approved email failed for ${to} program ${program.id}, falling back to Simple: ${(mimeErr as Error).message}`,
        );
      }

      const fallback = buildApproved(false);
      await this.sendSimpleEmail(
        to,
        fallback.subject,
        fallback.text,
        fallback.html,
      );
      this.logger.log(
        `Sent registration-approved email (simple) to ${to} for program ${program.id}`,
      );
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
    const base = (
      this.config.get<string>('frontendUrl') || 'https://communityhealth.media'
    ).replace(/\/$/, '');
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
      await this.sendSimpleEmail(to, subject, text, html);
      this.logger.log(
        `Sent registration-rejected email to ${to} for program ${program.id} (${reason})`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to send registration-rejected email to ${to} for program ${program.id}: ${(err as Error).message}`,
      );
    }
  }
  /**
   * User registered for a webinar but did not attend.
   * Must NOT be called for users who attended — they enter the survey/payment workflow instead.
   */
  async sendMissedWebinarEmail(opts: {
    to: string;
    firstName: string;
    program: {
      id: string;
      title: string;
      description: string;
      startDate: Date | null;
      sponsorName: string;
    };
  }): Promise<void> {
    if (!this.enabled) {
      this.logger.debug('EMAIL disabled: skip missed-webinar email');
      return;
    }
    const { to, firstName, program } = opts;
    const base = (
      this.config.get<string>('frontendUrl') || 'https://communityhealth.media'
    ).replace(/\/$/, '');
    const appHomeUrl = `${base}/app/home`;
    const supportEmail = this.from;
    const { subject, text, html } = buildMissedWebinarEmail(
      {
        firstName,
        programTitle: program.title,
        programDescription: program.description,
        startDate: program.startDate,
        appHomeUrl,
        supportEmail,
        sponsorName: program.sponsorName,
      },
      escapeHtml,
    );
    try {
      await this.sendSimpleEmail(to, subject, text, html);
      this.logger.log(
        `Sent missed-webinar email to ${to} for program ${program.id}`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to send missed-webinar email to ${to} for program ${program.id}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Attendee completed the webinar — prompt them to fill in the post-event survey.
   * Survey completion drives payment eligibility.
   */
  async sendPostWebinarSurveyEmail(opts: {
    to: string;
    firstName: string;
    program: {
      id: string;
      title: string;
      sponsorName: string;
      honorariumAmount: number | null;
      zoomSessionType: ProgramZoomSessionType;
    };
    surveyUrl: string;
  }): Promise<void> {
    if (!this.enabled) {
      this.logger.debug('EMAIL disabled: skip post-webinar-survey email');
      return;
    }
    const { to, firstName, program, surveyUrl } = opts;
    const base = (
      this.config.get<string>('frontendUrl') || 'https://communityhealth.media'
    ).replace(/\/$/, '');
    const appSessionUrl =
      program.zoomSessionType === ProgramZoomSessionType.MEETING
        ? `${base}/app/chm-office-hours/${encodeURIComponent(program.id)}`
        : `${base}/app/live/${encodeURIComponent(program.id)}`;
    const supportEmail = this.from;
    const { subject, text, html } = buildPostWebinarSurveyEmail(
      {
        firstName,
        programTitle: program.title,
        surveyUrl,
        appSessionUrl,
        supportEmail,
        sponsorName: program.sponsorName,
        honorariumCents: program.honorariumAmount,
      },
      escapeHtml,
    );
    try {
      await this.sendSimpleEmail(to, subject, text, html);
      this.logger.log(
        `Sent post-webinar-survey email to ${to} for program ${program.id}`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to send post-webinar-survey email to ${to} for program ${program.id}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Send the Zoom join link to an approved attendee.
   * Intended to be called 24–48 h before the session starts, or immediately on approval when the event is imminent.
   */
  async sendWebinarAccessEmail(opts: {
    to: string;
    firstName: string;
    program: {
      id: string;
      title: string;
      description: string;
      startDate: Date | null;
      duration: number | null;
      zoomJoinUrl: string;
      hostDisplayName: string | null;
      sponsorName: string;
      zoomSessionType: ProgramZoomSessionType;
    };
  }): Promise<void> {
    if (!this.enabled) {
      this.logger.debug('EMAIL disabled: skip webinar-access email');
      return;
    }
    const { to, firstName, program } = opts;
    const base = (
      this.config.get<string>('frontendUrl') || 'https://communityhealth.media'
    ).replace(/\/$/, '');
    const appSessionUrl =
      program.zoomSessionType === ProgramZoomSessionType.MEETING
        ? `${base}/app/chm-office-hours/${encodeURIComponent(program.id)}`
        : `${base}/app/live/${encodeURIComponent(program.id)}`;
    const supportEmail = this.from;
    const { subject, text, html } = buildWebinarAccessEmail(
      {
        firstName,
        programTitle: program.title,
        programDescription: program.description,
        startDate: program.startDate,
        durationMinutes: program.duration,
        zoomJoinUrl: program.zoomJoinUrl,
        hostDisplayName: program.hostDisplayName,
        sponsorName: program.sponsorName,
        appSessionUrl,
        supportEmail,
      },
      escapeHtml,
    );
    try {
      await this.sendSimpleEmail(to, subject, text, html);
      this.logger.log(
        `Sent webinar-access email to ${to} for program ${program.id}`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to send webinar-access email to ${to} for program ${program.id}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Pre-event reminder sent to approved attendees before the webinar starts.
   * Pass hoursUntilStart=24 for a day-before reminder, hoursUntilStart=1 for a same-day nudge.
   */
  async sendPreWebinarReminderEmail(opts: {
    to: string;
    firstName: string;
    hoursUntilStart: number;
    program: {
      id: string;
      title: string;
      description: string;
      startDate: Date | null;
      duration: number | null;
      zoomJoinUrl: string | null;
      hostDisplayName: string | null;
      sponsorName: string;
      zoomSessionType: ProgramZoomSessionType;
    };
  }): Promise<void> {
    if (!this.enabled) {
      this.logger.debug('EMAIL disabled: skip pre-webinar-reminder email');
      return;
    }
    const { to, firstName, hoursUntilStart, program } = opts;
    const base = (
      this.config.get<string>('frontendUrl') || 'https://communityhealth.media'
    ).replace(/\/$/, '');
    const appSessionUrl =
      program.zoomSessionType === ProgramZoomSessionType.MEETING
        ? `${base}/app/chm-office-hours/${encodeURIComponent(program.id)}`
        : `${base}/app/live/${encodeURIComponent(program.id)}`;
    const supportEmail = this.from;
    const { subject, text, html } = buildPreWebinarReminderEmail(
      {
        firstName,
        programTitle: program.title,
        programDescription: program.description,
        startDate: program.startDate,
        durationMinutes: program.duration,
        zoomJoinUrl: program.zoomJoinUrl,
        hostDisplayName: program.hostDisplayName,
        sponsorName: program.sponsorName,
        appSessionUrl,
        supportEmail,
        hoursUntilStart,
      },
      escapeHtml,
    );
    try {
      await this.sendSimpleEmail(to, subject, text, html);
      this.logger.log(
        `Sent pre-webinar-reminder email to ${to} for program ${program.id} (${hoursUntilStart}h out)`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to send pre-webinar-reminder email to ${to} for program ${program.id}: ${(err as Error).message}`,
      );
    }
  }

  private async sendSimpleEmail(
    to: string,
    subject: string,
    text: string,
    html: string,
  ): Promise<void> {
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
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizePlainDescription(htmlOrText: string): string {
  return htmlOrText
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
