import type { CookieOptions, Request, Response } from 'express';

export const SESSION_COOKIE_NAME = 'cht_session';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function sessionCookieOptions(
  maxAgeSeconds: number,
  nodeEnv?: string,
): CookieOptions {
  const isProd =
    (nodeEnv ?? process.env.NODE_ENV ?? '').toLowerCase() === 'production' ||
    (nodeEnv ?? process.env.NODE_ENV ?? '').toLowerCase() === 'prod';

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds * 1000,
  };
}

export function setSessionCookie(
  res: Response,
  token: string,
  maxAgeSeconds: number,
  nodeEnv?: string,
): void {
  res.cookie(
    SESSION_COOKIE_NAME,
    token,
    sessionCookieOptions(maxAgeSeconds, nodeEnv),
  );
}

export function clearSessionCookie(res: Response, nodeEnv?: string): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    ...sessionCookieOptions(0, nodeEnv),
    maxAge: undefined,
  });
}

export function getSessionTokenFromRequest(request: Request): string | null {
  const cookieToken = request.cookies?.[SESSION_COOKIE_NAME];
  if (typeof cookieToken === 'string' && UUID_REGEX.test(cookieToken)) {
    return cookieToken;
  }

  const headerToken =
    request.headers['x-session-token'] ||
    (request.headers.authorization?.startsWith?.('Bearer ')
      ? request.headers.authorization.slice(7).trim()
      : null);

  if (typeof headerToken === 'string' && UUID_REGEX.test(headerToken)) {
    return headerToken;
  }

  return null;
}
