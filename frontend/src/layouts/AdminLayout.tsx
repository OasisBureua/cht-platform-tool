import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AdminSidebar from '../components/navigation/AdminSidebar';
import AdminBottomNav from '../components/navigation/AdminBottomNav';
import ThemeToggle from '../components/ThemeToggle';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
    : user?.name || user?.email || 'Admin';

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-gray-100 text-gray-900 md:flex-row dark:bg-zinc-950 dark:text-zinc-100">
      <AdminSidebar />
      <AdminBottomNav />

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-900 sm:px-6 md:h-16">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">Admin Console</span>
            <span className="shrink-0 text-gray-300 dark:text-zinc-600">·</span>
            <p className="truncate text-sm font-medium text-gray-900 dark:text-zinc-100">Welcome, {displayName}</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle className="shrink-0" />
            <button
              onClick={handleLogout}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6 dark:bg-zinc-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
