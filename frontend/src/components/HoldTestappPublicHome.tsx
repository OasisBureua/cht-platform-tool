import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { isTestappHost } from '../config/app-urls';
import { useAuth } from '../contexts/AuthContext';

/**
 * On testapp, keep the public marketing home off until launch.
 * Signed-in users go to the HCP home; everyone else goes to login.
 * Remove this wrapper when the public site is ready to ship.
 */
export default function HoldTestappPublicHome({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (!isTestappHost()) {
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
