import { NavLink } from 'react-router-dom';
import {
  Home,
  Radio,
  CalendarClock,
  MonitorPlay,
  ClipboardList,
  Dna,
  Settings,
} from 'lucide-react';

const nav = [
  { to: '/app/home', label: 'Home', icon: Home, end: true },
  { to: '/app/live', label: 'LIVE', icon: Radio, end: false },
  { to: '/app/chm-office-hours', label: 'Office Hrs', icon: CalendarClock, end: false },
  { to: '/app/disease-areas', label: 'Diseases', icon: Dna, end: false },
  { to: '/app/catalog', label: 'Convos', icon: MonitorPlay, end: false },
  { to: '/app/surveys', label: 'Surveys', icon: ClipboardList, end: false },
  { to: '/app/settings', label: 'Settings', icon: Settings, end: false },
];

export default function AppBottomNav() {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200"
      aria-label="App navigation"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex items-center justify-around h-14 overflow-x-auto">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
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
