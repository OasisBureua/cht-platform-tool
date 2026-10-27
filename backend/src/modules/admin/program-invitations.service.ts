import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OutboundEmailStatus,
  OutboundEmailType,
  PostEventAttendanceStatus,
  ProgramRegistrationStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboundEmailLogService } from '../email/outbound-email-log.service';
import { SesEmailService } from '../email/ses-email.service';
import { AuditService } from '../../audit/audit.service';
import { InvitesService } from '../invites/invites.service';
import { ConfigService } from '@nestjs/config';

export type InvitationListRow = {
  id: string;
  toEmail: string;
  toName: string | null;
  emailType: OutboundEmailType;
  status: OutboundEmailStatus;
  sentAt: string;
  sentBy: 'ADMIN' | 'AUTOMATIC';
  sentByUserId: string | null;
  sesMessageId: string | null;
  errorMessage: string | null;
  registrationOutcome:
    | 'NONE'
    | 'REGISTERED'
    | 'APPROVED'
    | 'REJECTED'
    | 'ATTENDED';
  registrationId: string | null;
  canResend: boolean;
};

@Injectable()
export class ProgramInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outboundLog: OutboundEmailLogService,
    private readonly sesEmail: SesEmailService,
    private readonly audit: AuditService,
    private readonly invites: InvitesService,
    private readonly config: ConfigService,
  ) {}

  async list(
    programId: string,
    opts: {
      q?: string;
      status?: OutboundEmailStatus;
      emailType?: OutboundEmailType;
      skip?: number;
      take?: number;
    } = {},
  ) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: { id: true, title: true },
    });
    if (!program) throw new NotFoundException('Program not found');

    const { rows, total, totals } = await this.outboundLog.listForProgram(
      programId,
      opts,
    );

    const emails = [...new Set(rows.map((r) => r.toEmail.toLowerCase()))];
    const regs = emails.length
      ? await this.prisma.programRegistration.findMany({
          where: {
            programId,
            user: { email: { in: emails, mode: 'insensitive' } },
          },
          select: {
            id: true,
            status: true,
            postEventAttendanceStatus: true,
            user: { select: { email: true, firstName: true, lastName: true } },
          },
        })
      : [];
    const regByEmail = new Map(
      regs.map((r) => [r.user.email.toLowerCase(), r] as const),
    );

    const attendedCount = regs.filter(
      (r) =>
        r.postEventAttendanceStatus === PostEventAttendanceStatus.VERIFIED,
    ).length;
    const registeredCount = regs.filter(
      (r) =>
        r.status === ProgramRegistrationStatus.APPROVED ||
        r.status === ProgramRegistrationStatus.PENDING ||
        r.status === ProgramRegistrationStatus.WAITLISTED,
    ).length;

    const mapped: InvitationListRow[] = rows.map((r) => {
      const reg = regByEmail.get(r.toEmail.toLowerCase());
      let registrationOutcome: InvitationListRow['registrationOutcome'] =
        'NONE';
      if (reg) {
        if (
          reg.postEventAttendanceStatus === PostEventAttendanceStatus.VERIFIED
        ) {
          registrationOutcome = 'ATTENDED';
        } else if (reg.status === ProgramRegistrationStatus.APPROVED) {
          registrationOutcome = 'APPROVED';
        } else if (reg.status === ProgramRegistrationStatus.REJECTED) {
          registrationOutcome = 'REJECTED';
        } else {
          registrationOutcome = 'REGISTERED';
        }
      }
      const displayName =
        r.toName?.trim() ||
        (reg
          ? [reg.user.firstName, reg.user.lastName].filter(Boolean).join(' ')
          : null) ||
        null;

      return {
        id: r.id,
        toEmail: r.toEmail,
        toName: displayName,
        emailType: r.emailType,
        status: r.status,
        sentAt: r.createdAt.toISOString(),
        sentBy: r.sentByUserId ? 'ADMIN' : 'AUTOMATIC',
        sentByUserId: r.sentByUserId,
        sesMessageId: r.sesMessageId,
        errorMessage: r.errorMessage,
        registrationOutcome,
        registrationId: reg?.id ?? r.registrationId,
        canResend:
          r.status === OutboundEmailStatus.FAILED ||
          r.status === OutboundEmailStatus.BOUNCED ||
          r.emailType === OutboundEmailType.REGISTRATION_INVITE,
      };
    });

    return {
      programId: program.id,
      programTitle: program.title,
      total,
      totals: {
        ...totals,
        registered: registeredCount,
        attended: attendedCount,
      },
      rows: mapped,
    };
  }

  async exportCsv(
    programId: string,
    opts: {
      q?: string;
      status?: OutboundEmailStatus;
      emailType?: OutboundEmailType;
    } = {},
  ): Promise<{ filename: string; body: string }> {
    const data = await this.list(programId, { ...opts, take: 1000, skip: 0 });
    const header = [
      'name',
      'email',
      'invite_type',
      'sent_at',
      'sent_by',
      'delivery_status',
      'registration_outcome',
      'error',
    ];
    const lines = [header.join(',')];
    for (const r of data.rows) {
      lines.push(
        [
          csvEscape(r.toName ?? ''),
          csvEscape(r.toEmail),
          r.emailType,
          r.sentAt,
          r.sentBy,
          r.status,
          r.registrationOutcome,
          csvEscape(r.errorMessage ?? ''),
        ].join(','),
      );
    }
    return {
      filename: `program-${programId}-invitations.csv`,
      body: lines.join('\n'),
    };
  }

  /**
   * Re-send a failed/bounced (or registration invite) row after optional email correction.
   */
  async resend(
    programId: string,
    logId: string,
    admin: { userId: string; email?: string | null; role?: string | null },
    opts?: { correctedEmail?: string },
  ) {
    const existing = await this.prisma.outboundEmailLog.findFirst({
      where: { id: logId, programId },
    });
    if (!existing) throw new NotFoundException('Invitation log not found');

    if (
      existing.status !== OutboundEmailStatus.FAILED &&
      existing.status !== OutboundEmailStatus.BOUNCED &&
      existing.emailType !== OutboundEmailType.REGISTRATION_INVITE
    ) {
      throw new BadRequestException(
        'Only failed, bounced, or registration-invite rows can be re-sent.',
      );
    }

    const toEmail = (
      opts?.correctedEmail?.trim() || existing.toEmail
    ).toLowerCase();
    if (!toEmail.includes('@')) {
      throw new BadRequestException('A valid email address is required.');
    }

    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: {
        id: true,
        title: true,
        startDate: true,
        duration: true,
        description: true,
        hostDisplayName: true,
        sponsorName: true,
        zoomJoinUrl: true,
        zoomSessionType: true,
      },
    });
    if (!program) throw new NotFoundException('Program not found');

    const base = (
      this.config.get<string>('frontendUrl') || 'https://communityhealth.media'
    ).replace(/\/$/, '');

    if (existing.emailType === OutboundEmailType.REGISTRATION_INVITE) {
      const { token, id: inviteId } = await this.invites.createInvite({
        email: toEmail,
        programIds: [programId],
        createdByAdminId: admin.userId,
      });
      const inviteUrl = `${base}/join?invite=${encodeURIComponent(token)}`;
      await this.sesEmail.sendRegistrationInviteEmail({
        to: toEmail,
        firstName: existing.toName ?? '',
        sessions: [
          {
            title: program.title,
            startDate: program.startDate,
            duration: program.duration,
          },
        ],
        registerUrl: inviteUrl,
        programIds: [programId],
        inviteId,
        userId: existing.userId,
        sentByUserId: admin.userId,
        resentFromId: existing.id,
      });
    } else if (existing.emailType === OutboundEmailType.OPERATIONAL) {
      await this.sesEmail.sendOperationalEmail({
        to: toEmail,
        subject: existing.subject || `Update: ${program.title}`,
        textBody:
          'This is a re-send of a previous operational notice. Please contact support if you need the original message.',
        programTitle: program.title,
        programId,
        userId: existing.userId,
        sentByUserId: admin.userId,
      });
    } else if (existing.emailType === OutboundEmailType.PRE_SESSION_REMINDER) {
      await this.sesEmail.sendPreWebinarReminderEmail({
        to: toEmail,
        firstName: existing.toName || 'there',
        hoursUntilStart: 24,
        program: {
          id: program.id,
          title: program.title,
          description: program.description ?? '',
          startDate: program.startDate,
          duration: program.duration,
          zoomJoinUrl: program.zoomJoinUrl,
          hostDisplayName: program.hostDisplayName,
          sponsorName: program.sponsorName ?? '',
          zoomSessionType: program.zoomSessionType,
        },
        sentByUserId: admin.userId,
        resentFromId: existing.id,
      });
    } else {
      throw new BadRequestException(
        `Re-send is not supported for ${existing.emailType} yet.`,
      );
    }

    this.audit.record({
      actorId: admin.userId,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: 'POST /admin/programs/:id/invitations/:logId/resend',
      resource: 'OutboundEmailLog',
      resourceId: logId,
      metadata: {
        programId,
        priorStatus: existing.status,
        correctedEmail: opts?.correctedEmail ? toEmail : undefined,
        emailType: existing.emailType,
      },
    });

    return { ok: true as const };
  }
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
