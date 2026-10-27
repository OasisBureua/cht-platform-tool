import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isProdAppHost } from '../config/app-urls';
import { useAuth } from '../contexts/AuthContext';

/**
 * On app.communityhealth.media only /login and /join are public entry points.
 * Auth continuation paths stay reachable so OAuth / MFA / password reset work.
 */
function isProdAppPublicAllowed(pathname: string): boolean {
  if (pathname === '/login' || pathname === '/join') return true;
  // Required for login/join to complete — not marketed as public pages.
  if (pathname === '/auth/callback') return true;
  if (pathname === '/forgot-password') return true;
  if (pathname.startsWith('/reset-password/')) return true;
  if (pathname === '/mfa/setup') return true;
  if (pathname === '/verify-email') return true;
  if (pathname === '/complete-profile') return true;
  if (pathname === '/privacy' || pathname === '/terms' || pathname === '/beta-terms') {
    return true;
  }
  return false;
}

/**
 * Hide the public marketing surface on app.communityhealth.media until launch.
 * Only /login and /join (plus login-flow continuations) stay visible.
 * Remove this gate when the public site is ready on that host.
 */
export default function HoldPlatformPublicSite({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { pathname } = useLocation();

  if (!isProdAppHost()) {
    return <>{children}</>;
  }

  if (isProdAppPublicAllowed(pathname)) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-brand-600"
          aria-hidden
        />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/app/home" replace />;
  }

  return <Navigate to="/login" replace />;
}
