import { NavLink, Link } from 'react-router-dom';
import ChmWordmarkOption2 from '../brand/ChmWordmarkOption2';
import { ADMIN_NAV_ITEMS } from './adminNavItems';

export default function AdminSidebar() {
  return (
    <aside
      className="sticky top-0 flex h-[100dvh] max-h-[100dvh] w-[88px] shrink-0 flex-col self-start overflow-y-auto overflow-x-hidden border-r border-gray-200/80 bg-card sm:w-[120px] dark:border-border"
      aria-label="Admin sidebar"
    >
      <div className="flex h-[82px] w-full shrink-0 items-center justify-center">
        <Link to="/admin" className="flex h-full w-full items-center justify-center">
          <ChmWordmarkOption2 className="h-8 w-[4.5rem]" />
        </Link>
      </div>

      {/* Pack items at the top with clearer size + spacing */}
      <nav className="flex flex-col items-center gap-2.5 px-1.5 pb-4 pt-2">
        {ADMIN_NAV_ITEMS.map(({ to, label, icon: Icon, iconTone, end }) => (
          <NavLink
            key={`${to}-${label}`}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'flex w-full flex-col items-center justify-center gap-1 rounded-[6px] px-1.5 py-2.5 text-center transition',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-primary dark:hover:text-primary',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                {/* Resting icon carries the destination's own hue. The active
                    row already tints itself `primary` end to end, so there the
                    icon inherits that instead of competing with it. */}
                <Icon
                  className={isActive ? 'h-6 w-6 shrink-0' : `h-6 w-6 shrink-0 ${iconTone}`}
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="max-w-full px-0.5 text-[11px] font-semibold leading-snug [overflow-wrap:anywhere]">
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
