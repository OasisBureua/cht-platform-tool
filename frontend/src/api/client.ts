import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

type AuthHeaderGetter = () => Promise<Record<string, string>>;
let authHeaderGetter: AuthHeaderGetter | null = null;

export function setAuthHeaderGetter(getter: AuthHeaderGetter) {
  authHeaderGetter = getter;
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
      // Caller can redirect to login via useAuth
      console.warn('Unauthorized - token may have expired');
    }
    return Promise.reject(error);
  },
);

export default apiClient;
