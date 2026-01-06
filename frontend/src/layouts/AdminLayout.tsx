import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, ClipboardList, CreditCard, Users } from 'lucide-react';

export default function AdminLayout() {
  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <span className="font-semibold text-gray-900">CHT Admin</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <AdminLink to="/admin" icon={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" end />
          <AdminLink to="/admin/programs" icon={<BookOpen className="h-4 w-4" />} label="Programs" />
          <AdminLink to="/admin/surveys" icon={<ClipboardList className="h-4 w-4" />} label="Surveys" />
          <AdminLink to="/admin/payments" icon={<CreditCard className="h-4 w-4" />} label="Payments" />
          <AdminLink to="/admin/users" icon={<Users className="h-4 w-4" />} label="Users" />
        </nav>
      </aside>

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

function AdminLink({
  to,
  icon,
  label,
  end,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
          isActive
            ? 'bg-gray-900 text-white'
            : 'text-gray-700 hover:bg-gray-100',
        ].join(' ')
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}
