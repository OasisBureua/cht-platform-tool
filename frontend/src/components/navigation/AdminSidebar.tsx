import { NavLink, Link } from 'react-router-dom';
import ChmWordmarkOption2 from '../brand/ChmWordmarkOption2';
import { ADMIN_NAV_ITEMS } from './adminNavItems';

export default function AdminSidebar() {
  return (
    <aside
      className="sticky top-0 hidden h-[100dvh] max-h-[100dvh] shrink-0 flex-col self-start overflow-y-auto border-r border-gray-200/80 bg-white md:flex md:w-[100px] dark:border-zinc-800/80 dark:bg-zinc-950"
      aria-label="Admin sidebar"
    >
      <div
        className="flex h-[82px] w-full shrink-0 items-center justify-center"
        style={{ aspectRatio: '50/41' }}
      >
        <Link to="/admin" className="flex h-full w-full items-center justify-center">
          <ChmWordmarkOption2 className="h-8 w-[4.5rem]" />
        </Link>
      </div>

      {/* Tight vertical rhythm so all items fit on-screen without scrolling */}
      <nav className="flex flex-1 flex-col items-center gap-1 py-2">
        {ADMIN_NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={`${to}-${label}`}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'flex w-full flex-col items-center justify-center gap-1 py-2 text-center transition',
                isActive
                  ? 'text-primary'
                  : 'text-gray-700 hover:text-primary dark:text-zinc-300 dark:hover:text-primary',
              ].join(' ')
            }
          >
            <Icon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            <span className="text-[11px] font-medium leading-tight">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
