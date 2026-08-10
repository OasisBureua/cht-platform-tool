import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const DISABLE_AUTH = import.meta.env.VITE_DISABLE_AUTH === 'true';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  /** When requireAdmin, redirect unauthenticated users here (default: /admin/login) */
  loginPath?: string;
}

export default function ProtectedRoute({ children, requireAdmin, loginPath }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (DISABLE_AUTH) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-white px-4">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900"
          aria-hidden
        />
        <p className="text-sm font-medium text-gray-700">Checking your session…</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    const to = loginPath ?? (requireAdmin ? '/admin/login' : '/login');
    return <Navigate to={to} state={{ from: location }} replace />;
  }

  if (requireAdmin && user.role !== 'ADMIN') {
    return <Navigate to="/app/home" replace />;
  }

  // Soft MFA gate for all roles (Cognito pool can stay OPTIONAL until hard-enforced later).
  if (user.mfaEnrollmentRequired) {
    return (
      <Navigate to="/mfa/setup" state={{ from: location }} replace />
    );
  }

  return <>{children}</>;
}
