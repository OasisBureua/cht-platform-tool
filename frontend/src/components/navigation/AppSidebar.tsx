import { useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { LayoutGrid, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import ChmWordmarkOption2 from '../brand/ChmWordmarkOption2';
import { ChmMark } from '../brand/ChmMark';
import { getAppNavItems } from './appNavItems';
import { useAuth } from '../../contexts/AuthContext';

/**
 * The dashboard design's shell: a labelled rail with Dashboard as its own
 * row, the current page as a filled pill and Log out pinned to the foot.
 *
 * The rows share the rail's height evenly rather than packing at the top,
 * so a tall screen doesn't leave a well of empty space under Earnings and
 * a short one never scrolls: each row can shrink to 34px and the gaps
 * close first. The rail collapses to icons for more room, which is
 * remembered per browser; with no saved choice it starts collapsed on
 * screens narrower than 1200px.
 *
 * The pill is `anchor` with `ground` text, not the lighter `cta`: white on
 * `cta` is 2.6:1, while ground on anchor clears AA in both appearances.
 */
const DASHBOARD_ITEM = { to: '/app/home', label: 'Dashboard', icon: LayoutGrid, end: true, title: undefined };
const COLLAPSE_KEY = 'chm-app-sidebar-collapsed';

function initialCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const saved = window.localStorage.getItem(COLLAPSE_KEY);
    if (saved === '1') return true;
    if (saved === '0') return false;
  } catch {
    /* storage blocked: fall through to the width default */
  }
  return window.matchMedia?.('(max-width: 1199px)').matches ?? false;
}

export default function AppSidebar() {
  const { logout } = useAuth();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const navItems = [DASHBOARD_ITEM, ...getAppNavItems()];

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const row =
    'flex h-[clamp(34px,5vh,42px)] shrink items-center rounded-[8px] text-sm transition-[color,background-color,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.98]';
  const rowLayout = collapsed ? 'w-10 justify-center self-center' : 'gap-3 px-3';

  return (
    <aside
      data-collapsed={collapsed || undefined}
      className={[
        'sticky top-0 hidden h-screen shrink-0 self-start flex-col overflow-hidden border-r border-hairline bg-surface transition-[width] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none md:flex',
        collapsed ? 'w-[72px]' : 'w-[216px]',
      ].join(' ')}
    >
      <div
        className={[
          'flex h-16 w-full shrink-0 items-center sm:h-[72px]',
          collapsed ? 'justify-center' : 'px-5',
        ].join(' ')}
      >
        <Link
          to="/app/home"
          className="flex items-center rounded-[6px] text-text transition-[opacity,transform] duration-150 hover:opacity-80 active:scale-[0.97]"
          aria-label="Community Health Media, app home"
        >
          {collapsed ? (
            <ChmMark className="size-8 text-[hsl(var(--signature))]" />
          ) : (
            <ChmWordmarkOption2 className="h-auto w-[5.25rem]" />
          )}
        </Link>
      </div>

      <nav
        className={[
          'app-sidebar-nav flex min-h-0 flex-1 flex-col justify-evenly overflow-hidden py-2',
          collapsed ? 'px-2' : 'px-3',
        ].join(' ')}
        aria-label="Primary"
      >
        {navItems.map(({ to, label, icon: Icon, end, title }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={title ?? label}
            aria-label={collapsed ? (title ?? label) : undefined}
            className={({ isActive }) =>
              [
                row,
                rowLayout,
                isActive ? 'bg-anchor font-medium text-ground' : 'text-dim hover:bg-surface-2 hover:text-text',
              ].join(' ')
            }
          >
            <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} aria-hidden />
            {collapsed ? null : <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className={['flex shrink-0 flex-col gap-1 pb-4 pt-2', collapsed ? 'px-2' : 'px-3'].join(' ')}>
        <button
          type="button"
          onClick={() => logout()}
          title="Log out"
          aria-label={collapsed ? 'Log out' : undefined}
          className={[row, rowLayout, 'text-left text-dim hover:bg-surface-2 hover:text-text'].join(' ')}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} aria-hidden />
          {collapsed ? null : 'Log out'}
        </button>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={[row, rowLayout, 'text-left text-muted2 hover:bg-surface-2 hover:text-text'].join(' ')}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} aria-hidden />
          ) : (
            <>
              <PanelLeftClose className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} aria-hidden />
              Collapse
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
