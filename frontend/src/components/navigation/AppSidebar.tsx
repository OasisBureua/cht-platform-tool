import { NavLink, Link } from 'react-router-dom';
import { LayoutGrid, LogOut } from 'lucide-react';
import ChmWordmarkOption2 from '../brand/ChmWordmarkOption2';
import { getAppNavItems } from './appNavItems';
import { useAuth } from '../../contexts/AuthContext';

/**
 * The dashboard design's shell: a labelled rail rather than the icon
 * column, with Dashboard as its own row, the current page as a filled
 * pill and Log out pinned to the foot.
 *
 * The pill is `anchor` with `ground` text, not the lighter `cta`: white
 * on `cta` is 2.6:1, while ground on anchor clears AA in both
 * appearances (the dark anchor is a light blue, and ground goes black).
 */
const DASHBOARD_ITEM = { to: '/app/home', label: 'Dashboard', icon: LayoutGrid, end: true, title: undefined };

export default function AppSidebar() {
  const { logout } = useAuth();
  const navItems = [DASHBOARD_ITEM, ...getAppNavItems()];
  return (
    <aside className="sticky top-0 hidden h-screen w-[216px] shrink-0 self-start flex-col border-r border-hairline bg-surface md:flex">
      <div className="flex h-16 w-full shrink-0 items-center px-5 sm:h-[72px]">
        <Link
          to="/app/home"
          className="flex items-center rounded-[6px] text-text transition-[opacity,transform] duration-150 hover:opacity-80 active:scale-[0.97]"
          aria-label="Community Health Media, app home"
        >
          <ChmWordmarkOption2 className="h-auto w-[5.25rem]" />
        </Link>
      </div>

      {/* Pack items from the top so empty space stays below; scroll only if
          the list truly exceeds the viewport. */}
      <nav
        className="app-sidebar-nav flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-3 py-2"
        aria-label="Primary"
      >
        {navItems.map(({ to, label, icon: Icon, end, title }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={title ?? label}
            className={({ isActive }) =>
              [
                'flex min-h-10 items-center gap-3 rounded-[8px] px-3 text-sm transition-[color,background-color,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.98]',
                isActive
                  ? 'bg-anchor font-medium text-ground'
                  : 'text-dim hover:bg-surface-2 hover:text-text',
              ].join(' ')
            }
          >
            <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} aria-hidden />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="shrink-0 px-3 pb-4 pt-2">
        <button
          type="button"
          onClick={() => logout()}
          className="flex min-h-10 w-full items-center gap-3 rounded-[8px] px-3 text-left text-sm text-dim transition-[color,background-color,transform] duration-150 hover:bg-surface-2 hover:text-text active:scale-[0.98]"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} aria-hidden />
          Log out
        </button>
      </div>
    </aside>
  );
}
