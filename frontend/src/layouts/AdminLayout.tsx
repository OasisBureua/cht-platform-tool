import { Outlet } from 'react-router-dom';
import AdminSidebar from '../components/navigation/AdminSidebar';
import AdminBottomNav from '../components/navigation/AdminBottomNav';

export default function AdminLayout() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-100 min-w-0">
      <AdminSidebar />
      <AdminBottomNav />

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <header className="h-14 md:h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 shrink-0">
          <p className="text-sm text-gray-600 truncate">Admin Console</p>
          <span className="text-xs font-semibold text-gray-500 shrink-0">Internal</span>
        </header>

        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
