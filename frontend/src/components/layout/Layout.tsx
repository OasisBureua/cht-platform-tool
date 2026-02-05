import { Outlet } from 'react-router-dom';
import AppSidebar from '../navigation/AppSidebar';
import AppBottomNav from '../navigation/AppBottomNav';

const TEMP_USER_NAME = 'Jane';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col sm:flex-row bg-gray-50 min-w-0">
      <AppSidebar />
      <AppBottomNav />

      <div className="flex-1 flex flex-col min-w-0 pb-16 sm:pb-0">
        <header className="h-14 lg:h-16 bg-white flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0 border-b border-gray-200 sm:border-0">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 truncate">Welcome, {TEMP_USER_NAME}!</h1>
            <p className="text-sm text-gray-600 hidden sm:block truncate">You have new opportunities to earn rewards today</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button className="p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100" aria-label="Notifications">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            </button>
            <div className="h-9 w-9 rounded-full bg-gray-200 shrink-0" aria-hidden />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
