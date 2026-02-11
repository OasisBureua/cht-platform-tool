import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

type AuthHeaderGetter = () => Promise<Record<string, string>>;
type UnauthorizedHandler = () => void;

let authHeaderGetter: AuthHeaderGetter | null = null;
let onUnauthorized: UnauthorizedHandler | null = null;

export function setAuthHeaderGetter(getter: AuthHeaderGetter) {
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
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

export default apiClient;
