import { describe, expect, it, vi } from 'vitest';
import {
  adminCapabilityDeniedMessage,
  guardAdminAction,
  hasAdminCapability,
} from '../../utils/admin-capabilities';

describe('admin-capabilities', () => {
  it('SUPER_ADMIN has every capability', () => {
    expect(
      hasAdminCapability({ role: 'SUPER_ADMIN', capabilities: [] }, 'payments'),
    ).toBe(true);
  });

  it('ADMIN needs the domain capability', () => {
    expect(
      hasAdminCapability({ role: 'ADMIN', capabilities: ['programs'] }, 'payments'),
    ).toBe(false);
    expect(
      hasAdminCapability({ role: 'ADMIN', capabilities: ['payments'] }, 'payments'),
    ).toBe(true);
  });

  it('guardAdminAction runs onAllowed or alerts', () => {
    const allowed = vi.fn();
    const denied = vi.fn();
    expect(
      guardAdminAction(
        { role: 'ADMIN', capabilities: ['payments'] },
        'payments',
        allowed,
        denied,
      ),
    ).toBe(true);
    expect(allowed).toHaveBeenCalled();
    expect(denied).not.toHaveBeenCalled();

    allowed.mockClear();
    expect(
      guardAdminAction(
        { role: 'ADMIN', capabilities: [] },
        'payments',
        allowed,
        denied,
      ),
    ).toBe(false);
    expect(allowed).not.toHaveBeenCalled();
    expect(denied).toHaveBeenCalledWith(adminCapabilityDeniedMessage('payments'));
  });
});
