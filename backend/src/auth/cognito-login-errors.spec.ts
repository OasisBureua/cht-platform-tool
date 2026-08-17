import {
  CognitoUnhandledChallengeError,
  LOGIN_GENERIC_ERROR,
  LOGIN_INVALID_CREDENTIALS,
  LOGIN_MFA_CODE_INVALID,
  LOGIN_NEW_PASSWORD_REQUIRED,
  LOGIN_RATE_LIMIT_ERROR,
  LOGIN_TIMEOUT_ERROR,
  LOGIN_UNVERIFIED_ERROR,
  cognitoErrorLogFields,
  mapCognitoLoginException,
} from './cognito-login-errors';

describe('mapCognitoLoginException', () => {
  it('maps UserNotConfirmedException to verify-email copy', () => {
    const err = Object.assign(new Error('User is not confirmed.'), {
      name: 'UserNotConfirmedException',
    });
    expect(mapCognitoLoginException(err)).toEqual({
      error: LOGIN_UNVERIFIED_ERROR,
      code: 'EMAIL_NOT_VERIFIED',
    });
  });

  it('maps NotAuthorizedException to invalid credentials', () => {
    const err = Object.assign(new Error('Incorrect username or password.'), {
      name: 'NotAuthorizedException',
    });
    expect(mapCognitoLoginException(err)).toEqual({
      error: LOGIN_INVALID_CREDENTIALS,
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('maps rate-limit exceptions', () => {
    const err = Object.assign(new Error('Rate exceeded'), {
      name: 'TooManyRequestsException',
    });
    expect(mapCognitoLoginException(err)).toEqual({
      error: LOGIN_RATE_LIMIT_ERROR,
      code: 'RATE_LIMITED',
    });
  });

  it('maps unhandled MFA_SETUP-class challenge to generic copy', () => {
    const err = new CognitoUnhandledChallengeError('SMS_MFA');
    expect(mapCognitoLoginException(err)).toEqual({
      error: LOGIN_GENERIC_ERROR,
      code: 'GENERIC',
    });
  });

  it('maps NEW_PASSWORD_REQUIRED challenge to forgot-password copy', () => {
    const err = new CognitoUnhandledChallengeError('NEW_PASSWORD_REQUIRED');
    expect(mapCognitoLoginException(err)).toEqual({
      error: LOGIN_NEW_PASSWORD_REQUIRED,
      code: 'GENERIC',
    });
  });

  it('maps timeout and MFA code mismatch', () => {
    expect(
      mapCognitoLoginException(Object.assign(new Error('aborted'), { name: 'TimeoutError' })),
    ).toEqual({ error: LOGIN_TIMEOUT_ERROR, code: 'GENERIC' });
    expect(
      mapCognitoLoginException(
        Object.assign(new Error('Invalid code'), { name: 'CodeMismatchException' }),
      ),
    ).toEqual({ error: LOGIN_MFA_CODE_INVALID, code: 'GENERIC' });
  });

  it('never returns raw SDK strings for unknown errors', () => {
    const mapped = mapCognitoLoginException(
      new Error('Cognito login did not return tokens'),
    );
    expect(mapped.error).toBe(LOGIN_GENERIC_ERROR);
    expect(mapped.error).not.toMatch(/Cognito login did not return tokens/);
    expect(mapped.error).not.toMatch(/UserNotConfirmedException/);
  });

  it('includes challenge name in log fields', () => {
    const fields = cognitoErrorLogFields(
      new CognitoUnhandledChallengeError('MFA_SETUP'),
    );
    expect(fields).toMatchObject({
      name: 'CognitoUnhandledChallengeError',
      challenge: 'MFA_SETUP',
    });
  });
});
