import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { ProgramZoomSessionType } from '@prisma/client';
import { buildRegistrationApprovedEmail } from './templates/registration-approved-email';
import { googleCalendarTemplateUrl } from './live-session-calendar';
import {
  buildRegistrationRejectedEmail,
  type RejectionEmailReason,
} from './templates/registration-rejected-email';
import { buildMissedWebinarEmail } from './templates/missed-webinar-email';
import { buildPostWebinarSurveyEmail } from './templates/post-webinar-survey-email';
import { buildWebinarAccessEmail } from './templates/webinar-access-email';
import { buildPreWebinarReminderEmail } from './templates/pre-webinar-reminder-email';
import { buildRegistrationInviteEmail } from './templates/registration-invite-email';
import { buildRegistrationSubmittedEmail } from './templates/registration-submitted-email';
import { buildOperationalEmail } from './templates/operational-email';

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
      this.config.get<string>('email.from') ||
      '"Community Health Media" <info@communityhealth.media>';
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

    // SCRUM-185: no .ics attachment. Google Calendar link stays as an in-body
    // "add to calendar" affordance so users can self-add without receiving
    // an unsolicited calendar invitation.
    const { subject, text, html } = buildRegistrationApprovedEmail(
      {
        firstName,
        programTitle: program.title,
        programDescription: program.description,
        startDate: program.startDate,
        durationMinutes: program.duration,
        honorariumCents: null,
        hostDisplayName: program.hostDisplayName,
        sponsorName: program.sponsorName,
        zoomJoinUrl: zoomTrim,
        sessionKind,
        appSessionUrl,
        supportEmail,
        googleCalendarUrl,
      },
      escapeHtml,
    );

    try {
      await this.sendSimpleEmail(to, subject, text, html);
      this.logger.log(
        `Sent registration-approved email to ${to} for program ${program.id}`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to send registration-approved email to ${to} for program ${program.id}: ${(err as Error).message}`,
      );
    }
  }

  /** Learner completed the registration wizard (pending review or auto-approved). */
  async sendLiveSessionRegistrationSubmittedEmail(opts: {
    to: string;
    firstName: string;
    program: { id: string; title: string };
    sessionKind: ProgramZoomSessionType;
    requiresApproval: boolean;
  }): Promise<void> {
    if (!this.enabled) {
      this.logger.debug('EMAIL disabled: skip registration-submitted email');
      return;
    }
    const { to, firstName, program, sessionKind, requiresApproval } = opts;
    const base = (
      this.config.get<string>('frontendUrl') || 'https://communityhealth.media'
    ).replace(/\/$/, '');
    const appSessionUrl =
      sessionKind === ProgramZoomSessionType.MEETING
        ? `${base}/app/chm-office-hours/${encodeURIComponent(program.id)}`
        : `${base}/app/live/${encodeURIComponent(program.id)}`;
    const { subject, text, html } = buildRegistrationSubmittedEmail(
      {
        firstName,
        programTitle: program.title,
        requiresApproval,
        sessionKind,
        appSessionUrl,
        supportEmail: this.from,
      },
      escapeHtml,
    );
    try {
      await this.sendSimpleEmail(to, subject, text, html);
      this.logger.log(
        `Sent registration-submitted email to ${to} for program ${program.id}`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to send registration-submitted email to ${to} for program ${program.id}: ${(err as Error).message}`,
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
   * Must NOT be called for users who attended, they enter the survey/payment workflow instead.
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
   * Attendee completed the webinar: prompt them to fill in the post-event survey.
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
    /**
     * Optional external URL override. Prefer `feedbackSurveyId` for native in-app surveys.
     */
    surveyUrl?: string | null;
    /** FEEDBACK survey id → CTA goes to /app/surveys/:id (learner Surveys tab). */
    feedbackSurveyId?: string | null;
  }): Promise<void> {
    if (!this.enabled) {
      this.logger.debug('EMAIL disabled: skip post-webinar-survey email');
      return;
    }
    const { to, firstName, program, surveyUrl, feedbackSurveyId } = opts;
    const base = (
      this.config.get<string>('frontendUrl') || 'https://communityhealth.media'
    ).replace(/\/$/, '');
    const appSessionUrl =
      program.zoomSessionType === ProgramZoomSessionType.MEETING
        ? `${base}/app/chm-office-hours/${encodeURIComponent(program.id)}`
        : `${base}/app/live/${encodeURIComponent(program.id)}`;
    const appSurveyUrl = feedbackSurveyId?.trim()
      ? `${base}/app/surveys/${encodeURIComponent(feedbackSurveyId.trim())}`
      : null;
    // Prefer in-app Surveys tab; optional surveyUrl only if explicitly passed.
    const resolvedSurveyUrl = appSurveyUrl || surveyUrl?.trim() || null;
    const supportEmail = this.from;
    const { subject, text, html } = buildPostWebinarSurveyEmail(
      {
        firstName,
        programTitle: program.title,
        surveyUrl: resolvedSurveyUrl,
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
        `Sent post-webinar-survey email to ${to} for program ${program.id}` +
          (resolvedSurveyUrl ? ` cta=${resolvedSurveyUrl}` : ''),
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

  /** Invite learners to the multi-webinar registration landing page. */
  async sendRegistrationInviteEmail(opts: {
    to: string;
    firstName: string;
    programTitles: string[];
    registerUrl: string;
  }): Promise<void> {
    if (!this.enabled) {
      this.logger.debug('EMAIL disabled: skip registration-invite email');
      return;
    }
    const { to, firstName, programTitles, registerUrl } = opts;
    const supportEmail = this.from;
    const { subject, text, html } = buildRegistrationInviteEmail(
      { firstName, programTitles, registerUrl, supportEmail },
      escapeHtml,
    );
    await this.sendSimpleEmail(to, subject, text, html);
    this.logger.log(
      `Sent registration-invite email to ${to} (${programTitles.length} program(s))`,
    );
  }

  /**
   * Admin freeform operational notice (Program Hub). Uses configured SES From
   * (default info@communityhealth.media).
   */
  async sendOperationalEmail(opts: {
    to: string;
    subject: string;
    textBody: string;
    programTitle?: string;
  }): Promise<void> {
    if (!this.enabled) {
      this.logger.debug('EMAIL disabled: skip operational email');
      return;
    }
    const to = opts.to.trim().toLowerCase();
    const subject = opts.subject.trim();
    const textBody = opts.textBody.trim();
    if (!to || !subject || !textBody) {
      throw new Error('to, subject, and body are required');
    }
    const { text, html } = buildOperationalEmail(
      {
        subject,
        textBody,
        programTitle: opts.programTitle,
        supportEmail: this.from,
      },
      escapeHtml,
    );
    await this.sendSimpleEmail(to, subject, text, html);
    this.logger.log(`Sent operational email to ${to}: ${subject.slice(0, 80)}`);
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
