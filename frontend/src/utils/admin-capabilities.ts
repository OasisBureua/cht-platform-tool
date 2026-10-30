import { isSuperAdmin } from './roles';

/** Domain write capabilities — mirrors backend `AdminCapability`. */
export const ADMIN_CAPABILITIES = [
  'payments',
  'programs',
  'surveys',
  'reports',
  'content',
] as const;

export type AdminCapability = (typeof ADMIN_CAPABILITIES)[number];

export const CAPABILITY_TO_COGNITO_GROUP: Record<AdminCapability, string> = {
  payments: 'cht-admin-payments',
  programs: 'cht-admin-programs',
  surveys: 'cht-admin-surveys',
  reports: 'cht-admin-reports',
  content: 'cht-admin-content',
};

export function hasAdminCapability(
  user: { role?: string | null; capabilities?: string[] | null } | null | undefined,
  capability: AdminCapability,
): boolean {
  if (!user) return false;
  if (isSuperAdmin(user.role)) return true;
  return (user.capabilities ?? []).includes(capability);
}

export function adminCapabilityDeniedMessage(capability: AdminCapability): string {
  const group = CAPABILITY_TO_COGNITO_GROUP[capability];
  return `You need the Cognito group ${group} to do this.`;
}

/**
 * Run `onAllowed` when the user has the domain write capability.
 * Otherwise show a message (alert by default) and do not call `onAllowed`.
 * Prefer also setting `disabled={!hasAdminCapability(...)}` on buttons.
 */
export function guardAdminAction(
  user: { role?: string | null; capabilities?: string[] | null } | null | undefined,
  capability: AdminCapability,
  onAllowed: () => void,
  onDenied?: (message: string) => void,
): boolean {
  if (hasAdminCapability(user, capability)) {
    onAllowed();
    return true;
  }
  const message = adminCapabilityDeniedMessage(capability);
  if (onDenied) onDenied(message);
  else window.alert(message);
  return false;
}
