import { Prisma, UserRole, UserStatus } from '@prisma/client';

export type UserRecipientFilterInput = {
  role?: UserRole;
  status?: UserStatus;
  cities?: string[];
  states?: string[];
  institutions?: string[];
  q?: string;
};

/** Parse comma-separated query values into a de-duplicated trimmed list. */
export function parseCsvQueryParam(value?: string): string[] {
  if (!value?.trim()) return [];
  return [...new Set(value.split(',').map((s) => s.trim()).filter(Boolean))];
}

export function buildUserRecipientWhere(
  opts: UserRecipientFilterInput,
): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};

  if (opts.q?.trim()) {
    const term = opts.q.trim();
    where.OR = [
      { email: { contains: term, mode: 'insensitive' } },
      { firstName: { contains: term, mode: 'insensitive' } },
      { lastName: { contains: term, mode: 'insensitive' } },
    ];
  }

  if (opts.role) where.role = opts.role;
  if (opts.status) where.status = opts.status;

  if (opts.cities?.length) {
    where.city = { in: opts.cities };
  }
  if (opts.states?.length) {
    where.state = { in: opts.states };
  }
  if (opts.institutions?.length) {
    where.institution = { in: opts.institutions };
  }

  return where;
}

export const registrationInviteUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  status: true,
  state: true,
  city: true,
  institution: true,
  createdAt: true,
} satisfies Prisma.UserSelect;
