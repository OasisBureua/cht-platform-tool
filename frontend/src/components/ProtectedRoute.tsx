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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-600">Loading...</div>
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

  // Require profile complete (profession + NPI) for app access
  if (!requireAdmin && user.profileComplete === false) {
    return <Navigate to="/complete-profile" replace />;
  }

  return <>{children}</>;
}
