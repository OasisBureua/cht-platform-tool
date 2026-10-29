import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  OutboundEmailType,
  ProgramEmailKind,
  ProgramZoomSessionType,
  type Program,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  defaultCopyFor,
  findUnknownTokens,
  listProgramEmailKinds,
  PROGRAM_EMAIL_ALLOWED_TOKENS,
  type ProgramEmailCopy,
  type ProgramEmailMergeContext,
} from './program-email-defaults';
import { buildCustomizableProgramEmail } from './templates/customizable-program-email';
import { SesEmailService } from './ses-email.service';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatHonorarium(cents: number | null | undefined): string {
  if (cents == null || cents <= 0) return '$200';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatEventDate(start: Date | null | undefined): string {
  if (!start) return '';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  }).format(start);
}

function formatEventTime(start: Date | null | undefined): string {
  if (!start) return '';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: 'America/New_York',
  }).format(start);
}

export function outboundTypeForKind(
  kind: ProgramEmailKind,
): OutboundEmailType {
  switch (kind) {
    case ProgramEmailKind.REGISTRATION_RECEIVED:
      return OutboundEmailType.REGISTRATION_SUBMITTED;
    case ProgramEmailKind.REGISTRATION_APPROVED:
      return OutboundEmailType.REGISTRATION_APPROVED;
    case ProgramEmailKind.SESSION_REMINDER:
      return OutboundEmailType.PRE_SESSION_REMINDER;
    case ProgramEmailKind.POST_WEBINAR_SURVEY:
      return OutboundEmailType.POST_EVENT_SURVEY;
    case ProgramEmailKind.MISSED_SESSION:
      return OutboundEmailType.MISSED_SESSION;
    case ProgramEmailKind.PAYMENT_FOLLOW_UP:
      return OutboundEmailType.PAYMENT_FOLLOW_UP;
    default:
      return OutboundEmailType.OTHER;
  }
}

@Injectable()
export class ProgramEmailOverrideService {
  private readonly logger = new Logger(ProgramEmailOverrideService.name);
  private readonly appBase: string;
  private readonly supportEmail: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => SesEmailService))
    private readonly sesEmail: SesEmailService,
  ) {
    this.appBase = (
      this.config.get<string>('frontendUrl') || 'https://communityhealth.media'
    ).replace(/\/$/, '');
    const from =
      this.config.get<string>('email.from') ||
      '"Community Health Media" <info@communityhealth.media>';
    const match = from.match(/<([^>]+)>/);
    this.supportEmail = (match?.[1] || from).trim();
  }

  listKinds() {
    return {
      allowedTokens: [...PROGRAM_EMAIL_ALLOWED_TOKENS],
      kinds: listProgramEmailKinds().map((m) => ({
        kind: m.kind,
        label: m.label,
        description: m.description,
        requiredLink: m.requiredLink,
        defaultCopy: m.defaultCopy,
      })),
    };
  }

  async listForProgram(programId: string) {
    await this.requireProgram(programId);
    const rows = await this.prisma.programEmailOverride.findMany({
      where: { programId },
      select: {
        id: true,
        emailKind: true,
        subject: true,
        greeting: true,
        body: true,
        signOff: true,
        updatedByUserId: true,
        updatedAt: true,
      },
    });
    const byKind = new Map(rows.map((r) => [r.emailKind, r]));
    return {
      programId,
      hasCustomEmails: rows.length > 0,
      emails: listProgramEmailKinds().map((meta) => {
        const override = byKind.get(meta.kind) ?? null;
        return {
          kind: meta.kind,
          label: meta.label,
          description: meta.description,
          requiredLink: meta.requiredLink,
          isCustom: !!override,
          copy: override
            ? {
                subject: override.subject,
                greeting: override.greeting,
                body: override.body,
                signOff: override.signOff,
              }
            : defaultCopyFor(meta.kind),
          updatedAt: override?.updatedAt?.toISOString() ?? null,
          updatedByUserId: override?.updatedByUserId ?? null,
        };
      }),
    };
  }

  async programsWithCustomEmailFlags(
    programIds: string[],
  ): Promise<Set<string>> {
    if (programIds.length === 0) return new Set();
    const rows = await this.prisma.programEmailOverride.findMany({
      where: { programId: { in: programIds } },
      select: { programId: true },
      distinct: ['programId'],
    });
    return new Set(rows.map((r) => r.programId));
  }

  async upsert(
    programId: string,
    emailKind: ProgramEmailKind,
    copy: ProgramEmailCopy,
    actorUserId: string | null,
  ) {
    await this.requireProgram(programId);
    this.assertValidCopy(copy);

    const data = {
      subject: copy.subject.trim(),
      greeting: copy.greeting.trim(),
      body: copy.body.trim(),
      signOff: copy.signOff.trim(),
      updatedByUserId: actorUserId,
    };

    const override = await this.prisma.programEmailOverride.upsert({
      where: {
        programId_emailKind: { programId, emailKind },
      },
      create: {
        programId,
        emailKind,
        ...data,
      },
      update: data,
    });

    await this.prisma.programEmailOverrideVersion.create({
      data: {
        overrideId: override.id,
        programId,
        emailKind,
        subject: override.subject,
        greeting: override.greeting,
        body: override.body,
        signOff: override.signOff,
        editedByUserId: actorUserId,
      },
    });

    this.logger.log(
      `Email override saved program=${programId} kind=${emailKind} by=${actorUserId ?? 'unknown'}`,
    );

    return {
      kind: emailKind,
      isCustom: true,
      copy: {
        subject: override.subject,
        greeting: override.greeting,
        body: override.body,
        signOff: override.signOff,
      },
      updatedAt: override.updatedAt.toISOString(),
    };
  }

  async resetToDefault(
    programId: string,
    emailKind: ProgramEmailKind,
    actorUserId: string | null,
  ) {
    await this.requireProgram(programId);
    const existing = await this.prisma.programEmailOverride.findUnique({
      where: { programId_emailKind: { programId, emailKind } },
    });
    if (!existing) {
      return { kind: emailKind, isCustom: false, copy: defaultCopyFor(emailKind) };
    }

    // Snapshot the reset as a version (defaults) then delete the override.
    await this.prisma.programEmailOverrideVersion.create({
      data: {
        overrideId: existing.id,
        programId,
        emailKind,
        ...defaultCopyFor(emailKind),
        editedByUserId: actorUserId,
      },
    });
    await this.prisma.programEmailOverride.delete({
      where: { id: existing.id },
    });

    return {
      kind: emailKind,
      isCustom: false,
      copy: defaultCopyFor(emailKind),
    };
  }

  async listVersions(programId: string, emailKind: ProgramEmailKind) {
    await this.requireProgram(programId);
    const versions = await this.prisma.programEmailOverrideVersion.findMany({
      where: { programId, emailKind },
      orderBy: { editedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        subject: true,
        greeting: true,
        body: true,
        signOff: true,
        editedByUserId: true,
        editedAt: true,
      },
    });
    return { programId, emailKind, versions };
  }

  /**
   * Resolve effective copy for a send: override if present, else defaults.
   */
  async resolveCopy(
    programId: string,
    emailKind: ProgramEmailKind,
  ): Promise<{ copy: ProgramEmailCopy; isCustom: boolean }> {
    const override = await this.prisma.programEmailOverride.findUnique({
      where: { programId_emailKind: { programId, emailKind } },
    });
    if (!override) {
      return { copy: defaultCopyFor(emailKind), isCustom: false };
    }
    return {
      isCustom: true,
      copy: {
        subject: override.subject,
        greeting: override.greeting,
        body: override.body,
        signOff: override.signOff,
      },
    };
  }

  buildRendered(opts: {
    kind: ProgramEmailKind;
    copy: ProgramEmailCopy;
    program: Pick<
      Program,
      | 'id'
      | 'title'
      | 'startDate'
      | 'sponsorName'
      | 'honorariumAmount'
      | 'zoomJoinUrl'
      | 'zoomSessionType'
    >;
    firstName?: string;
    surveyUrl?: string | null;
  }): { subject: string; text: string; html: string; merge: ProgramEmailMergeContext } {
    const { kind, copy, program } = opts;
    const links = this.buildLinks(program, opts.surveyUrl);
    const merge = this.buildMergeContext(program, opts.firstName ?? 'Alex', links);

    const rendered = buildCustomizableProgramEmail({
      kind,
      copy,
      merge,
      links: {
        ...links,
        supportEmail: this.supportEmail,
      },
      escape: escapeHtml,
    });

    return { ...rendered, merge };
  }

  async preview(
    programId: string,
    emailKind: ProgramEmailKind,
    copy?: ProgramEmailCopy | null,
  ) {
    const program = await this.requireProgram(programId);
    const effective =
      copy != null
        ? (this.assertValidCopy(copy), copy)
        : (await this.resolveCopy(programId, emailKind)).copy;

    const sampleSurvey =
      emailKind === ProgramEmailKind.POST_WEBINAR_SURVEY
        ? `${this.appBase}/app/surveys/sample-survey-id`
        : null;

    const rendered = this.buildRendered({
      kind: emailKind,
      copy: effective,
      program,
      firstName: 'Alex',
      surveyUrl: sampleSurvey,
    });

    return {
      kind: emailKind,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      mergeSample: rendered.merge,
      allowedTokens: [...PROGRAM_EMAIL_ALLOWED_TOKENS],
    };
  }

  async sendTest(
    programId: string,
    emailKind: ProgramEmailKind,
    toEmail: string,
    actorUserId: string | null,
    copy?: ProgramEmailCopy | null,
  ) {
    const to = toEmail.trim().toLowerCase();
    if (!to || !to.includes('@')) {
      throw new BadRequestException('A valid toEmail is required for test send');
    }
    const preview = await this.preview(programId, emailKind, copy);
    await this.sesEmail.sendRawTestEmail({
      to,
      subject: `[TEST] ${preview.subject}`,
      text: preview.text,
      html: preview.html,
      emailType: outboundTypeForKind(emailKind),
      programId,
      sentByUserId: actorUserId,
    });
    return { sent: true, to, subject: `[TEST] ${preview.subject}` };
  }

  private buildLinks(
    program: Pick<
      Program,
      'id' | 'zoomJoinUrl' | 'zoomSessionType'
    >,
    surveyUrl?: string | null,
  ) {
    const sessionLink =
      program.zoomSessionType === ProgramZoomSessionType.MEETING
        ? `${this.appBase}/app/chm-office-hours/${encodeURIComponent(program.id)}`
        : `${this.appBase}/app/live/${encodeURIComponent(program.id)}`;
    return {
      sessionLink,
      joinLink: program.zoomJoinUrl?.trim() || sessionLink,
      surveyLink: surveyUrl?.trim() || null,
      homeLink: `${this.appBase}/app/live`,
      paymentsLink: `${this.appBase}/app/profile`,
    };
  }

  private buildMergeContext(
    program: Pick<
      Program,
      'title' | 'startDate' | 'sponsorName' | 'honorariumAmount'
    >,
    firstName: string,
    links: ReturnType<ProgramEmailOverrideService['buildLinks']>,
  ): ProgramEmailMergeContext {
    const date = formatEventDate(program.startDate);
    const time = formatEventTime(program.startDate);
    return {
      firstName: firstName.trim() || 'there',
      eventTitle: program.title,
      eventDate: date ? ` on ${date}` : '',
      eventTime: time,
      joinLink: links.joinLink || '',
      surveyLink: links.surveyLink || '',
      sessionLink: links.sessionLink,
      supportEmail: this.supportEmail,
      sponsorName: program.sponsorName || 'Community Health Media',
      honorariumAmount: formatHonorarium(program.honorariumAmount),
    };
  }

  private assertValidCopy(copy: ProgramEmailCopy): void {
    if (!copy.subject?.trim()) {
      throw new BadRequestException('Subject is required');
    }
    if (!copy.greeting?.trim()) {
      throw new BadRequestException('Greeting is required');
    }
    if (!copy.body?.trim()) {
      throw new BadRequestException('Body text is required');
    }
    if (!copy.signOff?.trim()) {
      throw new BadRequestException('Sign-off is required');
    }
    const unknown = findUnknownTokens(copy);
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown merge tokens: ${unknown.map((t) => `{{${t}}}`).join(', ')}. Allowed: ${PROGRAM_EMAIL_ALLOWED_TOKENS.map((t) => `{{${t}}}`).join(', ')}`,
      );
    }
  }

  private async requireProgram(programId: string) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
    });
    if (!program) throw new NotFoundException('Program not found');
    return program;
  }
}
