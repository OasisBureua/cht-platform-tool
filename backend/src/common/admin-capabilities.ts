/**
 * Admin domain write capabilities (Create/Update/Delete).
 * All ADMIN users can read admin domains; these unlock mutations.
 * Synced from Cognito groups on login /auth/me.
 */

export const ADMIN_CAPABILITIES = [
  'payments',
  'programs',
  'surveys',
  'reports',
  'content',
] as const;

export type AdminCapability = (typeof ADMIN_CAPABILITIES)[number];

/** Cognito group → capability. Keep in sync with terraform cognito user groups. */
export const COGNITO_GROUP_ADMIN_PAYMENTS = 'cht-admin-payments';
export const COGNITO_GROUP_ADMIN_PROGRAMS = 'cht-admin-programs';
export const COGNITO_GROUP_ADMIN_SURVEYS = 'cht-admin-surveys';
export const COGNITO_GROUP_ADMIN_REPORTS = 'cht-admin-reports';
export const COGNITO_GROUP_ADMIN_CONTENT = 'cht-admin-content';

export const COGNITO_ADMIN_DOMAIN_GROUPS = [
  COGNITO_GROUP_ADMIN_PAYMENTS,
  COGNITO_GROUP_ADMIN_PROGRAMS,
  COGNITO_GROUP_ADMIN_SURVEYS,
  COGNITO_GROUP_ADMIN_REPORTS,
  COGNITO_GROUP_ADMIN_CONTENT,
] as const;

const GROUP_TO_CAPABILITY: Record<string, AdminCapability> = {
  [COGNITO_GROUP_ADMIN_PAYMENTS]: 'payments',
  [COGNITO_GROUP_ADMIN_PROGRAMS]: 'programs',
  [COGNITO_GROUP_ADMIN_SURVEYS]: 'surveys',
  [COGNITO_GROUP_ADMIN_REPORTS]: 'reports',
  [COGNITO_GROUP_ADMIN_CONTENT]: 'content',
};

export const CAPABILITY_TO_COGNITO_GROUP: Record<AdminCapability, string> = {
  payments: COGNITO_GROUP_ADMIN_PAYMENTS,
  programs: COGNITO_GROUP_ADMIN_PROGRAMS,
  surveys: COGNITO_GROUP_ADMIN_SURVEYS,
  reports: COGNITO_GROUP_ADMIN_REPORTS,
  content: COGNITO_GROUP_ADMIN_CONTENT,
};

export function isAdminCapability(
  value: string | null | undefined,
): value is AdminCapability {
  return (
    !!value && (ADMIN_CAPABILITIES as readonly string[]).includes(value)
  );
}

/** Map Cognito group names to sorted unique capability keys. */
export function capabilitiesFromCognitoGroups(
  groups: string[] | null | undefined,
): AdminCapability[] {
  if (!groups?.length) return [];
  const set = new Set<AdminCapability>();
  for (const g of groups) {
    const cap = GROUP_TO_CAPABILITY[g];
    if (cap) set.add(cap);
  }
  return ADMIN_CAPABILITIES.filter((c) => set.has(c));
}

export function hasAdminCapability(
  capabilities: string[] | null | undefined,
  required: AdminCapability,
): boolean {
  return (capabilities ?? []).includes(required);
}
