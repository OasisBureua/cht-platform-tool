import { NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Menu, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AdminSidebar from '../components/navigation/AdminSidebar';
import ThemeToggle from '../components/ThemeToggle';
import ChmWordmarkOption2 from '../components/brand/ChmWordmarkOption2';
import { ADMIN_NAV_ITEMS } from '../components/navigation/adminNavItems';

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const mobileFrontRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const displayName = (
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    user?.name ||
    user?.email ||
    'Admin'
  ).replace(/[\[\]]/g, '');

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current) return;
      if (!profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    setMobileDrawerOpen(false);
    setProfileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [mobileDrawerOpen]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => {
      if (mq.matches) setMobileDrawerOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-gray-100 text-gray-900 md:flex-row dark:bg-zinc-950 dark:text-zinc-100">
      <AdminSidebar />

      <div
        className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:overflow-visible"
        onClick={(e) => {
          if (!mobileDrawerOpen) return;
          const front = mobileFrontRef.current;
          if (front && front.contains(e.target as Node)) return;
          setMobileDrawerOpen(false);
        }}
      >
        {/* Slide-reveal drawer — matches app shell pattern */}
        <nav
          id="admin-slide-drawer-nav"
          className="absolute inset-y-0 left-0 z-0 flex w-[78%] max-w-[240px] flex-col overflow-y-auto overflow-x-hidden bg-gradient-to-b from-white to-gray-50 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[inset_-8px_0_24px_-16px_rgba(0,0,0,0.06)] md:hidden dark:from-zinc-950 dark:to-zinc-950 dark:shadow-[inset_-8px_0_28px_-18px_rgba(0,0,0,0.5)]"
          aria-label="Admin navigation"
        >
          <Link
            to="/admin"
            onClick={() => setMobileDrawerOpen(false)}
            className="mx-auto mb-3 flex shrink-0 items-center justify-center px-4 text-gray-800 transition-[opacity,transform] duration-200 hover:text-gray-900 active:scale-[0.98] dark:text-zinc-100 dark:hover:text-white"
            aria-label="Admin home"
          >
            <ChmWordmarkOption2 className="h-8 w-[4rem]" />
          </Link>
          <ul className="flex flex-col gap-0.5 px-2 pb-2">
            {ADMIN_NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <li key={`${to}-${label}`}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={() => setMobileDrawerOpen(false)}
                  className={({ isActive }) =>
                    [
                      'flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-[background-color,color,transform] duration-200 ease-out active:scale-[0.98]',
                      isActive
                        ? 'bg-gray-900 text-white shadow-[0_4px_18px_-10px_rgba(0,0,0,0.35)] dark:bg-zinc-100 dark:text-zinc-900'
                        : 'text-gray-800 hover:bg-gray-100/90 dark:text-zinc-200 dark:hover:bg-zinc-800/85',
                    ].join(' ')
                  }
                >
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                  <span className="truncate">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-auto border-t border-gray-200 px-4 py-3 text-[11px] leading-snug text-gray-500 dark:border-zinc-800 dark:text-zinc-400">
            <Link
              to="/app/home"
              className="font-semibold text-brand-700 hover:underline dark:text-brand-400"
              onClick={() => setMobileDrawerOpen(false)}
            >
              Open member app
            </Link>
          </div>
        </nav>

        {/* Front pane */}
        <div
          ref={mobileFrontRef}
          data-drawer-front
          className={[
            'relative z-[1] flex min-h-[100dvh] min-w-0 flex-1 flex-col bg-gray-100 transition-[transform,box-shadow,border-radius] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none md:min-h-0 md:translate-x-0 md:rounded-none md:shadow-none dark:bg-zinc-950',
            mobileDrawerOpen
              ? 'translate-x-[38%] rounded-r-[18px] shadow-[-4px_0_20px_rgba(0,0,0,0.1),0_12px_32px_rgba(0,0,0,0.14)]'
              : 'translate-x-0 shadow-none',
          ].join(' ')}
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-900 sm:h-16 sm:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <button
                type="button"
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl bg-white/95 text-gray-800 shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-[background-color,color,transform] duration-200 hover:bg-white hover:text-gray-900 active:scale-[0.96] md:hidden dark:bg-zinc-900/95 dark:text-zinc-100 dark:shadow-[0_1px_5px_rgba(0,0,0,0.45)] dark:hover:bg-zinc-800"
                aria-expanded={mobileDrawerOpen}
                aria-controls="admin-slide-drawer-nav"
                aria-label={mobileDrawerOpen ? 'Close navigation menu' : 'Open navigation menu'}
                onClick={() => setMobileDrawerOpen((o) => !o)}
              >
                <Menu className="h-5 w-5" strokeWidth={2} aria-hidden />
              </button>
              <div className="flex min-w-0 flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500 sm:text-xs">
                  Admin Console
                </span>
                <p className="truncate text-sm font-medium text-gray-900 dark:text-zinc-100 sm:text-base">
                  Welcome, {displayName || 'Admin'}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
              <NavLink
                to="/admin/hcp-explorer"
                className={({ isActive }) =>
                  [
                    'flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors sm:px-3',
                    isActive
                      ? 'bg-gray-100 text-gray-900 dark:bg-zinc-800 dark:text-zinc-100'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
                  ].join(' ')
                }
              >
                <Search className="h-4 w-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">Search</span>
              </NavLink>
              <ThemeToggle className="shrink-0" />
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((v) => !v)}
                  aria-expanded={profileMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Open profile menu"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-gray-200/90 text-sm font-semibold text-gray-700 shadow-[0_0_0_1px_rgba(0,0,0,0.06)_inset,0_2px_8px_-2px_rgba(0,0,0,0.08)] ring-2 ring-white/90 transition-[transform,box-shadow,color,background-color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.96] dark:from-zinc-800 dark:to-zinc-700 dark:text-zinc-100 dark:ring-zinc-900"
                >
                  {(displayName || 'A').charAt(0).toUpperCase()}
                </button>

                {profileMenuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-48 overflow-hidden rounded-xl border border-gray-100/90 bg-white p-1.5 shadow-[0_1px_0_rgba(0,0,0,0.04),0_16px_40px_-18px_rgba(0,0,0,0.2)] dark:border-zinc-700/80 dark:bg-zinc-900 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_16px_40px_-18px_rgba(0,0,0,0.55)]"
                  >
                    <Link
                      to="/admin/settings"
                      role="menuitem"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-gray-700 transition-[background-color,color] duration-200 ease-out hover:bg-gray-50 hover:text-gray-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    >
                      Settings
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        logout();
                        navigate('/');
                      }}
                      className="flex min-h-[44px] w-full items-center rounded-lg px-3 text-left text-sm font-medium text-gray-700 transition-[background-color,color] duration-200 ease-out hover:bg-gray-50 hover:text-gray-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    >
                      Logout
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6 dark:bg-zinc-950">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
