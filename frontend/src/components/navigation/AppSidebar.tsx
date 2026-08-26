import { NavLink, Link } from 'react-router-dom';
import ChmWordmarkOption2 from '../brand/ChmWordmarkOption2';
import { APP_NAV_ITEMS } from './appNavItems';

export default function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[112px] shrink-0 self-start flex-col bg-white/70 shadow-[6px_0_36px_-20px_rgba(0,0,0,0.09)] backdrop-blur-xl backdrop-saturate-150 md:flex /85 dark:shadow-[8px_0_40px_-22px_rgba(0,0,0,0.55)]">
      <div className="flex h-[88px] w-full shrink-0 items-center justify-center border-b border-zinc-200/25 /60">
        <Link
          to="/app/home"
          className="flex h-[clamp(56px,8.5vh,76px)] w-[88px] items-center justify-center rounded-card text-steel-600 transition-[color,opacity,transform] duration-200 ease-out hover:text-steel-700 hover:opacity-95 active:scale-[0.96] dark:text-steel-400 dark:hover:text-steel-300"
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
                'flex h-[clamp(56px,8.5vh,76px)] w-[88px] shrink-0 flex-col items-center justify-center gap-[10px] rounded-card px-1.5 py-2 text-center transition-[color,background-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.96]',
                isActive
                  ? 'bg-steel-100 text-steel-950 shadow-[inset_0_0_0_1px_rgba(49,105,149,0.18),0_8px_24px_-12px_rgba(49,105,149,0.22)] ring-2 ring-steel-500/25 ring-offset-0 dark:bg-steel-600 dark:text-white dark:ring-steel-400/35 dark:shadow-[0_8px_28px_-12px_rgba(37,99,235,0.35)]'
                  : 'text-foreground hover:bg-steel-50/90 hover:text-foreground  dark:hover:bg-muted/90 dark:hover:text-white',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={
                    isActive
                      ? 'h-5 w-5 shrink-0 text-steel-950 dark:text-white'
                      : 'h-5 w-5 shrink-0 text-steel-600 dark:text-steel-400'
                  }
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="inline-flex w-full items-center justify-center whitespace-nowrap text-center text-[10px] font-medium leading-none">
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
