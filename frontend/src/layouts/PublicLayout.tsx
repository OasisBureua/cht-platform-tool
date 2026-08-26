import { useState, useEffect, type FormEvent } from 'react';
import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom';
import { Search, Menu, X } from 'lucide-react';
import ChatBubble from '../components/ChatBubble';
import ChmWordmarkOption2 from '../components/brand/ChmWordmarkOption2';
import ThemeToggle from '../components/ThemeToggle';

// Brand icons were removed from lucide-react in v1.x, local outline SVGs
// (same 24px stroke language as the lucide icons they replace).
function IconInstagram({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function IconLinkedIn({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function IconFacebook({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

const allNavLinks = [
  { to: '/about', label: 'About' },
  { to: '/what-we-do', label: 'What We Do' },
  { to: '/catalog', label: 'Content Library' },
  { to: '/kol-network', label: 'KOL Network' },
  { to: '/live', label: 'Live' },
  { to: '/chm-office-hours', label: 'CHM Office Hours' },
  { to: '/for-hcps', label: 'For HCPs' },
  { to: '/contact', label: 'Contact' },
];

const footerQuickLinks = allNavLinks.filter(
  (l) => l.to !== '/about' && l.to !== '/what-we-do',
);

const drawerNavLinks = allNavLinks.filter(
  (l) => l.to !== '/about' && l.to !== '/what-we-do' && l.to !== '/for-hcps',
);

export default function PublicLayout() {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [headerQuery, setHeaderQuery] = useState('');

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  const submitBrowse = (e: FormEvent) => {
    e.preventDefault();
    const q = headerQuery.trim();
    setDrawerOpen(false);
    if (q) navigate(`/catalog?q=${encodeURIComponent(q)}`);
    else navigate('/catalog');
  };

  return (
    <div className="min-h-screen flex min-w-0 flex-col bg-chm-surface text-foreground">
      <header className="sticky top-0 z-50 nav-liquid-glass">
        <div className="mx-auto max-w-7xl px-3 sm:px-6">
          {/* Center: quick entry to content library (filters live on /catalog) */}
          <div className="grid h-14 sm:h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex justify-start min-w-0">
              <Link
                to="/home"
                className="flex items-center shrink-0 text-steel-600 transition-[color,opacity] hover:text-steel-700 hover:opacity-95 dark:text-steel-400 dark:hover:text-steel-300"
                aria-label="Community Health Media, home"
              >
                <ChmWordmarkOption2 className="h-7 w-[4.5rem] sm:h-8 sm:w-[5rem]" />
              </Link>
            </div>

            <div className="flex justify-center min-w-0 px-1">
              <form onSubmit={submitBrowse} className="w-full max-w-xl lg:max-w-2xl">
                <div className="flex w-full overflow-hidden rounded-full border border-white/50 bg-white/45 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7)] backdrop-blur-md transition-[box-shadow,border-color] focus-within:border-steel-400/60 focus-within:ring-2 focus-within:ring-steel-500/25">
                  <input
                    type="search"
                    name="q"
                    value={headerQuery}
                    onChange={(e) => setHeaderQuery(e.target.value)}
                    placeholder="Browse library…"
                    className="flex-1 min-w-0 bg-transparent pl-4 pr-2 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                    aria-label="Browse content library"
                  />
                  <button
                    type="submit"
                    className="shrink-0 border-l border-white/40 bg-white/35 px-4 py-2 text-steel-700 transition-[color,background-color] hover:bg-steel-50/90 hover:text-steel-800 dark:text-steel-300 dark:hover:bg-steel-950/35 dark:hover:text-steel-100"
                    aria-label="Go to library"
                  >
                    <Search className="h-5 w-5" />
                  </button>
                </div>
              </form>
            </div>

            <div className="flex items-center justify-end gap-1 sm:gap-2 shrink-0">
              <Link
                to="/catalog"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-card p-2 text-steel-700 transition-colors hover:bg-steel-50/80 hover:text-steel-800 sm:hidden dark:text-steel-300 dark:hover:bg-white/10"
                aria-label="Browse library"
              >
                <Search className="h-5 w-5" />
              </Link>
              <ThemeToggle className="shrink-0" />
              <div className="hidden sm:inline-flex items-center gap-0.5 rounded-full border border-zinc-200/70 bg-transparent p-1 shadow-[0_2px_14px_-6px_rgba(49,105,149,0.16)] backdrop-blur-md dark:border-zinc-600/55 dark:bg-transparent">
                <Link
                  to="/login"
                  className="rounded-[6px] px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-zinc-900 transition-[opacity,background-color,color] hover:bg-muted/90 dark:hover:bg-muted/75"
                >
                  Login
                </Link>
                <Link
                  to="/join"
                  className="rounded-[6px] bg-brand-600 px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-[0_1px_0_0_rgba(255,255,255,0.22)_inset] transition-[background-color,color,transform] hover:bg-brand-700 active:scale-[0.98]"
                >
                  Get Started
                </Link>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-card text-steel-700 transition-[color,background-color,transform] duration-200 ease-out hover:bg-steel-50/80 hover:text-steel-800 active:scale-[0.96] dark:text-steel-300 dark:hover:bg-white/5"
                aria-label="Open menu"
                aria-expanded={drawerOpen}
              >
                <Menu className="h-6 w-6" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Slide-in drawer: kept outside <header> so position:fixed is viewport-relative.
          backdrop-filter on the glass header creates a containing block and was clipping the drawer to ~nav height. */}
      <div
        className={`fixed inset-0 z-[100] transition-[opacity] duration-300 ease-out motion-reduce:duration-150 ${
          drawerOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!drawerOpen}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-black/[0.38] transition-[opacity] duration-300 ease-out motion-reduce:duration-150 ${
            drawerOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setDrawerOpen(false)}
          aria-label="Close menu"
        />
        <nav
          className={`absolute right-0 top-0 flex h-full w-[min(100%,22rem)] max-w-[100vw] flex-col overflow-hidden rounded-l-[1.25rem] bg-white/[0.97] shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_32px_64px_-24px_rgba(0,0,0,0.28),inset_1px_0_0_0_rgba(255,255,255,0.85)] backdrop-blur-2xl backdrop-saturate-150 transition-[transform,box-shadow] duration-300 ease-out motion-reduce:duration-150 dark:border-l /90  dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_32px_64px_-24px_rgba(0,0,0,0.55),inset_1px_0_0_0_rgba(255,255,255,0.04)] ${
            drawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          aria-label="Site navigation"
        >
          <div className="flex shrink-0 items-center justify-between px-4 pb-3 pt-4 shadow-[0_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.1)]">
            <span className="text-balance text-lg font-semibold tracking-tight text-foreground dark:text-white">Menu</span>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card text-muted-foreground transition-[color,background-color,transform] duration-200 ease-out hover:bg-muted/90 active:scale-[0.96] dark:text-white dark:hover:bg-muted dark:active:bg-zinc-800/90"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
          <div
            className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-2"
            data-drawer-animating={drawerOpen ? 'true' : 'false'}
          >
            {drawerNavLinks.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) =>
                  [
                    'public-drawer-link flex min-h-[48px] items-center rounded-card px-4 py-3 text-pretty text-base font-medium leading-snug transition-[background-color,color,transform,box-shadow] duration-200 ease-out active:scale-[0.96]',
                    isActive
                      ? 'bg-steel-100/95 text-steel-950 shadow-[inset_0_0_0_1px_rgba(49,105,149,0.2)] dark:bg-steel-950/50 dark:text-steel-50'
                      : 'text-foreground hover:bg-muted/80 active:bg-muted  dark:hover:bg-muted/80 dark:active:bg-zinc-800',
                  ].join(' ')
                }
              >
                {label}
              </NavLink>
            ))}
          </div>
          <div className="sm:hidden shrink-0 flex items-center justify-between gap-3 border-t border-gray-200/90 px-4 py-3 /90">
            <span className="text-sm font-medium text-muted-foreground">Appearance</span>
            <ThemeToggle />
          </div>
          <div className="shrink-0 space-y-2.5 p-4 pt-2 shadow-[0_-1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[0_-1px_0_0_rgba(255,255,255,0.1)] sm:hidden">
            <Link
              to="/login"
              onClick={() => setDrawerOpen(false)}
              className="flex min-h-[48px] w-full items-center justify-center rounded-card border-2 border-steel-600 bg-card text-center text-base font-semibold text-steel-800 shadow-[0_8px_24px_-12px_rgba(49,105,149,0.2)] transition-[background-color,transform,box-shadow] duration-200 ease-out hover:bg-steel-50 active:scale-[0.96] dark:border-steel-400 dark:text-steel-50 dark:hover:bg-steel-950/35"
            >
              Login
            </Link>
            <Link
              to="/join"
              onClick={() => setDrawerOpen(false)}
              className="flex min-h-[48px] w-full items-center justify-center rounded-card bg-brand-600 text-center text-base font-semibold text-white shadow-[0_1px_0_0_rgba(255,255,255,0.22)_inset,0_10px_28px_-10px_rgba(0,124,255,0.42)] transition-[background-color,transform,box-shadow] duration-200 ease-out hover:bg-brand-700 active:scale-[0.96]"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </div>

      <main className="flex-1 min-w-0 overflow-x-hidden">
        <Outlet />
      </main>
      <ChatBubble />

      <footer className="bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-12 md:py-16">
          <div className="flex flex-col lg:flex-row lg:justify-between gap-12 lg:gap-16">
            <div className="space-y-6 max-w-md">
              <Link to="/home" className="inline-flex text-white transition-opacity hover:opacity-90" aria-label="Community Health Media, home">
                <ChmWordmarkOption2 className="h-8 w-[5rem] text-white" />
              </Link>
              <address className="not-italic text-sm text-white/70 space-y-1 leading-relaxed">
                <p>2471 18th St NW</p>
                <p>Second Floor</p>
                <p>Washington, DC 20009</p>
                <p>Email: info@communityhealth.media</p>
              </address>
              <div className="flex gap-4">
                <a
                  href="https://www.instagram.com/healthinourhands_/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/70 hover:text-white transition-colors"
                  aria-label="Instagram"
                >
                  <IconInstagram className="h-5 w-5" />
                </a>
                <a
                  href="https://youtube.com/@CommunityHealthMedia/videos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/70 hover:text-white transition-colors"
                  aria-label="YouTube"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </a>
                <a
                  href="https://www.linkedin.com/company/community-health-media/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/70 hover:text-white transition-colors"
                  aria-label="LinkedIn"
                >
                  <IconLinkedIn className="h-5 w-5" />
                </a>
                <a
                  href="https://www.facebook.com/CHMediaHub/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/70 hover:text-white transition-colors"
                  aria-label="Facebook"
                >
                  <IconFacebook className="h-5 w-5" />
                </a>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-10 sm:gap-16">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-4">Quick Links</p>
                <ul className="space-y-3">
                  {footerQuickLinks.map(({ to, label }) => (
                    <li key={to}>
                      <Link to={to} className="text-sm text-white/70 hover:text-white transition-colors">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-4">Legal</p>
                <ul className="space-y-3">
                  <li>
                    <Link to="/privacy" className="text-sm text-white/70 hover:text-white transition-colors">
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link to="/terms" className="text-sm text-white/70 hover:text-white transition-colors">
                      Terms of Service
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-white/10">
            <p className="text-sm text-white/70">Copyright © 2026 Community Health Technologies, Inc. All Rights Reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
