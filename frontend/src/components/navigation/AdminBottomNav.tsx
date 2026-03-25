import { NavLink } from 'react-router-dom';
import {
  Home,
  Search,
  Presentation,
  Headphones,
  ClipboardList,
  DollarSign,
  Users,
  Settings,
} from 'lucide-react';

const nav = [
  { to: '/admin', label: 'Home', icon: Home, end: true },
  { to: '/admin/hcp-explorer', label: 'Search', icon: Search, end: false },
  { to: '/admin/programs', label: 'Webinars', icon: Presentation, end: false },
  { to: '/admin/office-hours', label: 'Office Hours', icon: Headphones, end: false },
  { to: '/admin/surveys', label: 'Surveys', icon: ClipboardList, end: false },
  { to: '/admin/payments', label: 'Payments', icon: DollarSign, end: false },
  { to: '/admin/users', label: 'Users', icon: Users, end: false },
  { to: '/admin/settings', label: 'Settings', icon: Settings, end: false },
];

export default function AdminBottomNav() {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200"
      aria-label="Admin navigation"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex items-center justify-around h-14 overflow-x-auto">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={label}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-2 px-1 transition-colors touch-manipulation',
                isActive ? 'text-gray-900' : 'text-gray-500 active:text-gray-900',
              ].join(' ')
            }
          >
            <Icon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            <span className="text-[10px] font-medium truncate max-w-full">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
