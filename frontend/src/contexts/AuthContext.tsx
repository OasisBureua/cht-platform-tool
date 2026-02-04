import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { setAuthHeaderGetter, setUnauthorizedHandler } from '../api/client';

const AUTH0_DOMAIN = import.meta.env.VITE_AUTH0_DOMAIN;
const AUTH0_CLIENT_ID = import.meta.env.VITE_AUTH0_CLIENT_ID;
const AUTH0_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE;
const DEV_USER_ID = import.meta.env.VITE_DEV_USER_ID;

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
  login: () => void;
  logout: () => void;
  getAuthHeaders: () => Promise<Record<string, string>>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function Auth0Provider({ children }: { children: ReactNode }) {
  // Dynamic import to avoid loading Auth0 when not configured
  const [Auth0ProviderComponent, setAuth0Provider] = useState<React.ComponentType<{
    domain: string;
    clientId: string;
    authorizationParams: { redirect_uri: string; audience?: string };
    children: ReactNode;
  }> | null>(null);
  const [useAuth0Hook, setUseAuth0Hook] = useState<() => {
    isAuthenticated: boolean;
    isLoading: boolean;
    user?: { sub?: string; email?: string; name?: string };
    loginWithRedirect: () => Promise<void>;
    logout: (args?: { logoutParams?: { returnTo: string } }) => void;
    getAccessTokenSilently: (opts?: { authorizationParams?: { audience: string } }) => Promise<string>;
  } | null>(null);

  useEffect(() => {
    import('@auth0/auth0-react').then((mod) => {
      setAuth0Provider(() => mod.Auth0Provider);
      setUseAuth0Hook(() => mod.useAuth0);
    });
  }, []);

  if (!Auth0ProviderComponent || !useAuth0Hook) {
    return <div className="min-h-screen flex items-center justify-center">Loading auth...</div>;
  }

  const redirectUri = typeof window !== 'undefined' ? window.location.origin + '/app/home' : '';

  return (
    <Auth0ProviderComponent
      domain={AUTH0_DOMAIN!}
      clientId={AUTH0_CLIENT_ID!}
      authorizationParams={{
        redirect_uri: redirectUri,
        ...(AUTH0_AUDIENCE && { audience: AUTH0_AUDIENCE }),
      }}
    >
      <Auth0Inner useAuth0={useAuth0Hook}>{children}</Auth0Inner>
    </Auth0ProviderComponent>
  );
}

type UseAuth0Hook = () => {
  isAuthenticated: boolean;
  isLoading: boolean;
  user?: { sub?: string; email?: string; name?: string };
  loginWithRedirect: () => Promise<void>;
  logout: (args?: { logoutParams?: { returnTo: string } }) => void;
  getAccessTokenSilently: (opts?: { authorizationParams?: { audience: string } }) => Promise<string>;
};

function Auth0Inner({ children, useAuth0 }: { children: ReactNode; useAuth0: UseAuth0Hook }) {
  const {
    isAuthenticated,
    isLoading: auth0Loading,
    user: auth0User,
    loginWithRedirect,
    logout: auth0Logout,
    getAccessTokenSilently,
  } = useAuth0();

  const [apiUser, setApiUser] = useState<AuthUser | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const apiUrl = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    if (!isAuthenticated) {
      setApiUser(null);
      setUserLoading(false);
      return;
    }
    let cancelled = false;
    setUserLoading(true);
    getAccessTokenSilently(
      AUTH0_AUDIENCE ? { authorizationParams: { audience: AUTH0_AUDIENCE } } : undefined,
    )
      .then((token) =>
        fetch(`${apiUrl.replace(/\/$/, '')}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.userId) {
          setApiUser({
            userId: data.userId,
            email: data.email || auth0User?.email,
            name: data.name || auth0User?.name,
            role: data.role,
          });
        } else {
          setApiUser(
            auth0User?.sub
              ? { userId: auth0User.sub, email: auth0User.email, name: auth0User.name }
              : null,
          );
        }
      })
      .catch(() => {
        if (!cancelled)
          setApiUser(
            auth0User?.sub
              ? { userId: auth0User.sub, email: auth0User.email, name: auth0User.name }
              : null,
          );
      })
      .finally(() => {
        if (!cancelled) setUserLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, auth0User, getAccessTokenSilently, apiUrl]);

  const user = apiUser;
  const isLoading = auth0Loading || userLoading;

  const login = useCallback(() => {
    loginWithRedirect();
  }, [loginWithRedirect]);

  const logout = useCallback(() => {
    auth0Logout({ logoutParams: { returnTo: window.location.origin } });
  }, [auth0Logout]);

  const getAuthHeaders = useCallback(async () => {
    try {
      const token = await getAccessTokenSilently(
        AUTH0_AUDIENCE ? { authorizationParams: { audience: AUTH0_AUDIENCE } } : undefined,
      );
      return { Authorization: `Bearer ${token}` };
    } catch {
      return {};
    }
  }, [getAccessTokenSilently]);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    getAuthHeaders,
  };

  useEffect(() => {
    setAuthHeaderGetter(getAuthHeaders);
  }, [getAuthHeaders]);

  const handleUnauthorized = useCallback(() => {
    setApiUser(null);
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
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
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
      });
    return () => { cancelled = true; };
  }, [userId, apiUrl]);

  const user: AuthUser | null = userId ? (profile || { userId, email: 'dev@chtplatform.local', name: 'Dev User' }) : null;

  const login = useCallback(() => {
    const id = prompt(
      'Dev mode: Enter user ID (run: cd backend && npx prisma db seed, then copy ID)',
      userId || '',
    );
    if (id) setUserId(id.trim());
  }, [userId]);

  const logout = useCallback(() => {
    setUserId('');
    localStorage.removeItem('cht-dev-user-id');
  }, []);

  const getAuthHeaders = useCallback(async () => {
    if (!userId) return {};
    return { 'X-Dev-User-Id': userId };
  }, [userId]);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
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
  if (AUTH0_DOMAIN && AUTH0_CLIENT_ID) {
    return <Auth0Provider>{children}</Auth0Provider>;
  }
  return <DevAuthProvider>{children}</DevAuthProvider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
