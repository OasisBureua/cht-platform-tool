import { BadRequestException, Injectable } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type ReportRecipient = {
  userId: string;
  name: string;
  email: string;
};

/** Report notifications may only go to active platform admins. */
@Injectable()
export class ReportRecipientsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAdmins(): Promise<ReportRecipient[]> {
    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    return admins.map((u) => ({
      userId: u.id,
      name: `${u.firstName} ${u.lastName}`.trim(),
      email: u.email.toLowerCase(),
    }));
  }

  /** Returns the deduped, lowercased emails; 400 if any is not an active admin. */
  async requireAdminEmails(emails: string[] | undefined): Promise<string[]> {
    const wanted = [...new Set((emails ?? []).map((e) => e.toLowerCase()))];
    if (wanted.length === 0) return [];

    const admins = await this.prisma.user.findMany({
      where: {
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        email: { in: wanted, mode: 'insensitive' },
      },
      select: { email: true },
    });
    const allowed = new Set(admins.map((a) => a.email.toLowerCase()));
    const rejected = wanted.filter((e) => !allowed.has(e));
    if (rejected.length > 0) {
      throw new BadRequestException(
        `notifyEmails must belong to active admins: ${rejected.join(', ')}`,
      );
    }
    return wanted;
  }
}
