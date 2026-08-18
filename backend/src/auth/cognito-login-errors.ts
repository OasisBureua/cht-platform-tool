/** Thrown when Cognito returns a challenge the login flow does not handle. */
export class CognitoUnhandledChallengeError extends Error {
  constructor(public readonly challengeName: string) {
    super(`Unhandled Cognito challenge: ${challengeName}`);
    this.name = 'CognitoUnhandledChallengeError';
  }
}

export const LOGIN_GENERIC_ERROR =
  'We couldn’t complete sign-in. Please try again, or continue with Google if your account is linked.';

export const LOGIN_RATE_LIMIT_ERROR =
  'Too many sign-in attempts. Wait a few minutes and try again.';

export const LOGIN_UNVERIFIED_ERROR =
  'Please verify your email before signing in. Check your inbox for a code, or request a new one.';

export const LOGIN_INVALID_CREDENTIALS = 'Invalid email or password.';

export const LOGIN_TIMEOUT_ERROR = 'Login timed out. Please try again.';

export const LOGIN_SESSION_EXPIRED =
  'This sign-in step expired. Enter your email and password again.';

export const LOGIN_MFA_CODE_INVALID =
  'That code is incorrect. Check your authenticator app and try again.';

export const LOGIN_NEW_PASSWORD_REQUIRED =
  'You need to set a new password before signing in. Use Forgot Password to continue.';

export type CognitoLoginErrorCode =
  | 'EMAIL_NOT_VERIFIED'
  | 'RATE_LIMITED'
  | 'INVALID_CREDENTIALS'
  | 'GENERIC';

export type MappedCognitoLoginError = {
  error: string;
  code: CognitoLoginErrorCode;
};

function combinedText(err: unknown): string {
  if (!(err instanceof Error)) return String(err ?? '');
  return `${err.name} ${err.message}`;
}

/**
 * Map Cognito / SDK failures to user-actionable copy.
 * Never return raw AWS exception names or internal throw strings to the client.
 */
export function mapCognitoLoginException(err: unknown): MappedCognitoLoginError {
  const text = combinedText(err);

  if (err instanceof CognitoUnhandledChallengeError) {
    if (err.challengeName === 'NEW_PASSWORD_REQUIRED') {
      return { error: LOGIN_NEW_PASSWORD_REQUIRED, code: 'GENERIC' };
    }
    return { error: LOGIN_GENERIC_ERROR, code: 'GENERIC' };
  }

  if (/UserNotConfirmedException/i.test(text)) {
    return { error: LOGIN_UNVERIFIED_ERROR, code: 'EMAIL_NOT_VERIFIED' };
  }

  if (
    /PasswordResetRequiredException/i.test(text) ||
    /NEW_PASSWORD_REQUIRED/i.test(text)
  ) {
    return { error: LOGIN_NEW_PASSWORD_REQUIRED, code: 'GENERIC' };
  }

  if (
    /NotAuthorizedException|UserNotFoundException|incorrect username or password|not authorized/i.test(
      text,
    )
  ) {
    return { error: LOGIN_INVALID_CREDENTIALS, code: 'INVALID_CREDENTIALS' };
  }

  if (
    /TooManyRequestsException|LimitExceededException|TooManyFailedAttemptsException/i.test(
      text,
    )
  ) {
    return { error: LOGIN_RATE_LIMIT_ERROR, code: 'RATE_LIMITED' };
  }

  if (/aborted|timeout|TimeoutError/i.test(text)) {
    return { error: LOGIN_TIMEOUT_ERROR, code: 'GENERIC' };
  }

  if (
    /CodeMismatchException|EnableSoftwareTokenMFAException|MFA code verification failed/i.test(
      text,
    )
  ) {
    return { error: LOGIN_MFA_CODE_INVALID, code: 'GENERIC' };
  }

  if (
    /ExpiredCodeException|Invalid session|session.*expir|sign-in step expired/i.test(
      text,
    )
  ) {
    return { error: LOGIN_SESSION_EXPIRED, code: 'GENERIC' };
  }

  return { error: LOGIN_GENERIC_ERROR, code: 'GENERIC' };
}

export function cognitoErrorLogFields(err: unknown): {
  name: string;
  message: string;
  challenge?: string;
} {
  const name = err instanceof Error ? err.name : 'Error';
  const message = err instanceof Error ? err.message : String(err ?? '');
  const challenge =
    err instanceof CognitoUnhandledChallengeError
      ? err.challengeName
      : undefined;
  return { name, message, challenge };
}
