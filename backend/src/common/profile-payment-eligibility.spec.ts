import {
  isProfileCompleteForPayments,
  listMissingProfilePaymentFields,
} from './profile-payment-eligibility';

describe('profile-payment-eligibility', () => {
  it('treats StudentResearcher as complete without NPI when phone is set', () => {
    expect(
      isProfileCompleteForPayments({
        specialty: 'StudentResearcher',
        npiNumber: null,
        phoneNumber: '+15551234567',
      }),
    ).toBe(true);
    expect(
      listMissingProfilePaymentFields({
        specialty: 'StudentResearcher',
        npiNumber: null,
        phoneNumber: '+15551234567',
      }),
    ).toEqual([]);
  });

  it('requires NPI for Oncologist', () => {
    expect(
      listMissingProfilePaymentFields({
        specialty: 'Oncologist',
        npiNumber: null,
        phoneNumber: '+15551234567',
      }),
    ).toEqual(['npi']);
  });

  it('lists only fields that are actually missing', () => {
    expect(
      listMissingProfilePaymentFields({
        specialty: 'Physician',
        npiNumber: '1234567890',
        phoneNumber: null,
      }),
    ).toEqual(['phone']);
  });
});
