import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { FormJotformScope } from './form-jotform-scope';

const TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class FormJotformProgressService {
  constructor(private prisma: PrismaService) {}

  private expiresAt(): Date {
    return new Date(Date.now() + TTL_MS);
  }

  async getResumeSession(
    userId: string,
    scope: FormJotformScope,
    refId: string,
  ): Promise<{ sessionId: string; expiresAt: string } | null> {
    const row = await this.prisma.formJotformProgress.findUnique({
      where: { userId_scope_refId: { userId, scope, refId } },
    });
    if (!row) return null;
    if (row.expiresAt.getTime() <= Date.now()) {
      await this.prisma.formJotformProgress.delete({ where: { id: row.id } }).catch(() => {});
      return null;
    }
    return { sessionId: row.sessionId, expiresAt: row.expiresAt.toISOString() };
  }

  async saveResumeSession(userId: string, scope: FormJotformScope, refId: string, sessionId: string) {
    const sid = sessionId.trim();
    return this.prisma.formJotformProgress.upsert({
      where: { userId_scope_refId: { userId, scope, refId } },
      create: {
        userId,
        scope,
        refId,
        sessionId: sid,
        expiresAt: this.expiresAt(),
      },
      update: {
        sessionId: sid,
        expiresAt: this.expiresAt(),
      },
    });
  }

  async clear(userId: string, scope: FormJotformScope, refId: string): Promise<void> {
    await this.prisma.formJotformProgress
      .deleteMany({ where: { userId, scope, refId } })
      .catch(() => {});
  }
}
