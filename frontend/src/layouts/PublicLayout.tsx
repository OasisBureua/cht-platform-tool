import { useState } from 'react';
import { Outlet, Link, NavLink } from 'react-router-dom';
import { Search, Instagram, Menu, X } from 'lucide-react';
import logoSrc from '../assets/logo/LOGO.svg';

const navLinks = [
  { to: '/about', label: 'About' },
  { to: '/what-we-do', label: 'What We Do' },
  { to: '/catalog', label: 'Content Library' },
  { to: '/for-hcps', label: 'For HCPs' },
  { to: '/contact', label: 'Contact' },
];

export default function PublicLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white flex flex-col min-w-0">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-14 sm:h-16 items-center justify-between gap-2">
            {/* Logo from assets */}
            <Link to="/" className="flex items-center shrink-0">
              <img src={logoSrc} alt="CHT" className="h-7 sm:h-8 w-auto" />
            </Link>

            {/* Nav links - desktop */}
            <nav className="hidden md:flex items-center gap-6 lg:gap-8">
              {navLinks.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `text-sm font-medium transition-colors ${
                      isActive ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>

            {/* Right: Search, Login/Get Started, mobile menu */}
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <Link
                to="/search"
                className="p-2 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors"
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </Link>
              <div className="hidden sm:inline-flex items-center rounded-full bg-[#000000] p-1 gap-0.5 sm:gap-1">
                <Link
                  to="/login"
                  className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  Login
                </Link>
                <Link
                  to="/join"
                  className="rounded-full bg-white px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-[#000000] hover:bg-white/90 transition-colors"
                >
                  Get Started
                </Link>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <nav className="mx-auto max-w-7xl px-4 py-4 flex flex-col gap-1">
              {navLinks.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `block py-3 px-4 text-base font-medium rounded-lg transition-colors ${
                      isActive ? 'text-gray-900 bg-gray-100' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
              <div className="flex gap-2 pt-4 mt-2 border-t border-gray-200">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 py-3 text-center text-sm font-semibold text-gray-900 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/join"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 py-3 text-center text-sm font-semibold text-white bg-gray-900 rounded-lg hover:bg-black transition-colors"
                >
                  Get Started
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer - Figma design (node-id=237-8879) */}
      <footer className="bg-[#000000] text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-12 md:py-16">
          <div className="flex flex-col lg:flex-row lg:justify-between gap-12 lg:gap-16">
            {/* Left: Logo, address, contact, social */}
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

            {/* Right: Quick Links + Legal */}
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
