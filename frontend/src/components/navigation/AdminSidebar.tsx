import { NavLink, Link } from 'react-router-dom';
import ChmWordmarkOption2 from '../brand/ChmWordmarkOption2';
import { ADMIN_NAV_ITEMS } from './adminNavItems';

export default function AdminSidebar() {
  return (
    <aside
      className="sticky top-0 hidden h-[100dvh] max-h-[100dvh] shrink-0 flex-col self-start overflow-y-auto border-r border-gray-200/80 bg-white md:flex md:w-[100px] dark:border-zinc-800/80"
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

      <nav className="flex flex-1 flex-col items-center gap-6 py-4">
        {ADMIN_NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={`${to}-${label}`}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'flex w-full flex-col items-center justify-center gap-1.5 py-2 text-center transition',
                isActive ? 'text-gray-900' : 'text-gray-700 hover:text-gray-900',
              ].join(' ')
            }
          >
            <Icon className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />
            <span className="text-xs font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
