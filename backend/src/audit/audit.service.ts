import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AuditRecordInput = {
  actorId: string;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  resource?: string | null;
  resourceId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Fire-and-forget write; never throws to callers. */
  record(entry: AuditRecordInput): void {
    void this.persist(entry);
  }

  private async persist(entry: AuditRecordInput): Promise<void> {
    try {
      await this.prisma.adminAuditLog.create({
        data: {
          actorId: entry.actorId || 'unknown',
          actorEmail: entry.actorEmail ?? null,
          actorRole: entry.actorRole ?? null,
          action: entry.action,
          resource: entry.resource ?? null,
          resourceId: entry.resourceId ?? null,
          metadata: entry.metadata ?? undefined,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit log for ${entry.action}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
