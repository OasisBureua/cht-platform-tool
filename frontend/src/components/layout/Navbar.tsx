import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  Radio,
  Clock,
  ClipboardList,
  DollarSign,
  Settings as SettingsIcon,
  LogOut,
} from 'lucide-react';

function linkClass({ isActive }: { isActive: boolean }) {
  return [
    'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium',
    isActive
      ? 'border-gray-900 text-gray-900'
      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
  ].join(' ');
}

export default function Navbar() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!dropdownOpen) return;
    const close = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [dropdownOpen]);

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <NavLink to="/catalog" className="text-2xl font-bold text-gray-900">
                CHT Platform
              </NavLink>
            </div>

            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <NavLink to="/catalog" className={linkClass}>
                <LayoutGrid className="w-4 h-4 mr-2" />
                Library
              </NavLink>

              <NavLink to="/live" className={linkClass}>
                <Radio className="w-4 h-4 mr-2" />
                LIVE
              </NavLink>

              <NavLink to="/office-hours" className={linkClass}>
                <Clock className="w-4 h-4 mr-2" />
                Office Hours
              </NavLink>

              <NavLink to="/surveys" className={linkClass}>
                <ClipboardList className="w-4 h-4 mr-2" />
                Surveys
              </NavLink>
            </div>
          </div>

          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((o) => !o)}
                className="w-8 h-8 rounded-full bg-gray-900 text-white text-xs font-semibold flex items-center justify-center cursor-pointer"
                aria-label="User menu"
                aria-expanded={dropdownOpen}
              >
                HCP
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg bg-white border border-gray-200 shadow-lg py-1 z-50">
                  <button
                    type="button"
                    onClick={() => { setDropdownOpen(false); navigate('/earnings'); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <DollarSign className="w-4 h-4" />
                    Earnings
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDropdownOpen(false); navigate('/settings'); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <SettingsIcon className="w-4 h-4" />
                    Settings
                  </button>
                  <div className="border-t border-gray-200 my-1" />
                  <button
                    type="button"
                    onClick={() => { setDropdownOpen(false); navigate('/login'); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
