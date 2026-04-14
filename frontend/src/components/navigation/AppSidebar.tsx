import { NavLink, Link } from 'react-router-dom';
import {
  Home,
  Search,
  Radio,
  CalendarClock,
  MonitorPlay,
  ClipboardList,
  Banknote,
  Mic2,
  Stethoscope,
  Dna,
  Bot,
  Settings,
} from 'lucide-react';
import logoSrc from '../../assets/logo/LOGO.svg';

const nav = [
  { to: '/app/home', label: 'Home', icon: Home, end: true },
  { to: '/app/search', label: 'Search', icon: Search, end: false },
  { to: '/app/live', label: 'LIVE', icon: Radio, end: false },
  { to: '/app/chm-office-hours', label: 'Office Hours', icon: CalendarClock, end: false },
  { to: '/app/chm-docs', label: 'CHM Docs', icon: Stethoscope, end: false },
  { to: '/app/disease-areas', label: 'Diseases', icon: Dna, end: false },
  { to: '/app/catalog', label: 'Conversations', icon: MonitorPlay, end: false },
  { to: '/app/surveys', label: 'Surveys', icon: ClipboardList, end: false },
  { to: '/app/podcasts', label: 'Podcasts', icon: Mic2, end: false },
  { to: '/app/earnings', label: 'Earnings', icon: Banknote, end: false },
  { to: '/app/chatbot', label: 'ChatBot', icon: Bot, end: false },
  { to: '/app/settings', label: 'Settings', icon: Settings, end: false },
];

export default function AppSidebar() {
  return (
    <aside className="hidden md:flex md:flex-col w-[100px] bg-white shrink-0 sticky top-0 h-screen overflow-y-auto">
      <div className="flex w-full h-[82px] justify-center items-center shrink-0" style={{ aspectRatio: '50/41' }}>
        <Link to="/app/home" className="flex w-full h-full justify-center items-center">
          <img src={logoSrc} alt="CHT" className="max-w-[60px] max-h-[50px] object-contain" />
        </Link>
      </div>

      <nav className="flex-1 flex flex-col items-center py-4 gap-5 overflow-y-auto">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'flex flex-col items-center justify-center gap-1 w-full py-1.5 text-center transition',
                isActive ? 'text-gray-900' : 'text-gray-700 hover:text-gray-900',
              ].join(' ')
            }
          >
            <Icon className="h-5 w-5 shrink-0" strokeWidth={2} />
            <span className="text-[10px] font-medium leading-tight">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
