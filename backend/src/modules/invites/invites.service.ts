import {
  BadRequestException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ProgramStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * SCRUM-175: opaque tokens for unregistered invite links. Server-side lookup
 * keeps the invited email out of URLs and referrer headers; tokens expire and
 * can be consumed on signup.
 */
@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);
  private readonly defaultTtlDays = 14;

  constructor(private prisma: PrismaService) {}

  /**
   * Generate a cryptographically random URL-safe token.
   * 24 random bytes -> 32 base64url characters. Not guessable, not enumerable.
   */
  private generateToken(): string {
    return randomBytes(24).toString('base64url');
  }

  /**
   * Create an invite token for an unregistered email + target programs.
   * Returns the token to be embedded in the invite URL.
   */
  async createInvite(opts: {
    email: string;
    programIds: string[];
    createdByAdminId?: string;
    ttlDays?: number;
  }): Promise<{ id: string; token: string; expiresAt: Date }> {
    const email = opts.email.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('email required');
    }
    if (!opts.programIds?.length) {
      throw new BadRequestException('programIds required');
    }
    const ttlDays = opts.ttlDays ?? this.defaultTtlDays;
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    const token = this.generateToken();
    const row = await this.prisma.registrationInvite.create({
      data: {
        token,
        email,
        programIds: opts.programIds,
        expiresAt,
        createdByAdminId: opts.createdByAdminId ?? null,
      },
      select: { id: true },
    });
    return { id: row.id, token, expiresAt };
  }

  /**
   * Resolve a token to its invite payload. Called by the public
   * GET /api/invites/:token endpoint that the /join page hits.
   * Throws NotFoundException for unknown tokens and GoneException for
   * expired/used tokens (both cases surface a "link no longer valid" state).
   * Program IDs are re-checked against current PUBLISHED status so draft /
   * archived sessions never reach the registration UI via an invite link.
   */
  async resolveInvite(
    token: string,
  ): Promise<{ email: string; programIds: string[] }> {
    if (!token?.trim()) {
      throw new NotFoundException('invite not found');
    }
    const invite = await this.prisma.registrationInvite.findUnique({
      where: { token: token.trim() },
    });
    if (!invite) {
      throw new NotFoundException('invite not found');
    }
    if (invite.usedAt) {
      throw new GoneException('invite already used');
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new GoneException('invite expired');
    }

    const programIds = await this.filterPublishedProgramIds(invite.programIds);
    if (programIds.length === 0) {
      this.logger.warn(
        `[Invites] Token ${invite.id} has no remaining PUBLISHED programs`,
      );
      throw new GoneException('invite sessions unavailable');
    }

    return { email: invite.email, programIds };
  }

  /**
   * Keep only programs that are still PUBLISHED (draft/archived drop out).
   * Preserves the invite's original ID order.
   */
  private async filterPublishedProgramIds(
    programIds: string[],
  ): Promise<string[]> {
    const uniqueIds = [
      ...new Set(programIds.map((id) => id.trim()).filter(Boolean)),
    ];
    if (uniqueIds.length === 0) return [];

    const published = await this.prisma.program.findMany({
      where: {
        id: { in: uniqueIds },
        status: ProgramStatus.PUBLISHED,
      },
      select: { id: true },
    });
    const publishedSet = new Set(published.map((p) => p.id));
    return uniqueIds.filter((id) => publishedSet.has(id));
  }

  /**
   * Mark an invite as consumed. Idempotent (repeat calls no-op).
   * Called after successful signup so the token cannot be reused.
   */
  async consumeInvite(token: string): Promise<void> {
    const trimmed = token?.trim();
    if (!trimmed) return;
    await this.prisma.registrationInvite.updateMany({
      where: { token: trimmed, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}
