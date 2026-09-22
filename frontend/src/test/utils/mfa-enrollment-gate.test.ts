import { describe, it, expect } from 'vitest';
import { shouldPromptSoftMfaEnrollment } from '../../utils/mfa-enrollment-gate';

describe('shouldPromptSoftMfaEnrollment', () => {
  it('prompts only for soft AppConfig enrollment without Cognito MFA', () => {
    expect(
      shouldPromptSoftMfaEnrollment({
        mfaEnrollmentRequired: true,
        cognitoMfa: false,
      }),
    ).toBe(true);
  });

  it('never prompts when Cognito MFA challenge/setup is in play', () => {
    expect(
      shouldPromptSoftMfaEnrollment({
        mfaEnrollmentRequired: true,
        cognitoMfa: true,
      }),
    ).toBe(false);
  });

  it('does not prompt when enrollment is not required', () => {
    expect(
      shouldPromptSoftMfaEnrollment({
        mfaEnrollmentRequired: false,
        cognitoMfa: false,
      }),
    ).toBe(false);
  });
});
