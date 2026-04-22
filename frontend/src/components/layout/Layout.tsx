import { Outlet } from 'react-router-dom';
import AppSidebar from '../navigation/AppSidebar';
import AppBottomNav from '../navigation/AppBottomNav';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationBell } from './NotificationBell';

export default function Layout() {
  const { user, logout } = useAuth();
  const displayName = (
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    user?.name ||
    user?.email ||
    'User'
  ).replace(/[\[\]]/g, '');

  return (
    <div className="min-h-screen flex flex-col sm:flex-row bg-gray-50 min-w-0">
      <AppSidebar />
      <AppBottomNav />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-14 lg:h-16 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Welcome, {displayName}!</h1>
            <p className="text-base text-gray-600 hidden sm:block">You have new opportunities to earn rewards today</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <NotificationBell />
            <button
              onClick={() => logout()}
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Logout
            </button>
            <div className="h-9 w-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600" aria-hidden>
              {displayName.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-x-hidden text-[130%]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
