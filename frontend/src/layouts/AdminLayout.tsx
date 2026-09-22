import { NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AdminSidebar from '../components/navigation/AdminSidebar';
import ThemeToggle from '../components/ThemeToggle';

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
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
    setProfileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-app-ground text-text md:flex-row">
      <AdminSidebar />

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 sm:h-16 sm:px-6">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">
              Admin Console
            </span>
            <p className="truncate text-sm font-medium text-foreground sm:text-base">
              Welcome, {displayName || 'Admin'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <NavLink
              to="/admin/hcp-explorer"
              className={({ isActive }) =>
                [
                  'flex shrink-0 items-center gap-1.5 rounded-card px-2.5 py-2 text-sm font-medium transition-colors sm:px-3',
                  isActive
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
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
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-gray-200/90 text-sm font-semibold text-muted-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.06)_inset,0_2px_8px_-2px_rgba(0,0,0,0.08)] ring-2 ring-white/90 transition-[transform,box-shadow,color,background-color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.96] dark:from-zinc-800 dark:to-zinc-700 dark:ring-zinc-900"
              >
                {(displayName || 'A').charAt(0).toUpperCase()}
              </button>

              {profileMenuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-48 overflow-hidden rounded-card border border-border/90 bg-card p-1.5 shadow-[0_1px_0_rgba(0,0,0,0.04),0_16px_40px_-18px_rgba(0,0,0,0.2)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_16px_40px_-18px_rgba(0,0,0,0.55)]"
                >
                  <Link
                    to="/admin/settings"
                    role="menuitem"
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex min-h-[44px] items-center rounded-[6px] px-3 text-sm font-medium text-muted-foreground transition-[background-color,color] duration-200 ease-out hover:bg-muted hover:text-foreground"
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
                    className="flex min-h-[44px] w-full items-center rounded-[6px] px-3 text-left text-sm font-medium text-muted-foreground transition-[background-color,color] duration-200 ease-out hover:bg-muted hover:text-foreground"
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
