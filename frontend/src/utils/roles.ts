/** Roles that can access the admin panel. */
export function isPlatformAdmin(role: string | null | undefined): boolean {
  const r = (role ?? '').toUpperCase();
  return r === 'ADMIN' || r === 'SUPER_ADMIN';
}

export function isSuperAdmin(role: string | null | undefined): boolean {
  return (role ?? '').toUpperCase() === 'SUPER_ADMIN';
}

export type PlatformRole = 'HCP' | 'KOL' | 'ADMIN' | 'SUPER_ADMIN';

export {
  hasAdminCapability,
  adminCapabilityDeniedMessage,
  guardAdminAction,
  CAPABILITY_TO_COGNITO_GROUP,
  ADMIN_CAPABILITIES,
  type AdminCapability,
} from './admin-capabilities';
