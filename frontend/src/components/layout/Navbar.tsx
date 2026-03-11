import { NavLink } from 'react-router-dom';
import {
  User,
  Video,
  ClipboardList,
  PlayCircle,
  DollarSign,
  Settings as SettingsIcon,
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
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <NavLink to="/webinars" className="text-2xl font-bold text-gray-900">
                CHT Platform
              </NavLink>
            </div>

            {/* Navigation */}
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <NavLink to="/webinars" className={linkClass}>
                <Video className="w-4 h-4 mr-2" />
                Webinars
              </NavLink>

              <NavLink to="/surveys" className={linkClass}>
                <ClipboardList className="w-4 h-4 mr-2" />
                Surveys
              </NavLink>

              <NavLink to="/catalog" className={linkClass}>
                <PlayCircle className="w-4 h-4 mr-2" />
                Conversations &amp; Earn
              </NavLink>

              <NavLink to="/earnings" className={linkClass}>
                <DollarSign className="w-4 h-4 mr-2" />
                Earnings
              </NavLink>

              <NavLink to="/settings" className={linkClass}>
                <SettingsIcon className="w-4 h-4 mr-2" />
                Settings
              </NavLink>
            </div>
          </div>

          {/* User menu */}
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            <button className="p-2 rounded-full text-gray-400 hover:text-gray-500">
              <User className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
