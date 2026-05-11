import { NavLink, Link } from 'react-router-dom';
import ChmWordmarkOption2 from '../brand/ChmWordmarkOption2';
import { APP_NAV_ITEMS } from './appNavItems';

export default function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[112px] shrink-0 self-start flex-col bg-white/70 shadow-[6px_0_36px_-20px_rgba(0,0,0,0.09)] backdrop-blur-xl backdrop-saturate-150 md:flex dark:bg-zinc-950/85 dark:shadow-[8px_0_40px_-22px_rgba(0,0,0,0.55)]">
      <div className="flex h-[88px] w-full shrink-0 items-center justify-center border-b border-zinc-200/25 dark:border-zinc-800/60">
        <Link
          to="/app/home"
          className="flex h-[clamp(56px,8.5vh,76px)] w-[88px] items-center justify-center rounded-2xl text-brand-600 transition-[color,opacity,transform] duration-200 ease-out hover:text-brand-700 hover:opacity-95 active:scale-[0.96]"
          aria-label="Community Health Media, app home"
        >
          <ChmWordmarkOption2 className="h-9 w-[4.75rem]" />
        </Link>
      </div>

      <nav
        className="app-sidebar-nav flex flex-1 flex-col items-center justify-between gap-1 overflow-hidden px-1.5 py-3"
        aria-label="Primary"
      >
        {APP_NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'flex h-[clamp(56px,8.5vh,76px)] w-[88px] shrink-0 flex-col items-center justify-center gap-[10px] rounded-2xl px-1.5 py-2 text-center transition-[color,background-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.96]',
                isActive
                  ? 'bg-brand-50/95 text-brand-900 shadow-[0_8px_24px_-12px_rgba(43,168,154,0.35)] dark:bg-zinc-100 dark:text-zinc-950 dark:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.45)]'
                  : 'text-gray-600 hover:bg-white/80 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-900/90 dark:hover:text-zinc-100',
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
