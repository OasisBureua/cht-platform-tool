import axios from 'axios';
import { resolveApiBaseUrl } from '../config/app-urls';

const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

type AuthHeaderGetter = () => Promise<Record<string, string>>;
type UnauthorizedHandler = () => void;

let authHeaderGetter: AuthHeaderGetter | null = null;
let onUnauthorized: UnauthorizedHandler | null = null;

export function setAuthHeaderGetter(getter: AuthHeaderGetter | null) {
  authHeaderGetter = getter;
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler;
}

/** Matches the backend 403 code sent before the current terms are accepted. */
export const TERMS_NOT_ACCEPTED_CODE = 'TERMS_NOT_ACCEPTED';

let onTermsRequired: (() => void) | null = null;

export function setTermsRequiredHandler(handler: (() => void) | null) {
  onTermsRequired = handler;
}

apiClient.interceptors.request.use(
  async (config) => {
    if (authHeaderGetter) {
      try {
        const headers = await authHeaderGetter();
        Object.assign(config.headers, headers);
      } catch {
        // Ignore - no auth available
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = String(error.config?.url ?? '');
      // Never force-logout from auth bootstrap / login endpoints: that causes
      // gray-screen / bounce loops during Cognito Google callback races.
      const isAuthEndpoint =
        /\/auth\/(me|login|logout|cognito|login-oauth|signup|password|mfa)/i.test(url);
      if (!isAuthEndpoint) {
        onUnauthorized?.();
      }
    }
    if (
      error.response?.status === 403 &&
      error.response?.data?.code === TERMS_NOT_ACCEPTED_CODE
    ) {
      onTermsRequired?.();
    }
    return Promise.reject(error);
  },
);

/** NestJS often returns `{ message: string | string[] }` on 4xx; axios uses generic `Error` otherwise.
 *
 * Network errors (no status) use the caller fallback. Useful 5xx Nest messages are kept;
 * only blank / literal "Internal server error" fall back so real config errors still show.
 */
export function getApiErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  const ax = err as {
    response?: { status?: number; data?: { message?: string | string[] } };
  };
  const m = ax.response?.data?.message;
  const status = ax.response?.status;
  const serverMessage = Array.isArray(m)
    ? m.filter(Boolean).join('; ').trim()
    : typeof m === 'string'
      ? m.trim()
      : '';
  if (status === undefined) return fallback;
  if (status >= 500) {
    if (
      serverMessage &&
      serverMessage.toLowerCase() !== 'internal server error'
    ) {
      return serverMessage;
    }
    return fallback;
  }
  if (serverMessage) return serverMessage;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export default apiClient;
