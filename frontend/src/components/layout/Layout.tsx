import { Link, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import AppSidebar from '../navigation/AppSidebar';
import AppBottomNav from '../navigation/AppBottomNav';
import { useAuth } from '../../contexts/AuthContext';
import ChmWordmarkOption2 from '../brand/ChmWordmarkOption2';
import ThemeToggle from '../ThemeToggle';

export default function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
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

  return (
    <div className="app-shell min-h-screen flex min-w-0 flex-col bg-gray-50 text-gray-900 sm:flex-row dark:bg-zinc-950 dark:text-zinc-100">
      <AppSidebar />
      <AppBottomNav />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="nav-liquid-glass sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 px-4 sm:h-16 sm:px-6 lg:px-8">
          <Link
            to="/app/home"
            className="shrink-0 text-brand-600 transition-[color,opacity,transform] duration-200 ease-out hover:text-brand-700 active:scale-[0.96] md:hidden"
            aria-label="Community Health Media, app home"
          >
            <ChmWordmarkOption2 className="h-6 w-[2.75rem]" />
          </Link>
          <div className="min-w-0 pr-3">
            <h1 className="text-balance text-lg font-bold tracking-tight text-gray-900 dark:text-zinc-50 md:text-xl">
              Welcome, {displayName}!
            </h1>
            <p className="mt-0.5 hidden text-pretty text-sm text-gray-600 dark:text-zinc-400 sm:block">
              You have new opportunities to earn rewards today
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle className="shrink-0" />
            <button
              type="button"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-gray-600 transition-[color,background-color,transform] duration-200 ease-out hover:bg-white/60 hover:text-gray-900 active:scale-[0.96] sm:min-h-0 sm:min-w-0 sm:px-3 sm:py-2 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100"
              aria-label="Notifications"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </button>
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setProfileMenuOpen((v) => !v)}
                aria-expanded={profileMenuOpen}
                aria-haspopup="menu"
                aria-label="Open profile menu"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-gray-200/90 text-sm font-semibold text-gray-700 shadow-[0_0_0_1px_rgba(0,0,0,0.06)_inset,0_2px_8px_-2px_rgba(0,0,0,0.08)] ring-2 ring-white/90 transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.96]"
              >
                {displayName.charAt(0).toUpperCase()}
              </button>

              {profileMenuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-48 overflow-hidden rounded-xl border border-gray-100/90 bg-white p-1.5 shadow-[0_1px_0_rgba(0,0,0,0.04),0_16px_40px_-18px_rgba(0,0,0,0.2)]"
                >
                  <Link
                    to="/app/settings"
                    role="menuitem"
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-gray-700 transition-[background-color,color] duration-200 ease-out hover:bg-gray-50 hover:text-gray-900"
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
                    className="flex min-h-[44px] w-full items-center rounded-lg px-3 text-left text-sm font-medium text-gray-700 transition-[background-color,color] duration-200 ease-out hover:bg-gray-50 hover:text-gray-900"
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden px-4 pt-4 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] sm:px-6 sm:pt-6 sm:pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:px-6 md:pt-6 md:pb-6 lg:px-8 lg:pt-8 lg:pb-8">
          <div className="app-outlet-enter" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
