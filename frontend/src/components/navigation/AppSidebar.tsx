import { NavLink, Link } from 'react-router-dom';
import ChmWordmarkOption2 from '../brand/ChmWordmarkOption2';
import { getAppNavItems } from './appNavItems';

export default function AppSidebar() {
  const navItems = getAppNavItems();
  return (
    <aside className="sticky top-0 hidden h-screen w-[112px] shrink-0 self-start flex-col bg-card/80 shadow-[6px_0_36px_-20px_rgba(0,0,0,0.09)] backdrop-blur-xl backdrop-saturate-150 md:flex dark:bg-zinc-950/90 dark:shadow-[8px_0_40px_-22px_rgba(0,0,0,0.55)]">
      <div className="flex h-[88px] w-full shrink-0 items-center justify-center border-b border-border/60">
        <Link
          to="/app/home"
          className="flex h-[clamp(56px,8.5vh,76px)] w-[88px] items-center justify-center rounded-card text-text transition-[color,opacity,transform] duration-200 ease-out hover:opacity-80 active:scale-[0.96]"
          aria-label="Community Health Media, app home"
        >
          <ChmWordmarkOption2 className="h-auto w-[4.75rem]" />
        </Link>
      </div>

      {/* Pack items from the top so empty space stays below — scroll only if the
          list truly exceeds the viewport (many more items than today). */}
      <nav
        className="app-sidebar-nav flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto overflow-x-hidden px-1.5 py-3"
        aria-label="Primary"
      >
        {/* No iconTone: this branch applied MW's feedback for a quieter
            rail, where the active icon takes the CTA blue and everything
            at rest sits in the dim ink, rather than each destination
            carrying its own hue. */}
        {navItems.map(({ to, label, icon: Icon, end, title }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={title ?? label}
            aria-label={title ?? label}
            className={({ isActive }) =>
              [
                'flex h-[4.25rem] w-[88px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-card px-1.5 py-2 text-center transition-[color,background-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.96]',
                isActive
                  ? 'bg-surface-2 text-text ring-1 ring-hairline'
                  : 'text-dim hover:bg-surface-2 hover:text-text',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                {/* One accent on the rail: the active icon takes the CTA blue,
                    everything at rest sits in the dim ink. */}
                <Icon
                  className={
                    isActive ? 'h-5 w-5 shrink-0 text-cta' : 'h-5 w-5 shrink-0 text-dim'
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
