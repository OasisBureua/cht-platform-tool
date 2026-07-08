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
import { resolveApiBaseUrl } from '../config/app-urls';
import { cognitoAuthEnabled, mediahubAuthDecommissioned } from '../lib/auth-config';
import { buildCognitoLogoutUrl } from '../lib/cognito-oauth';

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
  /** GoTrue/Cognito JWT for chatbot (unlimited queries). Null when using dev auth or token not available. */
  accessToken: string | null;
  login: (
    email: string,
    password: string,
    recaptchaToken?: string,
  ) => Promise<{ error?: AuthError; mfa?: { session: string } }>;
  /** Legacy GoTrue OAuth access_token exchange. Use completeCognitoCallback for Cognito PKCE. */
  loginOAuth: (accessToken: string) => Promise<{ error?: AuthError; profileComplete?: boolean; role?: string }>;
  /** Exchange Cognito authorization code (PKCE) for CHT session cookie. */
  completeCognitoCallback: (
    code: string,
    redirectUri: string,
    codeVerifier: string,
  ) => Promise<{ error?: AuthError; profileComplete?: boolean; role?: string }>;
  /** Complete Cognito SOFTWARE_TOKEN_MFA after login returns a challenge. */
  completeMfaLogin: (
    email: string,
    session: string,
    code: string,
  ) => Promise<{ error?: AuthError }>;
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
    recaptchaToken?: string,
  ) => Promise<{ error?: AuthError }>;
  confirmEmailSignup: (email: string, code: string) => Promise<{ error?: AuthError }>;
  resendEmailVerificationCode: (email: string) => Promise<{ error?: AuthError }>;
  resetPasswordForEmail: (email: string) => Promise<{ error?: AuthError }>;
  confirmPasswordReset: (
    email: string,
    code: string,
    newPassword: string,
  ) => Promise<{ error?: AuthError }>;
  beginMfaSetup: () => Promise<{
    error?: AuthError;
    secretCode?: string;
    otpauthUri?: string;
  }>;
  verifyMfaSetup: (code: string) => Promise<{ error?: AuthError }>;
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
      completeCognitoCallback: async () => ({ error: { message: DISABLE_AUTH_FEATURE_MSG } }),
      completeMfaLogin: async () => ({ error: { message: DISABLE_AUTH_FEATURE_MSG } }),
      signUp: async () => ({ error: { message: DISABLE_AUTH_FEATURE_MSG } }),
      confirmEmailSignup: async () => ({ error: { message: DISABLE_AUTH_FEATURE_MSG } }),
      resendEmailVerificationCode: async () => ({
        error: { message: DISABLE_AUTH_FEATURE_MSG },
      }),
      resetPasswordForEmail: async () => ({ error: { message: DISABLE_AUTH_FEATURE_MSG } }),
      confirmPasswordReset: async () => ({
        error: { message: DISABLE_AUTH_FEATURE_MSG },
      }),
      beginMfaSetup: async () => ({ error: { message: DISABLE_AUTH_FEATURE_MSG } }),
      verifyMfaSetup: async () => ({ error: { message: DISABLE_AUTH_FEATURE_MSG } }),
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

const DEV_USER_KEY = 'cht-dev-user-id';

function authFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { credentials: 'include', ...init });
}

function BackendAuthProvider({ children }: { children: ReactNode }) {
  if (import.meta.env.VITE_DISABLE_AUTH === 'true') {
    return <DisabledAuthProvider>{children}</DisabledAuthProvider>;
  }

  const apiUrl = resolveApiBaseUrl();
  const [authMode, setAuthMode] = useState<'cookie' | 'dev' | null>(null);
  const [devUserId, setDevUserId] = useState<string>(() => {
    try {
      return typeof localStorage?.getItem === 'function' ? localStorage.getItem(DEV_USER_KEY) || '' : '';
    } catch {
      return '';
    }
  });
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      localStorage?.removeItem?.('cht-session-token');
      localStorage?.removeItem?.('cht-access-token');
    } catch {
      /* ignore legacy tokens */
    }
  }, []);

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
    let cancelled = false;
    setIsLoading(true);

    const loadProfile = async () => {
      const meUrl = `${apiUrl.replace(/\/$/, '')}/auth/me`;

      if (authMode !== 'dev') {
        try {
          const res = await authFetch(meUrl, { cache: 'no-store' });
          const data = res.ok ? await res.json().catch(() => null) : null;
          if (!cancelled && data?.userId) {
            setAuthMode('cookie');
            setProfile({
              userId: data.userId,
              email: data.email,
              name: data.name,
              firstName: data.firstName,
              lastName: data.lastName,
              role: data.role,
              profileComplete: data.profileComplete ?? true,
            });
            return;
          }
        } catch {
          /* fall through */
        }
      }

      if (devUserId) {
        try {
          const res = await fetch(meUrl, { headers: { 'X-Dev-User-Id': devUserId } });
          const data = res.ok ? await res.json().catch(() => null) : null;
          if (!cancelled && data?.userId) {
            setAuthMode('dev');
            setProfile({
              userId: data.userId,
              email: data.email,
              name: data.name,
              firstName: data.firstName,
              lastName: data.lastName,
              role: data.role,
              profileComplete: data.profileComplete ?? true,
            });
            return;
          }
        } catch {
          /* ignore */
        }
      }

      if (!cancelled) {
        setAuthMode(null);
        setProfile(null);
      }
    };

    void loadProfile().finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [authMode, devUserId, apiUrl]);

  const refreshProfile = useCallback(async () => {
    const meUrl = `${apiUrl.replace(/\/$/, '')}/auth/me`;
    if (authMode === 'cookie') {
      const res = await authFetch(meUrl, { cache: 'no-store' });
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
    } else if (authMode === 'dev' && devUserId) {
      const res = await fetch(meUrl, { headers: { 'X-Dev-User-Id': devUserId } });
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
  }, [authMode, devUserId, apiUrl]);

  const user: AuthUser | null =
    authMode === 'dev' && devUserId
      ? profile || { userId: devUserId, email: '', name: 'User' }
      : profile;

  const applyLoginSuccess = useCallback((data: Record<string, unknown>) => {
    if (data.session_token) {
      setAuthMode('cookie');
      setDevUserId('');
      setAccessToken((data.access_token as string | undefined) ?? null);
      setProfile({
        userId: data.userId as string,
        email: data.email as string | undefined,
        name: data.name as string | undefined,
        firstName: data.firstName as string | undefined,
        lastName: data.lastName as string | undefined,
        role: data.role as string | undefined,
        profileComplete: (data.profileComplete as boolean | undefined) ?? true,
      });
      return true;
    }
    if (data.userId) {
      setAuthMode('dev');
      setAccessToken(null);
      setDevUserId(data.userId as string);
      setProfile({
        userId: data.userId as string,
        email: data.email as string | undefined,
        name: data.name as string | undefined,
        role: data.role as string | undefined,
      });
      return true;
    }
    return false;
  }, []);

  const login = useCallback(
    async (email: string, password: string, recaptchaToken?: string) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const loginPath = cognitoAuthEnabled ? '/auth/cognito/login' : '/auth/login';
      let res: Response;
      try {
        res = await authFetch(`${apiUrl.replace(/\/$/, '')}${loginPath}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: (email || '').trim(),
            password: password || '',
            recaptchaToken,
          }),
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

      if (data.challenge === 'SOFTWARE_TOKEN_MFA' && data.session) {
        return { mfa: { session: data.session as string } };
      }

      if (applyLoginSuccess(data)) {
        return {};
      }
      return { error: { message: 'Login failed.' } };
    },
    [apiUrl, applyLoginSuccess],
  );

  const completeMfaLogin = useCallback(
    async (email: string, session: string, code: string) => {
      const res = await authFetch(`${apiUrl.replace(/\/$/, '')}/auth/cognito/mfa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: (email || '').trim(),
          session,
          code: (code || '').trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.error) {
        return { error: { message: data.error } };
      }
      if (applyLoginSuccess(data)) {
        return {};
      }
      return { error: { message: 'MFA login failed.' } };
    },
    [apiUrl, applyLoginSuccess],
  );

  const completeCognitoCallback = useCallback(
    async (code: string, redirectUri: string, codeVerifier: string) => {
      const res = await authFetch(`${apiUrl.replace(/\/$/, '')}/auth/cognito/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          redirect_uri: redirectUri.trim(),
          code_verifier: codeVerifier.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (data.error) {
        return { error: { message: data.error } };
      }

      if (applyLoginSuccess(data)) {
        return {
          profileComplete: data.profileComplete as boolean | undefined,
          role: data.role as string | undefined,
        };
      }
      return { error: { message: 'Login failed.' } };
    },
    [apiUrl, applyLoginSuccess],
  );

  const loginOAuth = useCallback(
    async (accessTokenValue: string) => {
      if (mediahubAuthDecommissioned && !cognitoAuthEnabled) {
        return {
          error: {
            message:
              'Google OAuth is temporarily unavailable while auth is migrating.',
          },
        };
      }
      const token = (accessTokenValue || '').trim();
      if (!token) return { error: { message: 'Access token is required.' } };

      const res = await authFetch(`${apiUrl.replace(/\/$/, '')}/auth/login-oauth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token }),
      });
      const data = await res.json().catch(() => ({}));

      if (data.error) {
        return { error: { message: data.error } };
      }

      if (applyLoginSuccess(data)) {
        return {
          profileComplete: data.profileComplete as boolean | undefined,
          role: data.role as string | undefined,
        };
      }
      return { error: { message: 'Login failed.' } };
    },
    [apiUrl, applyLoginSuccess],
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
      recaptchaToken?: string,
    ) => {
      if (mediahubAuthDecommissioned && !cognitoAuthEnabled) {
        return {
          error: {
            message:
              'New account creation is temporarily unavailable while auth is migrating.',
          },
        };
      }
      const signupPath = cognitoAuthEnabled ? '/auth/cognito/signup' : '/auth/signup';
      const res = await fetch(`${apiUrl.replace(/\/$/, '')}${signupPath}`, {
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
          recaptchaToken,
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

  const confirmEmailSignup = useCallback(
    async (email: string, code: string) => {
      if (!cognitoAuthEnabled) {
        return { error: { message: 'Email verification is not available.' } };
      }
      const res = await fetch(`${apiUrl.replace(/\/$/, '')}/auth/cognito/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: (email || '').trim(),
          code: (code || '').trim(),
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

  const resendEmailVerificationCode = useCallback(
    async (email: string) => {
      if (!cognitoAuthEnabled) {
        return { error: { message: 'Email verification is not available.' } };
      }
      const res = await fetch(`${apiUrl.replace(/\/$/, '')}/auth/cognito/resend-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: (email || '').trim() }),
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

  const confirmPasswordReset = useCallback(
    async (email: string, code: string, newPassword: string) => {
      const emailStr = (email || '').trim();
      const codeStr = (code || '').trim();
      const nextPassword = (newPassword || '').trim();

      if (!emailStr) return { error: { message: 'Email is required.' } };
      if (!codeStr) return { error: { message: 'Reset code is required.' } };
      if (!nextPassword || nextPassword.length < 8) {
        return { error: { message: 'Password must be at least 8 characters.' } };
      }

      const res = await fetch(`${apiUrl.replace(/\/$/, '')}/auth/recover/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: emailStr,
          code: codeStr,
          password: nextPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { error: { message: data?.error || 'Password reset failed.' } };
      }
      if (data.error) {
        return { error: { message: data.error } };
      }
      return {};
    },
    [apiUrl],
  );

  const beginMfaSetup = useCallback(async () => {
    const res = await authFetch(`${apiUrl.replace(/\/$/, '')}/auth/mfa/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { error: { message: data?.error || 'Could not start MFA setup.' } };
    }
    if (data.error) {
      return { error: { message: data.error } };
    }
    return {
      secretCode: data.secretCode as string | undefined,
      otpauthUri: data.otpauthUri as string | undefined,
    };
  }, [apiUrl]);

  const verifyMfaSetup = useCallback(
    async (code: string) => {
      const codeStr = (code || '').trim();
      if (!codeStr) return { error: { message: 'MFA code is required.' } };

      const res = await authFetch(`${apiUrl.replace(/\/$/, '')}/auth/mfa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeStr }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { error: { message: data?.error || 'MFA verification failed.' } };
      }
      if (data.error) {
        return { error: { message: data.error } };
      }
      return {};
    },
    [apiUrl],
  );

  const logout = useCallback(() => {
    const finishLogout = () => {
      setAuthMode(null);
      setDevUserId('');
      setAccessToken(null);
      setProfile(null);
      try {
        if (typeof localStorage?.removeItem === 'function') {
          localStorage.removeItem(DEV_USER_KEY);
        }
        if (typeof sessionStorage?.removeItem === 'function') {
          sessionStorage.removeItem('cht-profile-reminder-seen');
        }
      } catch {
        /* ignore */
      }

      if (cognitoAuthEnabled) {
        try {
          window.location.href = buildCognitoLogoutUrl();
          return;
        } catch {
          /* fall through to /login */
        }
      }
      window.location.href = '/login';
    };

    void authFetch(`${apiUrl.replace(/\/$/, '')}/auth/logout`, { method: 'POST' })
      .catch(() => {})
      .finally(finishLogout);
  }, [apiUrl]);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (authMode === 'dev' && devUserId) {
      return { 'X-Dev-User-Id': devUserId };
    }
    return {};
  }, [authMode, devUserId]);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    accessToken,
    login,
    loginOAuth,
    completeCognitoCallback,
    completeMfaLogin,
    signUp,
    confirmEmailSignup,
    resendEmailVerificationCode,
    resetPasswordForEmail,
    confirmPasswordReset,
    beginMfaSetup,
    verifyMfaSetup,
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
