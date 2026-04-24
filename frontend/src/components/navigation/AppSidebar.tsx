import { NavLink, Link } from 'react-router-dom';
import {
  Search,
  Radio,
  MonitorPlay,
  ClipboardList,
  Banknote,
  CalendarClock,
  Bot,
} from 'lucide-react';
import logoSrc from '../../assets/logo/LOGO.svg';

const nav = [
  { to: '/app/search', label: 'Search', icon: Search, end: false },
  { to: '/app/live', label: 'LIVE', icon: Radio, end: false },
  { to: '/app/chm-office-hours', label: 'Office Hours', icon: CalendarClock, end: false },
  { to: '/app/catalog', label: 'Conversations', icon: MonitorPlay, end: false },
  { to: '/app/surveys', label: 'Surveys', icon: ClipboardList, end: false },
  { to: '/app/earnings', label: 'Earnings', icon: Banknote, end: false },
  { to: '/app/chatbot', label: 'Chatbot', icon: Bot, end: false },
];

export default function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[112px] shrink-0 self-start flex-col border-r border-white/50 bg-white/70 shadow-[1px_0_0_0_rgba(0,0,0,0.04),4px_0_24px_-12px_rgba(0,0,0,0.06)] backdrop-blur-xl backdrop-saturate-150 md:flex">
      <div className="flex h-[88px] w-full shrink-0 items-center justify-center border-b border-white/40">
        <Link
          to="/app/home"
          className="flex h-[clamp(56px,8.5vh,76px)] w-[88px] items-center justify-center rounded-2xl text-brand-600 transition-[color,opacity,transform] duration-200 ease-out hover:text-brand-700 hover:opacity-95 active:scale-[0.96]"
          aria-label="Community Health Media, app home"
        >
          <img src={logoSrc} alt="CHM" className="h-10 w-10 object-contain" />
        </Link>
      </div>

      <nav
        className="app-sidebar-nav flex flex-1 flex-col items-center justify-between gap-1 overflow-hidden px-1.5 py-3"
        aria-label="Primary"
      >
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'flex h-[clamp(56px,8.5vh,76px)] w-[88px] shrink-0 flex-col items-center justify-center gap-[10px] rounded-2xl px-1.5 py-2 text-center transition-[color,background-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.96]',
                isActive
                  ? 'bg-brand-50/95 text-brand-900 shadow-[inset_0_0_0_1px_rgba(43,168,154,0.2),0_8px_18px_-8px_rgba(43,168,154,0.35)]'
                  : 'text-gray-600 hover:bg-white/80 hover:text-gray-900',
              ].join(' ')
            }
          >
            <Icon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            <span className="inline-flex w-full items-center justify-center whitespace-nowrap text-center text-[10px] font-medium leading-none">
              {label}
            </span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
