import { NavLink } from 'react-router-dom';
import {
  Search,
  Radio,
  MonitorPlay,
  ClipboardList,
  Banknote,
  Mic2,
  Bot,
  CalendarClock,
} from 'lucide-react';

const nav = [
  { to: '/app/search', label: 'Search', icon: Search, end: false },
  { to: '/app/live', label: 'Live', icon: Radio, end: false },
  { to: '/app/chm-office-hours', label: 'Office Hrs', icon: CalendarClock, end: false },
  { to: '/app/catalog', label: 'Conversations', icon: MonitorPlay, end: false },
  { to: '/app/surveys', label: 'Surveys', icon: ClipboardList, end: false },
  { to: '/app/podcasts', label: 'Podcasts', icon: Mic2, end: false },
  { to: '/app/earnings', label: 'Earnings', icon: Banknote, end: false },
  { to: '/app/chatbot', label: 'Chatbot', icon: Bot, end: false },
];

export default function AppBottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/45 bg-white/80 shadow-[0_-8px_32px_-16px_rgba(24,92,84,0.1),inset_0_1px_0_0_rgba(255,255,255,0.75)] backdrop-blur-xl backdrop-saturate-150 md:hidden dark:border-zinc-800/80 dark:bg-zinc-950/90 dark:shadow-[0_-8px_32px_-16px_rgba(0,0,0,0.45),inset_0_1px_0_0_rgba(255,255,255,0.05)]"
      aria-label="App navigation"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex h-14 items-center justify-around overflow-x-auto">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'flex min-h-[44px] min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 transition-[color,background-color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.96]',
                isActive
                  ? 'bg-white/70 text-brand-800 shadow-[inset_0_0_0_1px_rgba(43,168,154,0.18),0_6px_14px_-10px_rgba(43,168,154,0.3)] dark:bg-zinc-100 dark:text-zinc-950 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.92),0_6px_14px_-10px_rgba(0,0,0,0.55)]'
                  : 'text-gray-500 hover:text-gray-800 active:text-gray-900 dark:text-zinc-500 dark:hover:text-zinc-200 dark:active:text-zinc-100',
              ].join(' ')
            }
          >
            <Icon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            <span className="max-w-full whitespace-nowrap text-[10px] font-medium leading-none">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
