import { NavLink } from 'react-router-dom';
import {
  Home,
  Search,
  Presentation,
  MonitorPlay,
  Banknote,
  CreditCard,
  Bot,
  Settings,
} from 'lucide-react';

const nav = [
  { to: '/app/home', label: 'Home', icon: Home, end: true },
  { to: '/app/search', label: 'Search', icon: Search, end: false },
  { to: '/app/webinars', label: 'Webinars', icon: Presentation, end: false },
  { to: '/app/watch', label: 'Conversations', icon: MonitorPlay, end: false },
  { to: '/app/earnings', label: 'Earnings', icon: Banknote, end: false },
  { to: '/app/payments', label: 'Payments', icon: CreditCard, end: false },
  { to: '/app/chatbot', label: 'Chat', icon: Bot, end: false },
  { to: '/app/settings', label: 'Settings', icon: Settings, end: false },
];

export default function AppBottomNav() {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200"
      aria-label="App navigation"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex items-center justify-around h-14">
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
