import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import AppSidebar from '../navigation/AppSidebar';
import AppBottomNav from '../navigation/AppBottomNav';
import { APP_NAV_ITEMS, APP_CATALOG_CONVERSATIONS_HUB } from '../navigation/appNavItems';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import ChmWordmarkOption2 from '../brand/ChmWordmarkOption2';
import ThemeToggle from '../ThemeToggle';
import { NotificationBell } from './NotificationBell';

export default function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { resolvedTheme, toggleColorScheme } = useTheme();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileFrontRef = useRef<HTMLDivElement | null>(null);
  const displayName = (
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    user?.name ||
    user?.email ||
    'User'
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
    <div className="app-shell flex min-h-screen min-w-0 flex-col bg-gray-50 text-gray-900 md:flex-row dark:bg-zinc-950 dark:text-zinc-100">
      <AppSidebar />
      <AppBottomNav />

      <div
        className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#18181b] md:overflow-visible md:bg-gray-50 md:dark:bg-zinc-950"
        onClick={(e) => {
          if (!mobileDrawerOpen) return;
          const front = mobileFrontRef.current;
          if (front && front.contains(e.target as Node)) return;
          setMobileDrawerOpen(false);
        }}
      >
        {/* Slide-reveal drawer — visible layer behind front pane on small screens */}
        <nav
          id="app-slide-drawer-nav"
          className="absolute inset-y-0 left-0 z-0 flex w-[78%] max-w-[220px] flex-col overflow-y-auto overflow-x-hidden border-r border-black/[0.06] bg-gradient-to-b from-white to-zinc-50 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[inset_-6px_0_16px_-12px_rgba(0,0,0,0.05)] md:hidden dark:border-white/[0.06] dark:from-zinc-950 dark:to-zinc-950 dark:shadow-[inset_-6px_0_16px_-12px_rgba(0,0,0,0.35)]"
          aria-label="Primary navigation"
        >
          <Link
            to={APP_CATALOG_CONVERSATIONS_HUB}
            onClick={() => setMobileDrawerOpen(false)}
            className="mx-auto mb-3 flex shrink-0 items-center justify-center px-4 text-brand-600 transition-[opacity,transform] duration-200 hover:text-brand-700 active:scale-[0.98]"
            aria-label="Community Health Media, app home"
          >
            <ChmWordmarkOption2 className="h-8 w-[4rem]" />
          </Link>
          <ul className="flex flex-col gap-0.5 px-2 pb-2">
            {APP_NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={() => setMobileDrawerOpen(false)}
                  className={({ isActive }) =>
                    [
                      'flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-[background-color,color,transform] duration-200 ease-out active:scale-[0.98]',
                      isActive
                        ? 'bg-brand-50 text-brand-900 shadow-[inset_0_0_0_1px_rgba(43,168,154,0.2)] dark:bg-brand-950/45 dark:text-brand-100'
                        : 'text-zinc-800 hover:bg-zinc-100/90 dark:text-zinc-200 dark:hover:bg-zinc-800/85',
                    ].join(' ')
                  }
                >
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                  <span className="truncate">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-auto border-t border-zinc-200 px-4 py-3 text-[11px] leading-snug text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <Link
              to="/app/settings"
              className="font-semibold text-brand-700 hover:underline dark:text-brand-400"
              onClick={() => setMobileDrawerOpen(false)}
            >
              Settings
            </Link>
            {' · '}
            <button
              type="button"
              className="font-semibold text-zinc-700 hover:underline dark:text-zinc-300"
              onClick={() => {
                setMobileDrawerOpen(false);
                logout();
              }}
            >
              Sign out
            </button>
          </div>
        </nav>

        {/* Front pane — slides aside when drawer opens */}
        <div
          ref={mobileFrontRef}
          data-drawer-front
          className={[
            'relative z-[1] flex min-h-[100dvh] flex-1 flex-col bg-gray-50 transition-[transform,box-shadow,border-radius] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none md:min-h-0 md:translate-x-0 md:rounded-none md:shadow-none dark:bg-zinc-950',
            mobileDrawerOpen
              ? 'translate-x-[38%] rounded-r-[18px] shadow-[-4px_0_20px_rgba(0,0,0,0.1),0_12px_32px_rgba(0,0,0,0.14)]'
              : 'translate-x-0 shadow-none',
          ].join(' ')}
          onClick={(e) => e.stopPropagation()}
        >
          <header className="nav-liquid-glass sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 px-4 sm:h-16 sm:px-6 lg:px-8">
            <div className="flex min-w-0 shrink-0 items-center gap-2">
              <button
                type="button"
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-zinc-200/90 bg-white/90 text-gray-800 shadow-[0_1px_0_rgba(0,0,0,0.04)] transition-[background-color,color,transform] duration-200 hover:bg-white hover:text-gray-900 active:scale-[0.96] md:hidden dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-100 dark:hover:bg-zinc-800"
                aria-expanded={mobileDrawerOpen}
                aria-controls="app-slide-drawer-nav"
                aria-label={mobileDrawerOpen ? 'Close navigation menu' : 'Open navigation menu'}
                onClick={() => setMobileDrawerOpen((o) => !o)}
              >
                <Menu className="h-5 w-5" strokeWidth={2} aria-hidden />
              </button>
              <Link
                to="/app/home"
                className="hidden shrink-0 text-brand-600 transition-[color,opacity,transform] duration-200 ease-out hover:text-brand-700 active:scale-[0.96] md:inline-flex"
                aria-label="Community Health Media, app home"
              >
                <ChmWordmarkOption2 className="h-6 w-[2.75rem]" />
              </Link>
            </div>
            <div className="min-w-0 flex-1 pr-2 md:pr-3">
              <h1 className="truncate text-lg font-bold tracking-tight text-gray-900 dark:text-zinc-50 md:text-xl">
                Welcome, {displayName}!
              </h1>
              <p className="mt-0.5 hidden text-pretty text-sm text-gray-600 dark:text-zinc-400 sm:block">
                You have new opportunities to earn rewards today
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <ThemeToggle className="hidden shrink-0 md:inline-flex" />
              <NotificationBell />
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((v) => !v)}
                  aria-expanded={profileMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Open profile menu"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-gray-200/90 text-sm font-semibold text-gray-700 shadow-[0_0_0_1px_rgba(0,0,0,0.06)_inset,0_2px_8px_-2px_rgba(0,0,0,0.08)] ring-2 ring-white/90 transition-[transform,box-shadow,color,background-color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.96] dark:from-zinc-800 dark:to-zinc-700 dark:text-zinc-100 dark:ring-zinc-900"
                >
                  {displayName.charAt(0).toUpperCase()}
                </button>

                {profileMenuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-48 overflow-hidden rounded-xl border border-gray-100/90 bg-white p-1.5 shadow-[0_1px_0_rgba(0,0,0,0.04),0_16px_40px_-18px_rgba(0,0,0,0.2)] dark:border-zinc-700/80 dark:bg-zinc-900 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_16px_40px_-18px_rgba(0,0,0,0.55)]"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => toggleColorScheme()}
                      className="flex min-h-[44px] w-full items-center rounded-lg px-3 text-left text-sm font-medium text-gray-700 transition-[background-color,color] duration-200 ease-out hover:bg-gray-50 hover:text-gray-900 md:hidden dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    >
                      {resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
                    </button>
                    <Link
                      to="/app/settings"
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

          <main className="min-w-0 flex-1 overflow-x-hidden px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pt-6 md:px-6 md:pb-6 md:pt-6 lg:px-8 lg:pb-8 lg:pt-8">
            <div className="app-outlet-enter" key={location.pathname}>
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
