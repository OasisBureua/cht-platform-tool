import { useState, useEffect, FormEvent } from 'react';
import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom';
import { Search, Instagram, Menu, X } from 'lucide-react';
import ChatBubble from '../components/ChatBubble';
import ChmWordmarkOption2 from '../components/brand/ChmWordmarkOption2';
import ThemeToggle from '../components/ThemeToggle';

const navLinks = [
  { to: '/about', label: 'About' },
  { to: '/what-we-do', label: 'What We Do' },
  { to: '/catalog', label: 'Content Library' },
  { to: '/live', label: 'LIVE' },
  { to: '/chm-office-hours', label: 'CHM Office Hours' },
  { to: '/for-hcps', label: 'For HCPs' },
  { to: '/kol-network', label: "CHM DOC's" },
  { to: '/contact', label: 'Contact' },
];

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
    <div className="min-h-screen flex min-w-0 flex-col bg-white text-gray-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="sticky top-0 z-50 nav-liquid-glass">
        <div className="mx-auto max-w-7xl px-3 sm:px-6">
          {/* Center: quick entry to content library (filters live on /catalog) */}
          <div className="grid h-14 sm:h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex justify-start min-w-0">
              <Link
                to="/"
                className="flex items-center shrink-0 text-[#ea580c] transition-[color,opacity] hover:text-[#c2410c] hover:opacity-95 dark:text-[#fb923c] dark:hover:text-orange-300"
                aria-label="Community Health Media, home"
              >
                <ChmWordmarkOption2 className="h-7 w-[4.5rem] sm:h-8 sm:w-[5rem]" />
              </Link>
            </div>

            <div className="hidden sm:flex justify-center min-w-0 px-1">
              <form onSubmit={submitBrowse} className="w-full max-w-xl lg:max-w-2xl">
                <div className="flex w-full overflow-hidden rounded-full border border-white/50 bg-white/45 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7)] backdrop-blur-md transition-[box-shadow,border-color] focus-within:border-brand-400/60 focus-within:ring-2 focus-within:ring-brand-500/25">
                  <input
                    type="search"
                    name="q"
                    value={headerQuery}
                    onChange={(e) => setHeaderQuery(e.target.value)}
                    placeholder="Browse library…"
                    className="flex-1 min-w-0 bg-transparent pl-4 pr-2 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
                    aria-label="Browse content library"
                  />
                  <button
                    type="submit"
                    className="shrink-0 border-l border-white/40 bg-white/35 px-4 py-2 text-[#c2410c] transition-[color,background-color] hover:bg-orange-50/90 hover:text-[#9a3412] dark:text-[#fdba74] dark:hover:bg-brand-950/35 dark:hover:text-orange-100"
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
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 text-[#c2410c] transition-colors hover:bg-orange-50/80 hover:text-[#9a3412] sm:hidden dark:text-[#fdba74] dark:hover:bg-white/10"
                aria-label="Browse library"
              >
                <Search className="h-5 w-5" />
              </Link>
              <ThemeToggle className="shrink-0" />
              <div className="hidden sm:inline-flex items-center gap-0.5 rounded-full border border-zinc-200/70 bg-transparent p-1 shadow-[0_2px_14px_-6px_rgba(234,88,12,0.22)] backdrop-blur-md dark:border-zinc-600/55 dark:bg-transparent">
                <Link
                  to="/login"
                  className="rounded-full px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-zinc-900 transition-[opacity,background-color,color] hover:bg-zinc-100/90 dark:text-zinc-100 dark:hover:bg-zinc-800/75"
                >
                  Login
                </Link>
                <Link
                  to="/join"
                  className="rounded-full bg-orange-600 px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-[0_1px_0_0_rgba(255,255,255,0.22)_inset] transition-[background-color,color,transform] hover:bg-orange-700 active:scale-[0.98]"
                >
                  Get Started
                </Link>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#c2410c] transition-[color,background-color,transform] duration-200 ease-out hover:bg-orange-50/80 hover:text-[#9a3412] active:scale-[0.96] dark:text-[#fdba74] dark:hover:bg-white/5"
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
          className={`absolute right-0 top-0 flex h-full w-[min(100%,22rem)] max-w-[100vw] flex-col overflow-hidden rounded-l-[1.25rem] bg-white/[0.97] shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_32px_64px_-24px_rgba(0,0,0,0.28),inset_1px_0_0_0_rgba(255,255,255,0.85)] backdrop-blur-2xl backdrop-saturate-150 transition-[transform,box-shadow] duration-300 ease-out motion-reduce:duration-150 dark:bg-zinc-950/98 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_32px_64px_-24px_rgba(0,0,0,0.5)] ${
            drawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          aria-label="Site navigation"
        >
          <div className="flex shrink-0 items-center justify-between px-4 pb-3 pt-4 shadow-[0_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.08)]">
            <span className="text-balance text-lg font-semibold tracking-tight text-gray-900 dark:text-zinc-100">Menu</span>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-600 transition-[color,background-color,transform] duration-200 ease-out hover:bg-gray-100/90 active:scale-[0.96]"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
          <div
            className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-2"
            data-drawer-animating={drawerOpen ? 'true' : 'false'}
          >
            {navLinks.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) =>
                  [
                    'public-drawer-link flex min-h-[48px] items-center rounded-2xl px-4 py-3 text-pretty text-base font-medium leading-snug transition-[background-color,color,transform,box-shadow] duration-200 ease-out active:scale-[0.96]',
                    isActive
                      ? 'bg-brand-50/95 text-brand-950 shadow-[inset_0_0_0_1px_rgba(234,88,12,0.22)] dark:bg-brand-950/40 dark:text-orange-50'
                      : 'text-gray-800 hover:bg-gray-100/80 active:bg-gray-100 dark:text-zinc-200 dark:hover:bg-zinc-800/80 dark:active:bg-zinc-800',
                  ].join(' ')
                }
              >
                {label}
              </NavLink>
            ))}
          </div>
          <div className="shrink-0 space-y-2.5 p-4 pt-2 shadow-[0_-1px_0_0_rgba(0,0,0,0.06)] sm:hidden">
            <Link
              to="/login"
              onClick={() => setDrawerOpen(false)}
              className="flex min-h-[48px] w-full items-center justify-center rounded-2xl border-2 border-brand-600 bg-white text-center text-base font-semibold text-brand-800 shadow-[0_8px_24px_-12px_rgba(234,88,12,0.18)] transition-[background-color,transform,box-shadow] duration-200 ease-out hover:bg-brand-50 active:scale-[0.96] dark:border-brand-400 dark:bg-zinc-950 dark:text-orange-50 dark:hover:bg-brand-950/35"
            >
              Login
            </Link>
            <Link
              to="/join"
              onClick={() => setDrawerOpen(false)}
              className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-orange-600 text-center text-base font-semibold text-white shadow-[0_1px_0_0_rgba(255,255,255,0.22)_inset,0_10px_28px_-10px_rgba(234,88,12,0.42)] transition-[background-color,transform,box-shadow] duration-200 ease-out hover:bg-orange-700 active:scale-[0.96]"
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
              <Link to="/" className="inline-flex text-white transition-opacity hover:opacity-90" aria-label="Community Health Media, home">
                <ChmWordmarkOption2 className="h-8 w-[5rem] text-white" />
              </Link>
              <address className="not-italic text-sm text-gray-300 space-y-1 leading-relaxed">
                <p>2471 18th St NW</p>
                <p>Second Floor</p>
                <p>Washington, DC 20009</p>
                <p>Tel: (123) 456-7890</p>
                <p>Email: info@communityhealth.media</p>
              </address>
              <div className="flex gap-4">
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="Instagram"
                >
                  <Instagram className="h-5 w-5" />
                </a>
                <a
                  href="https://youtube.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="YouTube"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </a>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-10 sm:gap-16">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">Quick Links</p>
                <ul className="space-y-3">
                  {navLinks.map(({ to, label }) => (
                    <li key={to}>
                      <Link to={to} className="text-sm text-gray-300 hover:text-white transition-colors">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">Legal</p>
                <ul className="space-y-3">
                  <li>
                    <Link to="/privacy" className="text-sm text-gray-300 hover:text-white transition-colors">
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link to="/terms" className="text-sm text-gray-300 hover:text-white transition-colors">
                      Terms of Service
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-white/10">
            <p className="text-sm text-gray-500">Copyright © 2026 Community Health Technologies, Inc. All Rights Reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
