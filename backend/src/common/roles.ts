import { UserRole } from '@prisma/client';

/** Roles that can access the admin panel and admin APIs. */
export function isPlatformAdmin(
  role: UserRole | string | null | undefined,
): boolean {
  return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
}

export function isSuperAdmin(
  role: UserRole | string | null | undefined,
): boolean {
  return role === UserRole.SUPER_ADMIN;
}

/**
 * Whether `actor` satisfies a `@Roles(...)` requirement.
 * SUPER_ADMIN inherits every ADMIN-gated capability.
 */
export function roleSatisfiesRequirement(
  actorRole: UserRole | string | null | undefined,
  required: UserRole[],
): boolean {
  if (!actorRole || !required.length) return false;
  if (required.includes(actorRole as UserRole)) return true;
  if (
    actorRole === UserRole.SUPER_ADMIN &&
    required.includes(UserRole.ADMIN)
  ) {
    return true;
  }
  return false;
}
