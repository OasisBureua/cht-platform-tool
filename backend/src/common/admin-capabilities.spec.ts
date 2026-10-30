import {
  capabilitiesFromCognitoGroups,
  hasAdminCapability,
  COGNITO_GROUP_ADMIN_PAYMENTS,
  COGNITO_GROUP_ADMIN_PROGRAMS,
} from './admin-capabilities';

describe('admin-capabilities', () => {
  it('maps Cognito domain groups to capabilities in stable order', () => {
    expect(
      capabilitiesFromCognitoGroups([
        COGNITO_GROUP_ADMIN_PROGRAMS,
        'cht-admin',
        COGNITO_GROUP_ADMIN_PAYMENTS,
      ]),
    ).toEqual(['payments', 'programs']);
  });

  it('ignores unknown groups', () => {
    expect(capabilitiesFromCognitoGroups(['cht-hcp', 'other'])).toEqual([]);
  });

  it('hasAdminCapability checks membership', () => {
    expect(hasAdminCapability(['payments'], 'payments')).toBe(true);
    expect(hasAdminCapability(['payments'], 'programs')).toBe(false);
    expect(hasAdminCapability(null, 'payments')).toBe(false);
  });
});
