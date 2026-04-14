import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
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
  profileComplete?: boolean;
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
  /** Exchange GoTrue OAuth access_token (Google/Apple) for CHT session. Returns profileComplete when successful. */
  loginOAuth: (accessToken: string) => Promise<{ error?: AuthError; profileComplete?: boolean; role?: string }>;
  signUp: (
    email: string,
    password: string,
    options?: {
      firstName?: string;
      lastName?: string;
      profession?: string;
      npiNumber?: string;
      institution?: string;
      city?: string;
      state?: string;
      zipCode?: string;
    },
  ) => Promise<{ error?: AuthError }>;
  resetPasswordForEmail: (email: string) => Promise<{ error?: AuthError }>;
  logout: () => void;
  getAuthHeaders: () => Promise<Record<string, string>>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DISABLE_AUTH_FEATURE_MSG = 'Not available while VITE_DISABLE_AUTH is enabled.';

/**
 * When VITE_DISABLE_AUTH=true, ProtectedRoute still skips checks, but login forms need a real
 * isAuthenticated transition. This provider sets a mock user after submit (ADMIN on /admin/login).
 */
function DisabledAuthProvider({ children }: { children: ReactNode }) {
  const [bypassUser, setBypassUser] = useState<AuthUser | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    void password;
    const trimmed = (email || '').trim();
    const adminPath =
      typeof window !== 'undefined' && window.location.pathname.includes('/admin/login');
    setBypassUser({
      userId: 'dev-auth-bypass',
      email: trimmed || 'dev@local',
      name: 'Dev (auth bypass)',
      role: adminPath ? 'ADMIN' : 'USER',
      profileComplete: true,
    });
    return {};
  }, []);

  const logout = useCallback(() => {
    setBypassUser(null);
  }, []);

  const getAuthHeaders = useCallback(async () => ({}), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: bypassUser,
      isAuthenticated: !!bypassUser,
      isLoading: false,
      accessToken: null,
      login,
      loginOAuth: async () => ({ error: { message: DISABLE_AUTH_FEATURE_MSG } }),
      signUp: async () => ({ error: { message: DISABLE_AUTH_FEATURE_MSG } }),
      resetPasswordForEmail: async () => ({ error: { message: DISABLE_AUTH_FEATURE_MSG } }),
      logout,
      getAuthHeaders,
      refreshProfile: async () => {},
    }),
    [bypassUser, login, logout, getAuthHeaders],
  );

  useEffect(() => {
    setAuthHeaderGetter(getAuthHeaders);
    return () => setAuthHeaderGetter(null);
  }, [getAuthHeaders]);

  useEffect(() => {
    const on401 = () => {
      logout();
      window.location.href = '/login';
    };
    setUnauthorizedHandler(on401);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const SESSION_TOKEN_KEY = 'cht-session-token';
const DEV_USER_KEY = 'cht-dev-user-id';
const ACCESS_TOKEN_KEY = 'cht-access-token';

function BackendAuthProvider({ children }: { children: ReactNode }) {
  if (import.meta.env.VITE_DISABLE_AUTH === 'true') {
    return <DisabledAuthProvider>{children}</DisabledAuthProvider>;
  }

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
                profileComplete: data.profileComplete ?? true,
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
            profileComplete: data.profileComplete ?? true,
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
          profileComplete: data.profileComplete ?? true,
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
          profileComplete: data.profileComplete ?? true,
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
          profileComplete: data.profileComplete ?? true,
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
          profileComplete: data.profileComplete ?? true,
        });
        setIsLoading(true);
        return { profileComplete: data.profileComplete ?? true, role: data.role as string | undefined };
      }
      return { error: { message: 'Login failed.' } };
    },
    [apiUrl],
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      options?: {
        firstName?: string;
        lastName?: string;
        profession?: string;
        npiNumber?: string;
        institution?: string;
        city?: string;
        state?: string;
        zipCode?: string;
      },
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
          institution: options?.institution,
          city: options?.city,
          state: options?.state,
          zipCode: options?.zipCode,
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
