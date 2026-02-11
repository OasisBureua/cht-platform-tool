import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { setAuthHeaderGetter, setUnauthorizedHandler } from '../api/client';
import { supabase } from '../lib/supabase';
import type { AuthError, Session, User as SupabaseUser } from '@supabase/supabase-js';

const DEV_USER_ID = import.meta.env.VITE_DEV_USER_ID;
const USE_DEV_AUTH = import.meta.env.VITE_USE_DEV_AUTH === 'true';

export interface AuthUser {
  userId: string;
  email?: string;
  name?: string;
  role?: string;
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

function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [apiUser, setApiUser] = useState<AuthUser | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const apiUrl = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      userLoading && setUserLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.access_token) {
      setApiUser(null);
      setUserLoading(false);
      return;
    }
    let cancelled = false;
    setUserLoading(true);
    fetch(`${apiUrl.replace(/\/$/, '')}/auth/me`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const sbUser = session.user as SupabaseUser & { user_metadata?: { full_name?: string } };
        if (data?.userId) {
          setApiUser({
            userId: data.userId,
            email: data.email || sbUser?.email,
            name: data.name || sbUser?.user_metadata?.full_name || sbUser?.email,
            role: data.role,
          });
        } else {
          setApiUser({
            userId: sbUser?.id || '',
            email: sbUser?.email,
            name: sbUser?.user_metadata?.full_name || sbUser?.email,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          const sbUser = session.user;
          setApiUser({
            userId: sbUser?.id || '',
            email: sbUser?.email,
            name: (sbUser as SupabaseUser & { user_metadata?: { full_name?: string } })?.user_metadata?.full_name || sbUser?.email,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setUserLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, apiUrl]);

  const user = apiUser;
  const isLoading = userLoading;

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };
    setSession(data.session);
    return {};
  }, []);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      options?: { fullName?: string; profession?: string },
    ) => {
      const metadata: Record<string, string> = {};
      if (options?.fullName) metadata.full_name = options.fullName;
      if (options?.profession) metadata.profession = options.profession;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: Object.keys(metadata).length ? { data: metadata } : undefined,
      });
      if (error) return { error };
      if (data.session) setSession(data.session);
      return {};
    },
    [],
  );

  const resetPasswordForEmail = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return error ? { error } : {};
  }, []);

  const logout = useCallback(() => {
    supabase.auth.signOut();
    setSession(null);
    setApiUser(null);
  }, []);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    if (s?.access_token) {
      return { Authorization: `Bearer ${s.access_token}` };
    }
    return {};
  }, []);

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
    setApiUser(null);
    setSession(null);
    window.location.href = '/login';
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(handleUnauthorized);
    return () => setUnauthorizedHandler(null);
  }, [handleUnauthorized]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function DevAuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string>(() => {
    return DEV_USER_ID || localStorage.getItem('cht-dev-user-id') || '';
  });
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const apiUrl = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    if (userId) {
      localStorage.setItem('cht-dev-user-id', userId);
    } else {
      localStorage.removeItem('cht-dev-user-id');
      setProfile(null);
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setIsLoading(true);
    fetch(`${apiUrl.replace(/\/$/, '')}/auth/me`, {
      headers: { 'X-Dev-User-Id': userId },
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
        } else {
          setProfile({ userId, email: 'dev@chtplatform.local', name: 'Dev User' });
        }
      })
      .catch(() => {
        if (!cancelled) setProfile({ userId, email: 'dev@chtplatform.local', name: 'Dev User' });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, apiUrl]);

  const user: AuthUser | null = userId ? (profile || { userId, email: 'dev@chtplatform.local', name: 'Dev User' }) : null;

  const login = useCallback(
    async (_email: string, _password: string) => {
      const id = prompt(
        'Dev mode: Enter user ID (run: cd backend && npx prisma db seed, then copy ID)',
        userId || '',
      );
      if (id) setUserId(id.trim());
      return {};
    },
    [userId],
  );

  const signUp = useCallback(
    async (_email: string, _password: string, _options?: { fullName?: string; profession?: string }) => {
      alert('Dev mode: Use seed users. Run: cd backend && npx prisma db seed');
      return {};
    },
    [],
  );

  const resetPasswordForEmail = useCallback(async () => {
    alert('Dev mode: Password reset not available. Use seed users.');
    return {};
  }, []);

  const logout = useCallback(() => {
    setUserId('');
    localStorage.removeItem('cht-dev-user-id');
  }, []);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (!userId) return {};
    return { 'X-Dev-User-Id': userId };
  }, [userId]);

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
    setUserId('');
    setProfile(null);
    localStorage.removeItem('cht-dev-user-id');
    window.location.href = '/login';
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(handleUnauthorized);
    return () => setUnauthorizedHandler(null);
  }, [handleUnauthorized]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (USE_DEV_AUTH) {
    return <DevAuthProvider>{children}</DevAuthProvider>;
  }
  return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
