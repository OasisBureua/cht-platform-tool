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
  role?: string;
}

interface AuthError {
  message?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ error?: AuthError }>;
  signUp: (
    email: string,
    password: string,
    options?: { fullName?: string; profession?: string },
  ) => Promise<{ error?: AuthError }>;
  resetPasswordForEmail: (email: string) => Promise<{ error?: AuthError }>;
  logout: () => void;
  getAuthHeaders: () => Promise<Record<string, string>>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_TOKEN_KEY = 'cht-session-token';
const DEV_USER_KEY = 'cht-dev-user-id';

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
    if (!userId || userId === 'session') {
      if (userId === 'session') {
        setIsLoading(true);
        fetch(`${apiUrl.replace(/\/$/, '')}/auth/me`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.userId) {
              setProfile({
                userId: data.userId,
                email: data.email,
                name: data.name,
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

  const user: AuthUser | null =
    userId && userId !== 'session'
      ? profile || { userId: devUserId, email: '', name: 'User' }
      : profile;

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(`${apiUrl.replace(/\/$/, '')}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: (email || '').trim(), password: password || '' }),
      });
      const data = await res.json().catch(() => ({}));

      if (data.error) {
        return { error: { message: data.error } };
      }

      if (data.session_token) {
        setSessionToken(data.session_token);
        setDevUserId('');
        setProfile({
          userId: data.userId,
          email: data.email,
          name: data.name,
          role: data.role,
        });
      } else if (data.userId) {
        setSessionToken(null);
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

  const signUp = useCallback(
    async (
      _email: string,
      _password: string,
      _options?: { fullName?: string; profession?: string },
    ) => {
      return { error: { message: 'Sign up is not available. Use the Join page.' } };
    },
    [],
  );

  const resetPasswordForEmail = useCallback(async (_email: string) => {
    return { error: { message: 'Password reset is not available.' } };
  }, []);

  const logout = useCallback(() => {
    setSessionToken(null);
    setDevUserId('');
    setProfile(null);
    try {
      if (typeof localStorage?.removeItem === 'function') {
        localStorage.removeItem(SESSION_TOKEN_KEY);
        localStorage.removeItem(DEV_USER_KEY);
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
    login,
    signUp,
    resetPasswordForEmail,
    logout,
    getAuthHeaders,
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
          login: async () => ({}),
          signUp: async () => ({}),
          resetPasswordForEmail: async () => ({}),
          logout: () => {},
          getAuthHeaders: async () => ({}),
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
