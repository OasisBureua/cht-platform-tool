import { Link, NavLink, Outlet } from 'react-router-dom';
import { Search } from 'lucide-react';

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'text-sm font-medium',
          isActive ? 'text-gray-900' : 'text-gray-700 hover:text-gray-900',
        ].join(' ')
      }
    >
      {label}
    </NavLink>
  );
}

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-6">
          <div className="h-20 flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3">
              {/* Simple mark placeholder (swap with your SVG when ready) */}
              <div className="h-10 w-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center">
                <span className="text-sm font-bold text-gray-900">CH</span>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-10">
              <NavItem to="/about" label="About" />
              <NavItem to="/what-we-do" label="What We Do" />
              <NavItem to="/catalog" label="Content Library" />
              <NavItem to="/for-hcps" label="For HCPs" />
              <NavItem to="/contact" label="Contact" />
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-4">
              <Link
                to="/search"
                className="hidden sm:flex h-11 w-11 items-center justify-center rounded-full hover:bg-gray-50"
                aria-label="Search"
              >
                <Search className="h-6 w-6 text-gray-900" />
              </Link>

              {/* Pills (matches PDF: Login filled, Get Started outlined) */}
              <div className="hidden sm:flex items-center rounded-full border border-gray-200 p-1">
                <Link
                  to="/login"
                  className="rounded-full bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:bg-black"
                >
                  Login
                </Link>
                <Link
                  to="/join"
                  className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                >
                  Get Started
                </Link>
              </div>

              {/* Mobile: show CTA only */}
              <div className="sm:hidden">
                <Link
                  to="/join"
                  className="rounded-full bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:bg-black"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Page */}
      <main>
        <Outlet />
      </main>

      {/* Footer (matches PDF layout + copy) */}
      <footer className="mt-16 bg-black">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
            {/* Left */}
            <div className="md:col-span-6 space-y-4">
              <div className="text-sm text-white/80 space-y-1">
                <p className="text-white font-semibold">Address:</p>
                <p>2471 18th St NW</p>
                <p>Second Floor</p>
                <p>Washington, DC 20009</p>
                <p className="pt-2">
                  Email: <span className="text-white/90">info@communityhealth.media</span>
                </p>
              </div>

              <p className="text-sm text-white/70">
                Copyright © 2025 Community Health Technologies, Inc. All Rights Reserved
              </p>

              {/* Social icons placeholders */}
              <div className="flex items-center gap-4 pt-2">
                <a
                  href="#"
                  className="h-10 w-10 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 flex items-center justify-center"
                  aria-label="Instagram"
                >
                  <span className="text-white text-xs font-semibold">IG</span>
                </a>
                <a
                  href="#"
                  className="h-10 w-10 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 flex items-center justify-center"
                  aria-label="Facebook"
                >
                  <span className="text-white text-xs font-semibold">FB</span>
                </a>
                <a
                  href="#"
                  className="h-10 w-10 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 flex items-center justify-center"
                  aria-label="YouTube"
                >
                  <span className="text-white text-xs font-semibold">YT</span>
                </a>
              </div>
            </div>

            {/* Right columns */}
            <div className="md:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-10">
              <FooterLinks
                title="Quick Link 1"
                links={[
                  { label: 'Quick Link 2', to: '/catalog' },
                  { label: 'Quick Link 3', to: '/for-hcps' },
                  { label: 'Quick Link 3', to: '/what-we-do' },
                ]}
              />
              <FooterLinks
                title="Quick Link 1"
                links={[
                  { label: 'Quick Link 2', to: '/about' },
                  { label: 'Quick Link 3', to: '/contact' },
                  { label: 'Quick Link 3', to: '/privacy' },
                ]}
              />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterLinks({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; to: string }>;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="space-y-3">
        {links.map((l, idx) => (
          <Link
            key={`${l.to}-${idx}`}
            to={l.to}
            className="block text-sm text-white/80 hover:text-white"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
