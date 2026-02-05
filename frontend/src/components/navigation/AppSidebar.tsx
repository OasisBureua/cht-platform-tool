import { NavLink, Link } from 'react-router-dom';
import {
  Home,
  Search,
  Presentation,
  MonitorPlay,
  Banknote,
  Bot,
  Settings,
} from 'lucide-react';
import logoSrc from '../../assets/logo/LOGO.svg';

const nav = [
  { to: '/app/home', label: 'Home', icon: Home, end: true },
  { to: '/app/search', label: 'Search', icon: Search, end: false },
  { to: '/app/webinars', label: 'Webinars', icon: Presentation, end: false },
  { to: '/app/watch', label: 'Watch', icon: MonitorPlay, end: false },
  { to: '/app/earnings', label: 'Earnings', icon: Banknote, end: false },
  { to: '/app/chatbot', label: 'ChatBot', icon: Bot, end: false },
  { to: '/app/settings', label: 'Settings', icon: Settings, end: false },
];

export default function AppSidebar() {
  return (
    <aside className="hidden md:flex md:flex-col w-[100px] bg-white shrink-0">
      {/* Logo */}
      <div className="flex w-full h-[82px] justify-center items-center shrink-0" style={{ aspectRatio: '50/41' }}>
        <Link to="/app/home" className="flex w-full h-full justify-center items-center">
          <img src={logoSrc} alt="CHT" className="max-w-[60px] max-h-[50px] object-contain" />
        </Link>
      </div>

      {/* Nav - icon above label */}
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
    </aside>
  );
}
