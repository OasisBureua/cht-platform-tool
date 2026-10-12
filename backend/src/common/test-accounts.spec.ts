import { isTestAccountEmail } from './test-accounts';

describe('isTestAccountEmail', () => {
  it('matches the SES simulator domain, including plus labels and case', () => {
    expect(isTestAccountEmail('success@simulator.amazonses.com')).toBe(true);
    expect(
      isTestAccountEmail(' Success+cpr49-01@Simulator.AmazonSES.com '),
    ).toBe(true);
  });

  it('does not match real or look-alike domains', () => {
    expect(isTestAccountEmail('dr.smith@communityhealth.media')).toBe(false);
    expect(isTestAccountEmail('a@notsimulator.amazonses.com')).toBe(false);
    expect(isTestAccountEmail('simulator.amazonses.com@gmail.com')).toBe(false);
  });

  it('is false for empty input', () => {
    expect(isTestAccountEmail('')).toBe(false);
    expect(isTestAccountEmail(null)).toBe(false);
    expect(isTestAccountEmail(undefined)).toBe(false);
  });
});
