import { Outlet, Link, useLocation } from 'react-router-dom';

export default function PublicLayout() {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* =====================
          NAVBAR
          ===================== */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          {/* Brand */}
          <Link to="/" className="text-lg font-semibold text-gray-900">
            CHT
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-6">
            <NavLink to="/catalog" label="Catalog" current={pathname} />
            <NavLink to="/about" label="About" current={pathname} />
            <NavLink to="/contact" label="Contact" current={pathname} />
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-semibold text-gray-700 hover:text-gray-900"
            >
              Sign in
            </Link>

            <Link
              to="/join"
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
            >
              Join
            </Link>
          </div>
        </div>
      </header>

      {/* =====================
          CONTENT
          ===================== */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* =====================
          FOOTER
          ===================== */}
      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Brand */}
          <div className="space-y-2">
            <p className="font-semibold text-gray-900">CHT</p>
            <p className="text-sm text-gray-600 max-w-sm">
              Connecting healthcare professionals with accredited education,
              research opportunities, and rewards.
            </p>
          </div>

          {/* Links */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-900">Platform</p>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>
                <Link to="/catalog" className="hover:text-gray-900">
                  Catalog
                </Link>
              </li>
              <li>
                <Link to="/join" className="hover:text-gray-900">
                  Join
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-gray-900">
                  Sign in
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-900">Legal</p>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>
                <Link to="/privacy" className="hover:text-gray-900">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-gray-900">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-200 py-4 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} CHT. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

/* =====================
   Helpers
   ===================== */

function NavLink({
  to,
  label,
  current,
}: {
  to: string;
  label: string;
  current: string;
}) {
  const active = current.startsWith(to);

  return (
    <Link
      to={to}
      className={[
        'text-sm font-semibold',
        active ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900',
      ].join(' ')}
    >
      {label}
    </Link>
  );
}
