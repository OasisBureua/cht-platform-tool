import { NavLink, Link } from 'react-router-dom';
import ChmWordmarkOption2 from '../brand/ChmWordmarkOption2';
import { ADMIN_NAV_ITEMS } from './adminNavItems';

export default function AdminSidebar() {
  return (
    <aside
      className="sticky top-0 hidden h-[100dvh] max-h-[100dvh] w-[100px] shrink-0 flex-col self-start overflow-y-auto overflow-x-hidden border-r border-gray-200/80 bg-white md:flex dark:border-zinc-800/80 dark:bg-zinc-950"
      aria-label="Admin sidebar"
    >
      <div className="flex h-[82px] w-full shrink-0 items-center justify-center">
        <Link to="/admin" className="flex h-full w-full items-center justify-center">
          <ChmWordmarkOption2 className="h-8 w-[4.5rem]" />
        </Link>
      </div>

      {/* Pack items at the top only — do not stretch/spread toward the bottom */}
      <nav className="flex flex-col items-center gap-0.5 px-0.5 pb-3 pt-1">
        {ADMIN_NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={`${to}-${label}`}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'flex w-full flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-center transition',
                isActive
                  ? 'text-primary'
                  : 'text-gray-700 hover:text-primary dark:text-zinc-300 dark:hover:text-primary',
              ].join(' ')
            }
          >
            <Icon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            <span className="max-w-full truncate text-[10px] font-medium leading-tight">
              {label}
            </span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
