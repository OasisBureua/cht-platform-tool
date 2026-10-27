import { Injectable, Logger } from '@nestjs/common';
import {
  OutboundEmailStatus,
  OutboundEmailType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type RecordOutboundEmailInput = {
  toEmail: string;
  toName?: string | null;
  emailType: OutboundEmailType;
  status: OutboundEmailStatus;
  programIds?: string[];
  programId?: string | null;
  userId?: string | null;
  registrationId?: string | null;
  inviteId?: string | null;
  sentByUserId?: string | null;
  sesMessageId?: string | null;
  subject?: string | null;
  errorMessage?: string | null;
  resentFromId?: string | null;
};

@Injectable()
export class OutboundEmailLogService {
  private readonly logger = new Logger(OutboundEmailLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persist one log row per programId (multi-program invites appear on each event).
   * Never throws — email send must not fail because logging failed.
   */
  record(input: RecordOutboundEmailInput): void {
    void this.persist(input);
  }

  private async persist(input: RecordOutboundEmailInput): Promise<void> {
    try {
      const toEmail = input.toEmail.trim().toLowerCase();
      if (!toEmail) return;

      const programIds = [
        ...new Set(
          [
            ...(input.programIds ?? []),
            ...(input.programId ? [input.programId] : []),
          ]
            .map((id) => id.trim())
            .filter(Boolean),
        ),
      ];

      const targets =
        programIds.length > 0
          ? programIds
          : [null as string | null];

      await this.prisma.outboundEmailLog.createMany({
        data: targets.map((programId) => ({
          toEmail,
          toName: input.toName?.trim() || null,
          emailType: input.emailType,
          status: input.status,
          programId,
          userId: input.userId ?? null,
          registrationId: input.registrationId ?? null,
          inviteId: input.inviteId ?? null,
          sentByUserId: input.sentByUserId ?? null,
          sesMessageId: input.sesMessageId ?? null,
          subject: input.subject?.slice(0, 500) ?? null,
          errorMessage: input.errorMessage?.slice(0, 1000) ?? null,
          resentFromId: input.resentFromId ?? null,
          providerStatusAt:
            input.status === OutboundEmailStatus.SENT ||
            input.status === OutboundEmailStatus.FAILED
              ? new Date()
              : null,
        })),
      });
    } catch (err) {
      this.logger.error(
        `Failed to write OutboundEmailLog for ${input.toEmail}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  async updateStatusBySesMessageId(
    sesMessageId: string,
    status: OutboundEmailStatus,
    errorMessage?: string | null,
  ): Promise<number> {
    const result = await this.prisma.outboundEmailLog.updateMany({
      where: { sesMessageId },
      data: {
        status,
        errorMessage: errorMessage?.slice(0, 1000) ?? undefined,
        providerStatusAt: new Date(),
      },
    });
    return result.count;
  }

  async listForProgram(
    programId: string,
    opts: {
      q?: string;
      status?: OutboundEmailStatus;
      emailType?: OutboundEmailType;
      skip?: number;
      take?: number;
    } = {},
  ) {
    const where: Prisma.OutboundEmailLogWhereInput = {
      programId,
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.emailType ? { emailType: opts.emailType } : {}),
      ...(opts.q?.trim()
        ? {
            OR: [
              {
                toEmail: {
                  contains: opts.q.trim(),
                  mode: 'insensitive',
                },
              },
              {
                toName: {
                  contains: opts.q.trim(),
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const take = Math.min(Math.max(opts.take ?? 200, 1), 1000);
    const skip = Math.max(opts.skip ?? 0, 0);

    const [rows, total, invitedAll, statusGroups, typeGroups] =
      await Promise.all([
        this.prisma.outboundEmailLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        this.prisma.outboundEmailLog.count({ where }),
        this.prisma.outboundEmailLog.count({ where: { programId } }),
        this.prisma.outboundEmailLog.groupBy({
          by: ['status'],
          where: { programId },
          _count: { _all: true },
        }),
        this.prisma.outboundEmailLog.groupBy({
          by: ['emailType'],
          where: { programId },
          _count: { _all: true },
        }),
      ]);

    const totalsByStatus = Object.fromEntries(
      statusGroups.map((g) => [g.status, g._count._all]),
    ) as Record<string, number>;

    return {
      rows,
      total,
      totals: {
        invited: invitedAll,
        sent: totalsByStatus.SENT ?? 0,
        delivered: totalsByStatus.DELIVERED ?? 0,
        bounced: totalsByStatus.BOUNCED ?? 0,
        failed: totalsByStatus.FAILED ?? 0,
        unsubscribed: totalsByStatus.UNSUBSCRIBED ?? 0,
        byType: Object.fromEntries(
          typeGroups.map((g) => [g.emailType, g._count._all]),
        ),
      },
    };
  }
}
