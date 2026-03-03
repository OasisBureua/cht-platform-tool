import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { setAuthHeaderGetter, setUnauthorizedHandler } from '../api/client';

export interface AuthUser {
  userId: string;
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

interface AuthError {
  message?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** GoTrue JWT for chatbot (unlimited queries). Null when using dev auth or token not available. */
  accessToken: string | null;
  login: (email: string, password: string) => Promise<{ error?: AuthError }>;
  /** Exchange GoTrue OAuth access_token (Google/Apple) for CHT session. */
  loginOAuth: (accessToken: string) => Promise<{ error?: AuthError }>;
  signUp: (
    email: string,
    password: string,
    options?: { firstName?: string; lastName?: string; profession?: string; npiNumber?: string },
  ) => Promise<{ error?: AuthError }>;
  resetPasswordForEmail: (email: string) => Promise<{ error?: AuthError }>;
  logout: () => void;
  getAuthHeaders: () => Promise<Record<string, string>>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_TOKEN_KEY = 'cht-session-token';
const DEV_USER_KEY = 'cht-dev-user-id';
const ACCESS_TOKEN_KEY = 'cht-access-token';

function BackendAuthProvider({ children }: { children: ReactNode }) {
  const apiUrl = import.meta.env.VITE_API_URL || '/api';
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    try {
      return typeof localStorage?.getItem === 'function' ? localStorage.getItem(SESSION_TOKEN_KEY) : null;
    } catch {
      return null;
    }
  });
  const [devUserId, setDevUserId] = useState<string>(() => {
    try {
      return typeof localStorage?.getItem === 'function' ? localStorage.getItem(DEV_USER_KEY) || '' : '';
    } catch {
      return '';
    }
  });
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    try {
      return typeof localStorage?.getItem === 'function' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
    } catch {
      return null;
    }
  });
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const DISABLE_AUTH = import.meta.env.VITE_DISABLE_AUTH === 'true';

  const userId = sessionToken ? 'session' : devUserId;

  useEffect(() => {
    try {
      if (typeof localStorage?.setItem === 'function' && typeof localStorage?.removeItem === 'function') {
        if (sessionToken) localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
        else localStorage.removeItem(SESSION_TOKEN_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [sessionToken]);

  useEffect(() => {
    try {
      if (typeof localStorage?.setItem === 'function' && typeof localStorage?.removeItem === 'function') {
        if (devUserId) localStorage.setItem(DEV_USER_KEY, devUserId);
        else localStorage.removeItem(DEV_USER_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [devUserId]);

  useEffect(() => {
    try {
      if (typeof localStorage?.setItem === 'function' && typeof localStorage?.removeItem === 'function') {
        if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        else localStorage.removeItem(ACCESS_TOKEN_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [accessToken]);

  useEffect(() => {
    if (!userId || userId === 'session') {
      if (userId === 'session') {
        setIsLoading(true);
        fetch(`${apiUrl.replace(/\/$/, '')}/auth/me`, {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            'X-Session-Token': sessionToken,
          },
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.userId) {
              setProfile({
                userId: data.userId,
                email: data.email,
                name: data.name,
                firstName: data.firstName,
                lastName: data.lastName,
                role: data.role,
              });
            } else {
              setSessionToken(null);
              setProfile(null);
            }
          })
          .catch(() => {
            setSessionToken(null);
            setProfile(null);
          })
          .finally(() => setIsLoading(false));
      } else {
        setProfile(null);
        setIsLoading(false);
      }
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    fetch(`${apiUrl.replace(/\/$/, '')}/auth/me`, {
      headers: { 'X-Dev-User-Id': devUserId },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.userId) {
          setProfile({
            userId: data.userId,
            email: data.email,
            name: data.name,
            firstName: data.firstName,
            lastName: data.lastName,
            role: data.role,
          });
        } else if (!cancelled) {
          setDevUserId('');
          setProfile(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDevUserId('');
          setProfile(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, sessionToken, devUserId, apiUrl]);

  const refreshProfile = useCallback(async () => {
    if (userId === 'session' && sessionToken) {
      const res = await fetch(`${apiUrl.replace(/\/$/, '')}/auth/me`, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          'X-Session-Token': sessionToken,
        },
      });
      const data = await res.json().catch(() => null);
      if (data?.userId) {
        setProfile({
          userId: data.userId,
          email: data.email,
          name: data.name,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
        });
      }
    } else if (devUserId) {
      const res = await fetch(`${apiUrl.replace(/\/$/, '')}/auth/me`, {
        headers: { 'X-Dev-User-Id': devUserId },
      });
      const data = await res.json().catch(() => null);
      if (data?.userId) {
        setProfile({
          userId: data.userId,
          email: data.email,
          name: data.name,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
        });
      }
    }
  }, [userId, sessionToken, devUserId, apiUrl]);

  const user: AuthUser | null =
    userId && userId !== 'session'
      ? profile || { userId: devUserId, email: '', name: 'User' }
      : profile;

  const login = useCallback(
    async (email: string, password: string) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      let res: Response;
      try {
        res = await fetch(`${apiUrl.replace(/\/$/, '')}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: (email || '').trim(), password: password || '' }),
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timeout);
        const msg =
          err instanceof Error && err.name === 'AbortError'
            ? 'Request timed out. Please try again.'
            : 'Login failed. Please try again.';
        return { error: { message: msg } };
      }
      clearTimeout(timeout);
      const data = await res.json().catch(() => ({}));

      if (data.error) {
        return { error: { message: data.error } };
      }

      if (data.session_token) {
        setSessionToken(data.session_token);
        setDevUserId('');
        setAccessToken(data.access_token ?? null);
        setProfile({
          userId: data.userId,
          email: data.email,
          name: data.name,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
        });
        // Keep isLoading true until /api/auth/me validates - prevents app from rendering
        // and making API calls before authHeaderGetter is updated (which caused 401 → redirect)
        setIsLoading(true);
      } else if (data.userId) {
        setSessionToken(null);
        setAccessToken(null);
        setDevUserId(data.userId);
        setProfile({
          userId: data.userId,
          email: data.email,
          name: data.name,
          role: data.role,
        });
      } else {
        return { error: { message: 'Login failed.' } };
      }
      return {};
    },
    [apiUrl],
  );

  const loginOAuth = useCallback(
    async (accessToken: string) => {
      const token = (accessToken || '').trim();
      if (!token) return { error: { message: 'Access token is required.' } };

      const res = await fetch(`${apiUrl.replace(/\/$/, '')}/auth/login-oauth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token }),
      });
      const data = await res.json().catch(() => ({}));

      if (data.error) {
        return { error: { message: data.error } };
      }

      if (data.session_token) {
        setSessionToken(data.session_token);
        setDevUserId('');
        setAccessToken(data.access_token ?? null);
        setProfile({
          userId: data.userId,
          email: data.email,
          name: data.name,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
        });
        setIsLoading(true);
      } else {
        return { error: { message: 'Login failed.' } };
      }
      return {};
    },
    [apiUrl],
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      options?: { firstName?: string; lastName?: string; profession?: string; npiNumber?: string },
    ) => {
      const res = await fetch(`${apiUrl.replace(/\/$/, '')}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: (email || '').trim(),
          password,
          firstName: options?.firstName,
          lastName: options?.lastName,
          profession: options?.profession,
          npiNumber: options?.npiNumber,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (data.error) {
        return { error: { message: data.error } };
      }
      return {};
    },
    [apiUrl],
  );

  const resetPasswordForEmail = useCallback(
    async (email: string) => {
      const emailStr = (email || '').trim();
      if (!emailStr) return { error: { message: 'Email is required.' } };

      const res = await fetch(`${apiUrl.replace(/\/$/, '')}/auth/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailStr }),
      });
      const data = await res.json().catch(() => ({}));

      if (data.error) {
        return { error: { message: data.error } };
      }
      return {};
    },
    [apiUrl],
  );

  const logout = useCallback(() => {
    setSessionToken(null);
    setDevUserId('');
    setAccessToken(null);
    setProfile(null);
    try {
      if (typeof localStorage?.removeItem === 'function') {
        localStorage.removeItem(SESSION_TOKEN_KEY);
        localStorage.removeItem(DEV_USER_KEY);
        localStorage.removeItem(ACCESS_TOKEN_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (sessionToken) {
      return { Authorization: `Bearer ${sessionToken}` };
    }
    if (devUserId) {
      return { 'X-Dev-User-Id': devUserId };
    }
    return {};
  }, [sessionToken, devUserId]);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    accessToken,
    login,
    loginOAuth,
    signUp,
    resetPasswordForEmail,
    logout,
    getAuthHeaders,
    refreshProfile,
  };

  useEffect(() => {
    setAuthHeaderGetter(getAuthHeaders);
  }, [getAuthHeaders]);

  const handleUnauthorized = useCallback(() => {
    logout();
    window.location.href = '/login';
  }, [logout]);

  useEffect(() => {
    setUnauthorizedHandler(handleUnauthorized);
    return () => setUnauthorizedHandler(null);
  }, [handleUnauthorized]);

  if (DISABLE_AUTH) {
    return (
      <AuthContext.Provider
        value={{
          user: null,
          isAuthenticated: false,
          isLoading: false,
          accessToken: null,
          login: async () => ({}),
          loginOAuth: async () => ({}),
          signUp: async () => ({}),
          resetPasswordForEmail: async () => ({}),
          logout: () => {},
          getAuthHeaders: async () => ({}),
          refreshProfile: async () => {},
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return <BackendAuthProvider>{children}</BackendAuthProvider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
