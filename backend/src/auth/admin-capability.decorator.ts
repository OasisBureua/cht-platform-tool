import { SetMetadata } from '@nestjs/common';
import type { AdminCapability } from '../common/admin-capabilities';

export const ADMIN_CAPABILITY_KEY = 'adminCapability';

/** Require a domain write capability (or SUPER_ADMIN) on mutating admin routes. */
export const RequireAdminCapability = (capability: AdminCapability) =>
  SetMetadata(ADMIN_CAPABILITY_KEY, capability);
