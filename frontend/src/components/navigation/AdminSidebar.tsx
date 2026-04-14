import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  Home,
  Search,
  Radio,
  CalendarClock,
  ClipboardList,
  DollarSign,
  Users,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import logoSrc from '../../assets/logo/LOGO.svg';

const nav = [
  { to: '/admin', label: 'Home', icon: Home, end: true },
  { to: '/admin/hcp-explorer', label: 'Search', icon: Search, end: false },
  { to: '/admin/programs', label: 'LIVE', icon: Radio, end: false },
  { to: '/admin/office-hours', label: 'Office Hours', icon: CalendarClock, end: false },
  { to: '/admin/surveys', label: 'Surveys', icon: ClipboardList, end: false },
  { to: '/admin/payments', label: 'Earnings', icon: DollarSign, end: false },
  { to: '/admin/users', label: 'Users', icon: Users, end: false },
  { to: '/admin/settings', label: 'Settings', icon: Settings, end: false },
];

export default function AdminSidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <aside className="hidden md:flex md:flex-col w-[100px] bg-white shrink-0">
      <div className="flex w-full h-[82px] justify-center items-center shrink-0" style={{ aspectRatio: '50/41' }}>
        <Link to="/admin" className="flex w-full h-full justify-center items-center">
          <img src={logoSrc} alt="CHT" className="max-w-[60px] max-h-[50px] object-contain" />
        </Link>
      </div>

      <nav className="flex-1 flex flex-col items-center py-4 gap-6">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={label}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'flex flex-col items-center justify-center gap-1.5 w-full py-2 text-center transition',
                isActive ? 'text-gray-900' : 'text-gray-700 hover:text-gray-900',
              ].join(' ')
            }
          >
            <Icon className="h-6 w-6 shrink-0" strokeWidth={2} />
            <span className="text-xs font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="pb-6 flex justify-center">
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-1.5 w-full py-2 text-center text-gray-400 hover:text-red-500 transition"
          title="Sign out"
        >
          <LogOut className="h-6 w-6 shrink-0" strokeWidth={2} />
          <span className="text-xs font-medium">Sign out</span>
        </button>
      </div>
    </aside>
  );
}
