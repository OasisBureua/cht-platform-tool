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
      // Never force-logout from auth bootstrap / login endpoints — that causes
      // gray-screen / bounce loops during Cognito Google callback races.
      const isAuthEndpoint =
        /\/auth\/(me|login|logout|cognito|login-oauth|signup|password|mfa)/i.test(url);
      if (!isAuthEndpoint) {
        onUnauthorized?.();
      }
    }
    return Promise.reject(error);
  },
);

/** NestJS often returns `{ message: string | string[] }` on 4xx; axios uses generic `Error` otherwise.
 *
 * On 5xx or network errors the server-side `message` is usually missing; falling through
 * to axios's own `err.message` leaks strings like "Request failed with status code 502"
 * into curator-facing toasts. Prefer the caller-supplied `fallback` for that case.
 */
export function getApiErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  const ax = err as {
    response?: { status?: number; data?: { message?: string | string[] } };
  };
  const m = ax.response?.data?.message;
  if (Array.isArray(m)) return m.filter(Boolean).join('; ');
  if (typeof m === 'string' && m.trim()) return m;
  const status = ax.response?.status;
  // 5xx (and no-response network errors, which have no status) => use fallback
  // instead of leaking axios's generic "Request failed with status code N" text.
  if (status === undefined || status >= 500) return fallback;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export default apiClient;
