import { useState, useEffect, FormEvent } from 'react';
import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom';
import { Search, Instagram, Menu, X } from 'lucide-react';
import logoSrc from '../assets/logo/LOGO.svg';
import ChatBubble from '../components/ChatBubble';

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
    <div className="min-h-screen bg-white flex flex-col min-w-0">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-3 sm:px-6">
          {/* Center: quick entry to content library (filters live on /catalog) */}
          <div className="grid h-14 sm:h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex justify-start min-w-0">
              <Link to="/" className="flex items-center shrink-0">
                <img src={logoSrc} alt="CHT" className="h-7 sm:h-8 w-auto" />
              </Link>
            </div>

            <div className="hidden sm:flex justify-center min-w-0 px-1">
              <form onSubmit={submitBrowse} className="w-full max-w-xl lg:max-w-2xl">
                <div className="flex w-full rounded-full border border-gray-300 overflow-hidden bg-gray-50 focus-within:border-gray-900 focus-within:ring-1 focus-within:ring-gray-900">
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
                    className="shrink-0 px-4 py-2 bg-gray-100 border-l border-gray-300 hover:bg-gray-200 transition-colors"
                    aria-label="Go to library"
                  >
                    <Search className="h-5 w-5 text-gray-700" />
                  </button>
                </div>
              </form>
            </div>

            <div className="flex items-center justify-end gap-1 sm:gap-2 shrink-0">
              <Link
                to="/catalog"
                className="sm:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                aria-label="Browse library"
              >
                <Search className="h-5 w-5" />
              </Link>
              <div className="hidden sm:inline-flex items-center rounded-full bg-[#000000] p-1 gap-0.5">
                <Link
                  to="/login"
                  className="px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  Login
                </Link>
                <Link
                  to="/join"
                  className="rounded-full bg-white px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-[#000000] hover:bg-white/90 transition-colors"
                >
                  Get Started
                </Link>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-700 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Open menu"
                aria-expanded={drawerOpen}
              >
                <Menu className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Slide-in drawer (Hims-style ease) */}
        <div
          className={`fixed inset-0 z-[60] sm:z-[60] transition-opacity duration-300 ease-out ${
            drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          aria-hidden={!drawerOpen}
        >
          <button
            type="button"
            className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
              drawerOpen ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          />
          <nav
            className={`absolute top-0 right-0 h-full w-[min(100%,22rem)] bg-white shadow-2xl border-l border-gray-200 flex flex-col transition-transform duration-300 ease-out ${
              drawerOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
            aria-label="Site navigation"
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <span className="text-lg font-semibold text-gray-900">Menu</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2 px-2">
              {navLinks.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) =>
                    `block py-3.5 px-4 text-lg font-medium rounded-xl transition-colors ${
                      isActive ? 'text-gray-900 bg-gray-100' : 'text-gray-700 hover:bg-gray-50'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100 space-y-2 sm:hidden">
              <Link
                to="/login"
                onClick={() => setDrawerOpen(false)}
                className="block w-full py-3.5 text-center text-base font-semibold text-gray-900 bg-gray-100 rounded-xl hover:bg-gray-200"
              >
                Login
              </Link>
              <Link
                to="/join"
                onClick={() => setDrawerOpen(false)}
                className="block w-full py-3.5 text-center text-base font-semibold text-white bg-gray-900 rounded-xl hover:bg-black"
              >
                Get Started
              </Link>
            </div>
          </nav>
        </div>
      </header>

      <main className="flex-1 min-w-0 overflow-x-hidden">
        <Outlet />
      </main>
      <ChatBubble />

      <footer className="bg-[#000000] text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-12 md:py-16">
          <div className="flex flex-col lg:flex-row lg:justify-between gap-12 lg:gap-16">
            <div className="space-y-6 max-w-md">
              <Link to="/" className="inline-flex">
                <img src={logoSrc} alt="CHT" className="h-7 w-auto brightness-0 invert" />
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
