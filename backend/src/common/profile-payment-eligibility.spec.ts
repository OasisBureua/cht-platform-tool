import {
  isProfileCompleteForPayments,
  listMissingProfileNameFields,
  listMissingProfilePaymentFields,
} from './profile-payment-eligibility';

describe('profile-payment-eligibility', () => {
  it('treats StudentResearcher as complete without NPI when phone and names are set', () => {
    expect(
      isProfileCompleteForPayments({
        firstName: 'Ada',
        lastName: 'Lovelace',
        specialty: 'StudentResearcher',
        npiNumber: null,
        phoneNumber: '+15551234567',
      }),
    ).toBe(true);
    expect(
      listMissingProfilePaymentFields({
        firstName: 'Ada',
        lastName: 'Lovelace',
        specialty: 'StudentResearcher',
        npiNumber: null,
        phoneNumber: '+15551234567',
      }),
    ).toEqual([]);
  });

  it('requires NPI for Oncologist', () => {
    expect(
      listMissingProfilePaymentFields({
        firstName: 'Ada',
        lastName: 'Lovelace',
        specialty: 'Oncologist',
        npiNumber: null,
        phoneNumber: '+15551234567',
      }),
    ).toEqual(['npi']);
  });

  it('lists only fields that are actually missing', () => {
    expect(
      listMissingProfilePaymentFields({
        firstName: 'Ada',
        lastName: 'Lovelace',
        specialty: 'Physician',
        npiNumber: '1234567890',
        phoneNumber: null,
      }),
    ).toEqual(['phone']);
  });

  it('treats placeholder User first name as missing', () => {
    expect(
      listMissingProfileNameFields({
        firstName: 'User',
        lastName: 'Smith',
      }),
    ).toEqual(['firstName']);
  });

  it('requires first and last name for registration', () => {
    expect(
      listMissingProfileNameFields({
        firstName: '',
        lastName: '',
      }),
    ).toEqual(['firstName', 'lastName']);
  });
});
