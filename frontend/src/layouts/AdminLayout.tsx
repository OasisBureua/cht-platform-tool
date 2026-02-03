import { Outlet } from 'react-router-dom';
import AdminSidebar from '../components/navigation/AdminSidebar';

export default function AdminLayout() {
  return (
    <div className="min-h-screen flex bg-gray-100">
      <AdminSidebar />

      {/* Main */}
      <div className="flex-1 flex flex-col">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <p className="text-sm text-gray-600">Admin Console</p>
          <span className="text-xs font-semibold text-gray-500">Internal</span>
        </header>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
